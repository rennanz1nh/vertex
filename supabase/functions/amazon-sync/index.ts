// ─── amazon-sync Edge Function ────────────────────────────────────────────────
// Mirrors ebay-sync. Uses Amazon SP-API (Selling Partner API), Orders API v0.
// DB columns used on `orders` (new, added by migration 20260711030000):
//   comissao_amazon
// Shared columns reused as-is: canal, numero_pedido_canal, data_pedido, status,
//   total, frete_total, impostos, descontos, client_id, buyer_email, country,
//   endereco_completo, observacoes, forma_pagamento.
//
// KNOWN GAPS vs. eBay (flagged rather than guessed at):
//   - shipping_tracking / carrier are left null. Unlike eBay's Fulfillment API,
//     SP-API's Orders API does not expose a simple "get tracking for this order"
//     read call for merchant-fulfilled (FBM) orders — tracking is something the
//     seller CONFIRMS (Shipping Confirmations feed / Buy Shipping), not something
//     read back the same way. Revisit once FBA-vs-FBM is confirmed (see plan's
//     open questions) — FBA tracking is available via the Fulfillment Outbound API.
//   - Address / buyer email require a Restricted Data Token (RDT) — a short-lived
//     token scoped to PII, separate from the normal LWA access token. If the
//     "Direct-to-Consumer Delivery (Restricted)" role wasn't granted in Seller
//     Central (Fase 2), the RDT call fails and these fields are simply left null
//     for that order rather than failing the whole sync.
//   - Amazon Ads spend (Sponsored Products) is NOT available via SP-API at all —
//     it lives in a separate Amazon Ads API with its own OAuth app. Not attempted.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spApiBase(sandbox: boolean) {
  // Sandbox base differs from production for SP-API; NA region only for now.
  return sandbox ? 'https://sandbox.sellingpartnerapi-na.amazon.com' : 'https://sellingpartnerapi-na.amazon.com'
}

