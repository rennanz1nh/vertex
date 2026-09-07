// ─── tiktok-shop-sync Edge Function ──────────────────────────────────────────
// Pull-based fallback for order sync — TikTok Shop mostly pushes order events via
// tiktok-shop-webhook, but this covers the gap for any event the webhook missed
// (delivery isn't 100% guaranteed) and the initial backfill after connecting.
// DB columns used: tiktok_fulfillment_status, tiktok_status_manual, comissao_tiktok.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getAndRefreshTikTokShopToken, tiktokShopRequest, upsertTikTokShopOrder } from '../_shared/tiktok-shop.ts'

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

  // Called two ways: a logged-in admin clicking "Sincronizar Pedidos" (real user JWT),
  // or the daily cron fallback route authenticating with the service role key directly.
  const token = authHeader.replace('Bearer ', '')
  const isServiceRoleCall = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!isServiceRoleCall) {
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { error: authErr } = await anonClient.auth.getUser(token)
    if (authErr) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const appKey = Deno.env.get('TIKTOK_SHOP_APP_KEY')
  const appSecret = Deno.env.get('TIKTOK_SHOP_APP_SECRET')
  if (!appKey || !appSecret) {
    return new Response(JSON.stringify({ error: 'TIKTOK_SHOP_APP_KEY and TIKTOK_SHOP_APP_SECRET must be set in Supabase secrets.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const tok = await getAndRefreshTikTokShopToken(db, appKey, appSecret)

    // Last 30 days — same rationale as ebay-sync's 90-day window: bound the request
    // size so this stays well inside the Edge Function timeout.
    const now = Math.floor(Date.now() / 1000)
    const from = now - 30 * 24 * 60 * 60

    let pageToken: string | undefined
    const orders: any[] = []
    do {
      const data = await tiktokShopRequest<{ orders: any[]; next_page_token?: string }>(tok, appKey, appSecret, {
        path: '/order/202309/orders/search',
        method: 'POST',
        query: { page_size: '50', ...(pageToken ? { page_token: pageToken } : {}) },
        body: { create_time_ge: from, create_time_lt: now },
      })
      orders.push(...(data.orders ?? []))
      pageToken = data.next_page_token || undefined
    } while (pageToken)

    let inserted = 0, updated = 0
    const errors: string[] = []

    for (const order of orders) {
      try {
        const result = await upsertTikTokShopOrder(db, order)
        if (result === 'inserted') inserted++
        else updated++
      } catch (err) {
        errors.push(`${order.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      new_orders: inserted,
      updated_orders: updated,
      total_from_tiktok: orders.length,
      errors: errors.length ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
