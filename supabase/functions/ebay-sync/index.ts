// ─── ebay-sync Edge Function ─────────────────────────────────────────────────
// Clean, canonical version. Deployed via deploy-ebay.bat.
// DB columns used on `orders`:
//   country, buyer_email, funds_available, funds_available_manual,
//   ebay_status_manual, ebay_fulfillment_status, endereco_completo
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiBase(sandbox: boolean) {
  return sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
}

// `orders.data_pedido` is meant to be "the calendar day of the sale" for the business,
// which runs on US Eastern time — not the day the ISO timestamp falls on in UTC. A sale
// made at, say, 9pm ET is already the next UTC day, and would silently drop off the
// dashboard's "Hoje" filter (which compares against the viewer's local date) until UTC
// caught up. `en-CA` gives YYYY-MM-DD directly.
function dataPedidoFromISO(iso: string | undefined | null): string {
  const d = iso ? new Date(iso) : new Date()
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d)
}

async function getAndRefreshToken(
  db: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string,
  sandbox: boolean,
): Promise<string> {
  // Get stored token row (any row, most recently updated first)
  const { data: row } = await db
    .from('ebay_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.refresh_token) {
    throw new Error('eBay not connected. Click "Conectar eBay" to authorize.')
  }

  // Refresh using the stored refresh_token
  const tokenUrl = `${apiBase(sandbox)}/identity/v1/oauth2/token`
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // No `scope` param here on purpose — matches src/lib/ebay-token.ts. Sending an
    // explicit, narrower scope list than what the user originally granted REPLACES the
    // shared access_token with a downgraded one (missing sell.marketing*,
    // sell.analytics.readonly, sell.inventory, etc.), since this refresh and
    // src/lib/ebay-token.ts's both write the same `ebay_tokens` row. With the cron
    // calling this function every 4h, that was silently stripping permissions other
    // pages (Campaigns, Traffic Report, Send Offer) needed, causing recurring
    // "reconnect needed" errors that a manual reconnect only fixed until the next run.
    // Omitting scope makes eBay return a token with the full originally-consented scope.
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(
      `Token refresh failed (${res.status}): ${err}. ` +
      'Please click "Conectar eBay" to re-authorize.',
    )
  }

  const tok = await res.json() as { access_token: string; expires_in: number }

  // Save updated access token back to DB
  await db.from('ebay_tokens').update({
    access_token: tok.access_token,
    access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)

  return tok.access_token
}

function mapOrderStatus(ebayFulfillmentStatus: string): string {
  const map: Record<string, string> = {
    FULFILLED:     'Enviado',
    DELIVERED:     'Entregue',
    FULLY_SHIPPED: 'Enviado',
    IN_PROGRESS:   'Enviado',
    NOT_STARTED:   'Pronto para Envio',
    PAID:          'Pronto para Envio',
    CANCELLED:     'Cancelado',
  }
  return map[ebayFulfillmentStatus] ?? 'Pronto para Envio'
}

function normalizeCarrier(code: string | null): string | null {
  if (!code) return null
  const c = code.toUpperCase()
  if (c.startsWith('USPS') || c.includes('POSTAL') || c.includes('FIRST_CLASS')) return 'USPS'
  if (c.startsWith('UPS'))   return 'UPS'
  if (c.startsWith('FEDEX') || c.startsWith('FED_EX')) return 'FedEx'
  if (c.startsWith('DHL'))   return 'DHL'
  return code
}

async function fetchPromotedListings(accessToken: string, orderId: string, sandbox: boolean): Promise<number | null> {
  const base = sandbox ? 'https://apiz.sandbox.ebay.com' : 'https://apiz.ebay.com'
  const filter = encodeURIComponent(`orderId:{${orderId}}`)
  try {
    const res = await fetch(`${base}/sell/finances/v1/transaction?filter=${filter}&limit=200`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
    })
    if (!res.ok) return null
    const body = await res.json()
    let adFee = 0
    for (const t of body.transactions ?? []) {
      if (t.feeType === 'AD_FEE') adFee += parseFloat(t.amount?.value ?? '0')
    }
    return Math.round(adFee * 100) / 100
  } catch {
    return null
  }
}

