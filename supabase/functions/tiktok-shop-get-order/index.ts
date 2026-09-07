// ─── tiktok-shop-get-order Edge Function ─────────────────────────────────────
// Read-only lookup of a single TikTok Shop order straight from TikTok's API —
// used to recover full buyer/line-item detail for an order without waiting on
// the next sync/webhook. Requires a real, logged-in Supabase session: this
// returns buyer PII (name, address, phone) and must never be callable anonymously.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getAndRefreshTikTokShopToken, tiktokShopRequest } from '../_shared/tiktok-shop.ts'

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

  const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { error: authErr } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const orderId = url.searchParams.get('orderId')
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Missing ?orderId=' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
    const data = await tiktokShopRequest<{ orders: any[] }>(tok, appKey, appSecret, {
      path: '/order/202309/orders',
      query: { ids: orderId },
    })
    const order = data.orders?.[0]
    if (!order) {
      return new Response(JSON.stringify({ error: `Order ${orderId} not found` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ order }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
