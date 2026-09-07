// ─── Shared TikTok Shop helpers ───────────────────────────────────────────────
// Used by tiktok-shop-sync, tiktok-shop-webhook and tiktok-shop-get-order so the
// signing algorithm, token refresh and order→DB mapping only live in one place —
// TikTok Shop (unlike eBay/Amazon here) has three functions that all need to fetch
// and upsert the same order shape, so duplicating it three times would drift fast.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, tts-signature',
}

const API_BASE = 'https://open-api.tiktokglobalshop.com'

/** HMAC-SHA256 over Web Crypto (Deno-native, no npm crypto needed). */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signTikTokShopRequest(path: string, query: Record<string, string>, body: string | undefined, appSecret: string): Promise<string> {
  const sortedKeys = Object.keys(query).filter((k) => k !== 'sign' && k !== 'access_token').sort()
  let input = path
  for (const key of sortedKeys) input += key + query[key]
  if (body) input += body
  return hmacSha256Hex(appSecret, appSecret + input + appSecret)
}

type TokenRow = {
  id: string
  access_token: string
  refresh_token: string
  access_token_expires_at: string | null
  shop_id: string | null
  shop_cipher: string | null
}

/** Fetches the stored token row and refreshes it if it's expired (or about to be). */
export async function getAndRefreshTikTokShopToken(
  db: ReturnType<typeof createClient>,
  appKey: string,
  appSecret: string,
): Promise<TokenRow> {
  const { data: row } = await db
    .from('tiktok_shop_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.refresh_token) {
    throw new Error('TikTok Shop not connected. Click "Conectar TikTok Shop" to authorize.')
  }

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0
  if (expiresAt > Date.now() + 60_000) {
    return row
  }

  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: row.refresh_token,
    grant_type: 'refresh_token',
  })
  const res = await fetch(`https://auth.tiktok-shops.com/api/v2/token/refresh?${params.toString()}`)
  const body = await res.json().catch(() => null)

  if (!res.ok || !body || body.code !== 0) {
    throw new Error(`TikTok Shop token refresh failed: ${JSON.stringify(body ?? { status: res.status })}`)
  }

  const tok = body.data
  const newExpiresAt = new Date(Date.now() + tok.access_token_expire_in * 1000).toISOString()

  await db.from('tiktok_shop_tokens').update({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    access_token_expires_at: newExpiresAt,
    refresh_token_expires_at: new Date(Date.now() + tok.refresh_token_expire_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)

  return { ...row, access_token: tok.access_token, refresh_token: tok.refresh_token, access_token_expires_at: newExpiresAt }
}

/** Signed call to any TikTok Shop Partner API endpoint. */
export async function tiktokShopRequest<T = any>(
  token: TokenRow,
  appKey: string,
  appSecret: string,
  opts: { path: string; method?: string; query?: Record<string, string>; body?: unknown },
): Promise<T> {
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  const baseQuery: Record<string, string> = {
    app_key: appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
    shop_cipher: token.shop_cipher ?? '',
    ...(opts.query ?? {}),
  }
  const sign = await signTikTokShopRequest(opts.path, baseQuery, bodyStr, appSecret)
  const fullQuery = new URLSearchParams({ ...baseQuery, sign })

  const res = await fetch(`${API_BASE}${opts.path}?${fullQuery.toString()}`, {
    method: opts.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', 'x-tts-access-token': token.access_token },
    body: bodyStr,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.code !== 0) {
    throw new Error(json?.message ?? `TikTok Shop API error (${res.status})`)
  }
  return json.data as T
}

export function mapTikTokOrderStatus(status: string): string {
  const map: Record<string, string> = {
    UNPAID: 'Aguardando Pagamento',
    ON_HOLD: 'Pronto para Envio',
    AWAITING_SHIPMENT: 'Pronto para Envio',
    AWAITING_COLLECTION: 'Pronto para Envio',
    PARTIALLY_SHIPPING: 'Enviado',
    IN_TRANSIT: 'Enviado',
    DELIVERED: 'Entregue',
    COMPLETED: 'Entregue',
    CANCELLED: 'Cancelado',
  }
  return map[status] ?? 'Pronto para Envio'
}

/** Upserts one TikTok Shop order (+ its line items) into `orders`/`order_items`. Shared by tiktok-shop-sync (bulk) and tiktok-shop-webhook (single order, on push events). */
export async function upsertTikTokShopOrder(db: ReturnType<typeof createClient>, order: any): Promise<'inserted' | 'updated'> {
  const orderId: string = order.id
  const recipient = order.recipient_address ?? {}
  const status = mapTikTokOrderStatus(order.status)
  const shippingProvider = order.shipping_provider_name ?? null
  const trackingNum = order.tracking_number ?? null

  let clientId: string | null = null
  const buyerEmail: string | null = order.buyer_email ?? null
  if (buyerEmail || recipient.name) {
    const { data: ex } = await db.from('clients').select('id').eq('email', buyerEmail ?? '__none__').maybeSingle()
    if (ex) {
      clientId = ex.id
    } else {
      const { data: nc } = await db.from('clients').insert({
        nome_razao: recipient.name ?? 'Cliente TikTok Shop',
        canal_principal: 'TikTok Shop',
        observacoes: `TikTok Shop order ${orderId}`,
        tipo: 'Cliente Final',
        telefone: recipient.phone_number ?? null,
        email: buyerEmail,
        endereco_cep: recipient.zipcode ?? null,
        endereco_cidade: recipient.city ?? null,
        endereco_estado: recipient.state ?? null,
        endereco_pais: recipient.region_code ?? 'US',
        endereco_rua: recipient.address_line1 ?? null,
      }).select('id').single()
      clientId = nc?.id ?? null
    }
  }

  const total = parseFloat(order.payment?.total_amount ?? '0')
  const frete_total = parseFloat(order.payment?.shipping_fee ?? '0')
  const impostos = parseFloat(order.payment?.tax ?? '0')
  const descontos = Math.abs(parseFloat(order.payment?.seller_discount ?? '0') + parseFloat(order.payment?.platform_discount ?? '0'))
  const comissao_tiktok = parseFloat(order.payment?.platform_fee ?? '0') + parseFloat(order.payment?.commission_fee ?? '0')

  const { data: existing } = await db
    .from('orders')
    .select('id, tiktok_status_manual')
    .eq('canal', 'TikTok Shop')
    .eq('numero_pedido_canal', orderId)
    .maybeSingle()

  const endereco_completo = [recipient.address_line1, recipient.address_line2, recipient.city, recipient.state, recipient.zipcode, recipient.region_code]
    .filter(Boolean).join(', ')

  let dbOrderId: string
  let result: 'inserted' | 'updated'

  if (existing) {
    const upd: Record<string, any> = {
      total, frete_total, impostos, descontos,
      client_id: clientId,
      buyer_email: buyerEmail,
      country: recipient.region_code ?? null,
      endereco_completo: endereco_completo || null,
      tiktok_fulfillment_status: order.status,
      shipping_tracking: trackingNum,
      carrier: shippingProvider,
      updated_at: new Date().toISOString(),
    }
    if (!existing.tiktok_status_manual) upd.status = status
    await db.from('orders').update(upd).eq('id', existing.id)
    dbOrderId = existing.id
    result = 'updated'
  } else {
    const { data: newOrder, error } = await db.from('orders').insert({
      canal: 'TikTok Shop',
      numero_pedido_canal: orderId,
      data_pedido: order.create_time ? new Date(order.create_time * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status,
      tiktok_fulfillment_status: order.status,
      total, frete_total, impostos, descontos,
      comissao_tiktok,
      diferente: 0,
      client_id: clientId,
      forma_pagamento: 'TikTok Shop',
      shipping_tracking: trackingNum,
      carrier: shippingProvider,
      buyer_email: buyerEmail,
      country: recipient.region_code ?? null,
      endereco_completo: endereco_completo || null,
      observacoes: `TikTok Shop: ${orderId}`,
    }).select('id').single()
    if (error) throw error
    dbOrderId = newOrder!.id
    result = 'inserted'
  }

  await upsertTikTokShopLineItems(db, dbOrderId, order.line_items ?? [])
  return result
}

async function upsertTikTokShopLineItems(db: ReturnType<typeof createClient>, orderId: string, lineItems: any[]) {
  if (lineItems.length === 0) return

  const { data: existingRows } = await db
    .from('order_items')
    .select('id, product_id, sku, tiktok_line_item_id')
    .eq('order_id', orderId)
  const existing = existingRows ?? []
  const byLineItemId = new Map(existing.filter((r) => r.tiktok_line_item_id).map((r) => [r.tiktok_line_item_id as string, r]))
  const matchedIds = new Set<string>()

  for (const li of lineItems) {
    const liId: string | undefined = li.id
    const row = (liId && byLineItemId.get(liId)) || null

    let productId: string | null = row?.product_id ?? null
    if (!productId && li.seller_sku) {
      const { data: prod } = await db.from('products').select('id').eq('SKU', li.seller_sku).maybeSingle()
      productId = prod?.id ?? null
    }

    const fields = {
      sku: li.seller_sku ?? row?.sku ?? null,
      quantidade: 1,
      preco_unitario: parseFloat(li.sale_price ?? '0'),
      imposto_unitario: 0,
      tiktok_line_item_id: liId ?? row?.tiktok_line_item_id ?? null,
      product_id: productId,
    }

    if (row) {
      matchedIds.add(row.id)
      await db.from('order_items').update(fields).eq('id', row.id)
    } else {
      await db.from('order_items').insert({ order_id: orderId, custo_unitario: 0, frete_unitario: 0, ...fields })
    }
  }

  const staleIds = existing.filter((r) => r.tiktok_line_item_id && !matchedIds.has(r.id)).map((r) => r.id)
  if (staleIds.length > 0) {
    await db.from('order_items').delete().in('id', staleIds)
  }
}