async function getAndRefreshToken(
  db: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; sellerId: string | null; marketplaceId: string }> {
  const { data: row } = await db
    .from('amazon_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.refresh_token) {
    throw new Error('Amazon not connected. Paste the Client ID / Client Secret / Refresh Token from Seller Central first.')
  }

  // Amazon's LWA (Login with Amazon) token endpoint takes client_id/client_secret as
  // body params — no Basic auth header, and no `scope` param (the refresh token is
  // already scoped to whatever roles were granted at self-authorization time).
  const res = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${err}. Please re-check the Amazon credentials.`)
  }

  const tok = await res.json() as { access_token: string; expires_in: number }

  await db.from('amazon_tokens').update({
    access_token: tok.access_token,
    access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)

  return { accessToken: tok.access_token, sellerId: row.seller_id ?? null, marketplaceId: row.marketplace_id ?? 'ATVPDKIKX0DER' }
}

/** Requests a short-lived Restricted Data Token scoped to PII (buyer address/email) for
 *  a single order. Returns null (rather than throwing) if the seller hasn't granted the
 *  "Direct-to-Consumer Delivery (Restricted)" role — the caller must treat that as
 *  "no PII available for this order" and continue, not fail the whole sync. */
async function getRestrictedDataToken(accessToken: string, sandbox: boolean, orderId: string): Promise<string | null> {
  try {
    const res = await fetch(`${spApiBase(sandbox)}/tokens/2021-03-01/restrictedDataToken`, {
      method: 'POST',
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        restrictedResources: [
          { method: 'GET', path: `/orders/v0/orders/${orderId}/address`, dataElements: ['buyerInfo', 'shippingAddress'] },
        ],
      }),
    })
    if (!res.ok) return null
    const body = await res.json()
    return body.restrictedDataToken ?? null
  } catch {
    return null
  }
}

function mapOrderStatus(amazonStatus: string): string {
  const map: Record<string, string> = {
    Pending:              'Pronto para Envio', // payment not yet confirmed
    PendingAvailability:  'Pronto para Envio',
    Unshipped:            'Pronto para Envio',
    PartiallyShipped:     'Enviado',
    Shipped:              'Enviado',           // Shipped ≠ Delivered; Amazon doesn't expose delivery confirmation on the order object
    InvoiceUnconfirmed:   'Pronto para Envio',
    Unfulfillable:        'Pronto para Envio',
    Canceled:             'Cancelado',
  }
  return map[amazonStatus] ?? 'Pronto para Envio'
}

function buildFullAddress(addr: any): string {
  return [
    addr?.AddressLine1,
    addr?.AddressLine2,
    addr?.City,
    addr?.StateOrRegion,
    addr?.PostalCode,
    addr?.CountryCode,
  ].filter(Boolean).join(', ')
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Called two ways: a logged-in admin clicking "Sincronizar Amazon" (real user JWT), or
  // the cron fallback route authenticating with the service role key directly.
  const token = authHeader.replace('Bearer ', '')
  const isServiceRoleCall = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!isServiceRoleCall) {
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { error: authErr } = await anonClient.auth.getUser(token)
    if (authErr) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const amazonClientId     = Deno.env.get('AMAZON_CLIENT_ID')
  const amazonClientSecret = Deno.env.get('AMAZON_CLIENT_SECRET')
  const sandbox             = Deno.env.get('AMAZON_SANDBOX') === 'true'

  if (!amazonClientId || !amazonClientSecret) {
    return new Response(JSON.stringify({
      error: 'AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET must be set in Supabase secrets.',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const { accessToken, marketplaceId } = await getAndRefreshToken(db, amazonClientId, amazonClientSecret)

    // Sync last 90 days only, same window discipline as ebay-sync (avoids Edge Function timeout).
    const now    = new Date()
    const oldest = new Date(now)
    oldest.setDate(oldest.getDate() - 90)

    const amazonOrders: any[] = []
    let nextToken: string | null = null
    let href = `${spApiBase(sandbox)}/orders/v0/orders?MarketplaceIds=${marketplaceId}` +
      `&CreatedAfter=${encodeURIComponent(oldest.toISOString())}` +
      `&CreatedBefore=${encodeURIComponent(now.toISOString())}`

    do {
      const url: string = nextToken
        ? `${spApiBase(sandbox)}/orders/v0/orders?NextToken=${encodeURIComponent(nextToken)}`
        : href
      const res = await fetch(url, {
        headers: { 'x-amz-access-token': accessToken, 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        console.warn(`[amazon] orders fetch failed (${res.status}): ${await res.text()}`)
        break
      }
      const body = await res.json()
      const payload = body.payload ?? {}
      for (const order of payload.Orders ?? []) {
        amazonOrders.push(order)
      }
      nextToken = payload.NextToken ?? null
    } while (nextToken)

    const debugSample = amazonOrders.length > 0 ? {
      AmazonOrderId: amazonOrders[0].AmazonOrderId,
      OrderStatus: amazonOrders[0].OrderStatus,
      FulfillmentChannel: amazonOrders[0].FulfillmentChannel,
    } : null

    let newOrders = 0, updatedOrders = 0
    const errors: string[] = []

    for (const ao of amazonOrders) {
      try {
        const orderId: string = ao.AmazonOrderId

        // ── Order items (needed for line-item totals + product mapping) ──
        const items: any[] = []
        let itemsNextToken: string | null = null
        do {
          const url: string = itemsNextToken
            ? `${spApiBase(sandbox)}/orders/v0/orders/${orderId}/orderItems?NextToken=${encodeURIComponent(itemsNextToken)}`
            : `${spApiBase(sandbox)}/orders/v0/orders/${orderId}/orderItems`
          const res = await fetch(url, {
            headers: { 'x-amz-access-token': accessToken, 'Content-Type': 'application/json' },
          })
          if (!res.ok) break
          const body = await res.json()
          const payload = body.payload ?? {}
          for (const it of payload.OrderItems ?? []) items.push(it)
          itemsNextToken = payload.NextToken ?? null
        } while (itemsNextToken)

        // ── Address & buyer info (restricted — needs its own token, may be unavailable) ──
        let country: string | null = null
        let buyerEmail: string | null = null
        let endereco_completo: string | null = null

        const rdt = await getRestrictedDataToken(accessToken, sandbox, orderId)
        if (rdt) {
          try {
            const addrRes = await fetch(`${spApiBase(sandbox)}/orders/v0/orders/${orderId}/address`, {
              headers: { 'x-amz-access-token': rdt, 'Content-Type': 'application/json' },
            })
            if (addrRes.ok) {
              const addrBody = await addrRes.json()
              const shipAddr = addrBody.payload?.ShippingAddress
              if (shipAddr) {
                country = shipAddr.CountryCode ?? null
                endereco_completo = buildFullAddress(shipAddr) || null
              }
            }
          } catch (e) {
            console.warn(`[amazon-sync] address fetch failed for ${orderId}:`, e)
          }
          try {
            const buyerRes = await fetch(`${spApiBase(sandbox)}/orders/v0/orders/${orderId}/buyerInfo`, {
              headers: { 'x-amz-access-token': rdt, 'Content-Type': 'application/json' },
            })
            if (buyerRes.ok) {
              const buyerBody = await buyerRes.json()
              buyerEmail = buyerBody.payload?.BuyerEmail ?? null
            }
          } catch (e) {
            console.warn(`[amazon-sync] buyerInfo fetch failed for ${orderId}:`, e)
          }
        }

        // ── Financials — Amazon's OrderTotal is tax-inclusive and authoritative, unlike
        // eBay's pricingSummary.total quirk. Per-item breakdown (tax/shipping/discount)
        // still comes from line items, same shape as the ebay-sync itemization. ──
        let frete_total = 0, impostos = 0, descontos = 0
        for (const it of items) {
          frete_total += parseFloat(it.ShippingPrice?.Amount ?? '0') - parseFloat(it.ShippingDiscount?.Amount ?? '0')
          impostos    += parseFloat(it.ItemTax?.Amount ?? '0') + parseFloat(it.ShippingTax?.Amount ?? '0')
          descontos   += parseFloat(it.PromotionDiscount?.Amount ?? '0')
        }
        const finalTotal = parseFloat(ao.OrderTotal?.Amount ?? '0')

        // ── Status ──
        const status = mapOrderStatus(ao.OrderStatus ?? '')
        const isFullyPaid = !['Pending', 'PendingAvailability'].includes(ao.OrderStatus ?? '')

        // ── Client upsert — Amazon anonymizes buyers (no stable username like eBay's),
        // so each order is keyed by its own AmazonOrderId rather than merging repeat
        // buyers into one client record. Revisit if Amazon ever exposes a stable buyer ID. ──
        let clientId: string | null = null
        {
          const { data: ex } = await db
            .from('clients')
            .select('id')
            .eq('observacoes', `Amazon:${orderId}`)
            .maybeSingle()

          if (ex) {
            clientId = ex.id
            const upd: Record<string, any> = {}
            if (buyerEmail) upd.email = buyerEmail
            if (country)    upd.endereco_pais = country
            if (Object.keys(upd).length > 0) {
              await db.from('clients').update(upd).eq('id', ex.id)
            }
          } else {
            const { data: nc } = await db.from('clients').insert({
              nome_razao:       ao.BuyerInfo?.BuyerName ?? `Amazon Buyer (${orderId})`,
              canal_principal:  'Amazon',
              observacoes:      `Amazon:${orderId}`,
              tipo:             'Cliente Final',
              email:            buyerEmail,
              endereco_pais:    country ?? 'US',
            }).select('id').single()
            clientId = nc?.id ?? null
          }
        }

        // ── Order upsert ──
        const { data: existing } = await db
          .from('orders')
          .select('id, ebay_status_manual, funds_available_manual')
          .eq('canal', 'Amazon')
          .eq('numero_pedido_canal', orderId)
          .maybeSingle()

        if (existing) {
          const upd: Record<string, any> = {
            total:              finalTotal,
            frete_total,
            impostos,
            descontos,
            client_id:          clientId,
            updated_at:         new Date().toISOString(),
          }
          if (buyerEmail)       upd.buyer_email = buyerEmail
          if (country)          upd.country = country
          if (endereco_completo) upd.endereco_completo = endereco_completo
          // Reuse the same manual-override columns eBay uses so admin edits are never clobbered.
          if (!existing.ebay_status_manual) {
            upd.status = status
          }
          if (!existing.funds_available_manual) {
            upd.funds_available = isFullyPaid
          }
          await db.from('orders').update(upd).eq('id', existing.id)
          updatedOrders++
          await upsertLineItems(db, existing.id, items)
        } else {
          const { data: newOrder, error: insertErr } = await db.from('orders').insert({
            canal:                  'Amazon',
            numero_pedido_canal:    orderId,
            data_pedido:            ao.PurchaseDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
            status,
            funds_available:        isFullyPaid,
            funds_available_manual: false,
            ebay_status_manual:     false,
            total:                  finalTotal,
            frete_total,
            impostos,
            descontos,
            client_id:              clientId,
            forma_pagamento:        ao.PaymentMethod ?? null,
            buyer_email:            buyerEmail,
            country,
            endereco_completo:      endereco_completo,
            observacoes:            `Amazon: ${orderId}`,
          }).select('id').single()

          if (insertErr) throw insertErr
          await upsertLineItems(db, newOrder!.id, items)
          newOrders++
        }
      } catch (err) {
        errors.push(`${ao.AmazonOrderId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return new Response(JSON.stringify({
      success:            true,
      new_orders:         newOrders,
      updated_orders:     updatedOrders,
      total_from_amazon:  amazonOrders.length,
      errors:             errors.length ? errors : undefined,
      debug_sample:       debugSample,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Order items helper ───────────────────────────────────────────────────────

async function upsertLineItems(
  db: ReturnType<typeof createClient>,
  orderId: string,
  lineItems: any[],
) {
  await db.from('order_items').delete().eq('order_id', orderId)
  if (lineItems.length === 0) return

  const rows = []
  for (const li of lineItems) {
    let productId: string | null = null
    if (li.SellerSKU) {
      const { data: prod } = await db
        .from('products')
        .select('id')
        .eq('SKU', li.SellerSKU)
        .maybeSingle()
      productId = prod?.id ?? null
    }

    const quantity = li.QuantityOrdered ?? 1
    rows.push({
      order_id:         orderId,
      product_id:       productId,
      sku:              li.SellerSKU ?? null,
      quantidade:       quantity,
      // Amazon's ItemPrice is already the line total (not per-unit) — divide by
      // quantity for the per-unit price, same convention as ebay-sync's lineItemCost.
      preco_unitario:   parseFloat(li.ItemPrice?.Amount ?? '0') / (quantity || 1),
      custo_unitario:   0,
      imposto_unitario: parseFloat(li.ItemTax?.Amount ?? '0') / (quantity || 1),
      frete_unitario:   parseFloat(li.ShippingPrice?.Amount ?? '0') / (quantity || 1),
    })
  }

  const { error } = await db.from('order_items').insert(rows)
  if (error) console.warn('[order_items] insert error:', error.message)
}