function buildFullAddress(addr: any): string {
  return [
    addr?.addressLine1,
    addr?.addressLine2,
    addr?.city,
    addr?.stateOrProvince,
    addr?.postalCode,
    addr?.countryCode,
  ].filter(Boolean).join(', ')
}

const DIAL_CODES: Record<string, string> = {
  US: '+1', CA: '+1', BR: '+55', GB: '+44', DE: '+49',
  FR: '+33', IT: '+39', ES: '+34', AU: '+61', MX: '+52',
  JP: '+81', CN: '+86', KR: '+82', IN: '+91', RU: '+7',
  SA: '+966', AE: '+971', IL: '+972', SG: '+65', NL: '+31',
}

function formatPhone(phone: string | null, countryCode: string | null): string | null {
  if (!phone) return null
  const t = phone.replace(/\s+/g, '')
  if (t.startsWith('+')) return t
  const dial = DIAL_CODES[(countryCode ?? '').toUpperCase()]
  if (!dial) return phone
  const local = t.replace(/^0+/, '')
  return `${dial}${local}`
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

  // Called two ways: a logged-in admin clicking "Sincronizar eBay" (real user JWT), or
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

  const ebayClientId     = Deno.env.get('EBAY_CLIENT_ID')
  const ebayClientSecret = Deno.env.get('EBAY_CLIENT_SECRET') ?? Deno.env.get('EBAY_CERT_ID')
  const sandbox          = Deno.env.get('EBAY_SANDBOX') === 'true'

  if (!ebayClientId || !ebayClientSecret) {
    return new Response(JSON.stringify({
      error: 'EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (or EBAY_CERT_ID) must be set in Supabase secrets.',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const accessToken = await getAndRefreshToken(db, ebayClientId, ebayClientSecret, sandbox)

    // Sync last 90 days only — historical data before 04/04/2026 was imported via CSV.
    // This avoids Edge Function timeout from chunked multi-year API calls.
    const now    = new Date()
    const oldest = new Date(now)
    oldest.setDate(oldest.getDate() - 90)

    const windows: Array<[Date, Date]> = [[oldest, now]]

    const seen = new Set<string>()
    const ebayOrders: any[] = []

    for (const [from, to] of windows) {
      const fromISO = from.toISOString().split('.')[0] + 'Z'
      const toISO   = to.toISOString().split('.')[0] + 'Z'
      let href: string | null =
        `${apiBase(sandbox)}/sell/fulfillment/v1/order?limit=200&orderBy=CREATION_DATE` +
        `&creationDateRange.from=${encodeURIComponent(fromISO)}` +
        `&creationDateRange.to=${encodeURIComponent(toISO)}`

      while (href) {
        const res = await fetch(href, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          },
        })
        if (!res.ok) {
          console.warn(`[ebay] chunk ${fromISO}→${toISO} failed (${res.status}): ${await res.text()}`)
          break
        }
        const body = await res.json()
        for (const order of body.orders ?? []) {
          if (!seen.has(order.orderId)) {
            seen.add(order.orderId)
            ebayOrders.push(order)
          }
        }
        href = body.next ?? null
      }
    }

    const debugSample = ebayOrders.length > 0 ? {
      orderId: ebayOrders[0].orderId,
      orderFulfillmentStatus: ebayOrders[0].orderFulfillmentStatus,
      fulfillments: ebayOrders[0].fulfillments,
      fulfillmentStartInstructions_shippingStep: ebayOrders[0].fulfillmentStartInstructions?.[0]?.shippingStep,
    } : null

    let newOrders = 0, updatedOrders = 0
    const errors: string[] = []

    for (const eo of ebayOrders) {
      try {
        const orderId: string = eo.orderId

        const fi       = eo.fulfillmentStartInstructions?.[0]
        const shipTo   = fi?.shippingStep?.shipTo
        const addr     = shipTo?.contactAddress ?? {}
        const country  = addr.countryCode ?? null
        const rawPhone = shipTo?.primaryPhone?.phoneNumber ?? null
        const phone    = formatPhone(rawPhone, country)
        const buyerEmail = shipTo?.email ?? eo.buyer?.buyerRegistrationAddress?.email ?? null
        const endereco_completo = buildFullAddress(addr)

        let trackingNum: string | null = null
        let fulfillmentCarrier: string | null = null

        try {
          const sfRes = await fetch(
            `${apiBase(sandbox)}/sell/fulfillment/v1/order/${encodeURIComponent(eo.orderId)}/shipping_fulfillment`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              },
            }
          )
          if (sfRes.ok) {
            const sfBody = await sfRes.json()
            const sf = (sfBody.fulfillments ?? [])[0]
            trackingNum       = sf?.shipmentTrackingNumber ?? null
            fulfillmentCarrier = sf?.shippingCarrierCode ?? null
          }
        } catch (e) {
          console.warn(`[ebay-sync] shipping_fulfillment fetch failed for ${eo.orderId}:`, e)
        }

        // `fi?.shippingStep?.shippingCarrierCode` (fulfillmentStartInstructions) is only the
        // buyer's/eBay's SUGGESTED carrier for the order — not a real shipment. Using it as a
        // fallback made every fresh order show a carrier (e.g. "UPS") before any label had
        // actually been bought. `fulfillmentCarrier`, from the shipping_fulfillment endpoint
        // above, only exists once a real fulfillment (our label or an eBay-managed one) does.
        const carrier = fulfillmentCarrier

        const ps = eo.pricingSummary ?? {}
        const total       = parseFloat(ps.priceSubtotal?.value ?? ps.total?.value ?? '0')
        const frete_total = parseFloat(ps.deliveryCost?.value ?? '0') + parseFloat(ps.deliveryDiscount?.value ?? '0')
        let impostos = 0
        for (const li of eo.lineItems ?? []) {
          for (const tax of li.ebayCollectAndRemitTaxes ?? []) {
            impostos += parseFloat(tax.amount?.value ?? tax.taxAmount?.value ?? '0')
          }
        }
        if (impostos === 0) impostos = parseFloat(ps.tax?.value ?? '0')
        const descontos  = Math.abs(parseFloat(ps.priceDiscount?.value ?? '0'))
        // Total WITHOUT tax — tax is stored separately (impostos) and treated as
        // informational only (never part of the total or profit), matching the app's
        // single calc source (src/lib/order-calc.ts). Keeping tax in the total here would
        // make every synced eBay order trip the "total doesn't reconcile" review flag.
        const finalTotal = total + frete_total - descontos

        const comissao_ebay = parseFloat(eo.totalMarketplaceFee?.value ?? '0')
        const promoted_listings = await fetchPromotedListings(accessToken, eo.orderId, sandbox)

        const isCancelled    = eo.cancelStatus?.cancelState === 'CANCELED'
        const status         = isCancelled ? 'Cancelado' : mapOrderStatus(eo.orderFulfillmentStatus ?? '')
        const ebayFulfStatus = eo.orderFulfillmentStatus ?? ''
        const isFullyPaid    = ['FULLY_PAID', 'PAID'].includes(eo.orderPaymentStatus ?? '')

        // ── Client upsert ──
        // Dedupe key is the structured `ebay_username` column (unique index), not a
        // string pattern inside `observacoes` — a free-text format that drifted between
        // deployments in the past (e.g. "eBay buyer: {user}" -> "eBay:{user}") silently
        // broke this lookup and created a fresh duplicate client per buyer. observacoes
        // is still set for human-readable display, but is never matched against.
        let clientId: string | null = null
        const username = eo.buyer?.username as string | undefined
        if (username) {
          const { data: ex } = await db
            .from('clients')
            .select('id')
            .eq('ebay_username', username)
            .maybeSingle()

          if (ex) {
            clientId = ex.id
            const upd: Record<string, any> = {}
            if (shipTo?.fullName) upd.nome_razao  = shipTo.fullName
            if (phone)            upd.telefone     = phone
            if (buyerEmail)       upd.email        = buyerEmail
            if (country)          upd.endereco_pais = country
            if (addr.city)               upd.endereco_cidade  = addr.city
            if (addr.stateOrProvince)    upd.endereco_estado  = addr.stateOrProvince
            if (addr.postalCode)         upd.endereco_cep     = addr.postalCode
            if (addr.addressLine1)       upd.endereco_rua     = addr.addressLine1
            if (Object.keys(upd).length > 0) {
              await db.from('clients').update(upd).eq('id', ex.id)
            }
          } else {
            const { data: nc } = await db.from('clients').insert({
              nome_razao:       shipTo?.fullName ?? username,
              canal_principal:  'eBay',
              observacoes:      `eBay:${username}`,
              ebay_username:    username,
              tipo:             'Cliente Final',
              telefone:         phone,
              email:            buyerEmail,
              endereco_cep:     addr.postalCode   ?? null,
              endereco_cidade:  addr.city         ?? null,
              endereco_estado:  addr.stateOrProvince ?? null,
              endereco_pais:    country           ?? 'US',
              endereco_rua:     addr.addressLine1 ?? null,
            }).select('id').single()
            clientId = nc?.id ?? null
          }
        }

        const { data: existing } = await db
          .from('orders')
          .select('id, ebay_status_manual, funds_available_manual')
          .eq('canal', 'eBay')
          .eq('numero_pedido_canal', orderId)
          .maybeSingle()

        if (existing) {
          const upd: Record<string, any> = {
            total:              finalTotal,
            frete_total,
            impostos,
            descontos,
            comissao_ebay,
            client_id:          clientId,
            buyer_email:        buyerEmail,
            country,
            endereco_completo:  endereco_completo || null,
            updated_at:         new Date().toISOString(),
          }
          if (promoted_listings !== null) upd.promoted_listings = promoted_listings
          if (trackingNum) upd.shipping_tracking = trackingNum
          if (carrier)     upd.carrier = normalizeCarrier(carrier)
          if (!existing.ebay_status_manual) {
            upd.status               = status
            upd.ebay_fulfillment_status = ebayFulfStatus
          }
          if (!existing.funds_available_manual) {
            upd.funds_available = isFullyPaid
          }
          await db.from('orders').update(upd).eq('id', existing.id)
          updatedOrders++

          await upsertLineItems(db, existing.id, eo.lineItems ?? [])
        } else {
          const { data: newOrder, error: insertErr } = await db.from('orders').insert({
            canal:                  'eBay',
            numero_pedido_canal:    orderId,
            data_pedido:            dataPedidoFromISO(eo.creationDate),
            status,
            ebay_fulfillment_status: ebayFulfStatus,
            funds_available:        isFullyPaid,
            funds_available_manual: false,
            ebay_status_manual:     false,
            total:                  finalTotal,
            frete_total,
            impostos,
            descontos,
            comissao_ebay,
            promoted_listings:      promoted_listings ?? 0,
            diferente:              0,
            client_id:              clientId,
            forma_pagamento:        eo.paymentSummary?.payments?.[0]?.paymentMethod ?? null,
            shipping_tracking:      trackingNum,
            carrier:                normalizeCarrier(carrier),
            buyer_email:            buyerEmail,
            country,
            endereco_completo:      endereco_completo || null,
            observacoes:            username ? `eBay: ${username}` : null,
          }).select('id').single()

          if (insertErr) throw insertErr
          await upsertLineItems(db, newOrder!.id, eo.lineItems ?? [])
          newOrders++
        }
      } catch (err) {
        errors.push(`${eo.orderId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return new Response(JSON.stringify({
      success:         true,
      new_orders:      newOrders,
      updated_orders:  updatedOrders,
      total_from_ebay: ebayOrders.length,
      errors:          errors.length ? errors : undefined,
      debug_sample:    debugSample,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Order items helper ───────────────────────────────────────────────────────
//
// Used to delete-and-reinsert every line item on every sync, matching a product only
// by SKU. Two problems: (1) product_id was NOT NULL, so a single unmatched SKU (eBay
// listing has none) made the whole insert batch fail silently — the order ended up
// with zero items instead of just one unresolved line; (2) even when it worked, it
// wiped out any product a human had manually attached to a line item on a previous
// visit, since the delete ran unconditionally before the reinsert.
//
// Now it upserts per line, anchored on eBay's own `lineItemId` (stable for the life of
// the order) so re-syncing only refreshes eBay-owned fields (qty/price/tax) and never
// touches a product_id that's already resolved — manually or via SKU.
async function upsertLineItems(
  db: ReturnType<typeof createClient>,
  orderId: string,
  lineItems: any[],
) {
  // An empty response from eBay almost certainly means an API hiccup, not "this order
  // now has no items" — leave whatever is already in the DB alone rather than wiping it.
  if (lineItems.length === 0) return

  const { data: existingRows } = await db
    .from('order_items')
    .select('id, product_id, sku, ebay_line_item_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  const existing = existingRows ?? []

  const byLineItemId = new Map(
    existing.filter((r) => r.ebay_line_item_id).map((r) => [r.ebay_line_item_id as string, r])
  )
  // Rows created before this fix have no ebay_line_item_id yet — reconcile them once,
  // in order, so a manually-assigned product_id on an old order survives its next sync.
  const legacy = existing.filter((r) => !r.ebay_line_item_id)
  let legacyIdx = 0

  const matchedIds = new Set<string>()

  for (const li of lineItems) {
    const liId: string | undefined = li.lineItemId
    const row = (liId && byLineItemId.get(liId)) || legacy[legacyIdx++] || null

    let productId: string | null = row?.product_id ?? null
    if (!productId && li.sku) {
      const { data: prod } = await db
        .from('products')
        .select('id')
        .eq('SKU', li.sku)
        .maybeSingle()
      productId = prod?.id ?? null
    }

    const fields = {
      sku:              li.sku ?? row?.sku ?? null,
      quantidade:       li.quantity ?? 1,
      preco_unitario:   parseFloat(li.lineItemCost?.value ?? li.discountedLineItemCost?.value ?? '0') / (li.quantity || 1),
      imposto_unitario: parseFloat((li.ebayCollectAndRemitTaxes?.[0]?.amount?.value ?? li.ebayCollectAndRemitTaxes?.[0]?.taxAmount?.value) ?? '0'),
      ebay_line_item_id: liId ?? row?.ebay_line_item_id ?? null,
      product_id:       productId,
    }

    if (row) {
      matchedIds.add(row.id)
      const { error } = await db.from('order_items').update(fields).eq('id', row.id)
      if (error) console.warn('[order_items] update error:', error.message)
    } else {
      const { error } = await db.from('order_items').insert({
        order_id: orderId,
        custo_unitario: 0,
        frete_unitario: 0,
        ...fields,
      })
      if (error) console.warn('[order_items] insert error:', error.message)
    }
  }

  // Only drop rows that were unambiguously ours from a previous sync (had a
  // lineItemId) and that eBay no longer reports — never touch legacy/unmatched rows.
  const staleIds = existing
    .filter((r) => r.ebay_line_item_id && !matchedIds.has(r.id))
    .map((r) => r.id)
  if (staleIds.length > 0) {
    await db.from('order_items').delete().in('id', staleIds)
  }
}
