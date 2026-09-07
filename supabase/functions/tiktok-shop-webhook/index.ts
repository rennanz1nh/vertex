// ─── tiktok-shop-webhook Edge Function ───────────────────────────────────────
// Public receiver for TikTok Shop push notifications (order created, order status
// changed, package status changed). This is the piece eBay's integration doesn't
// have at all — eBay is pull-only, TikTok Shop pushes events in near-real-time, so
// orders show up here without waiting on a cron/manual sync. tiktok-shop-sync stays
// in place as a fallback for anything a missed webhook delivery would otherwise lose.
//
// Register this function's URL (https://<project>.supabase.co/functions/v1/tiktok-shop-webhook)
// as the webhook endpoint in TikTok Shop Partner Center, event types: order_status_change
// and package_status_change at minimum.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getAndRefreshTikTokShopToken, tiktokShopRequest, upsertTikTokShopOrder } from '../_shared/tiktok-shop.ts'

async function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  if (!signatureHeader) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return computed === signatureHeader
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const rawBody = await req.text()
  const webhookSecret = Deno.env.get('TIKTOK_SHOP_WEBHOOK_SECRET')
  const signatureHeader = req.headers.get('tts-signature')

  if (webhookSecret) {
    const valid = await verifySignature(rawBody, signatureHeader, webhookSecret)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const payload = JSON.parse(rawBody) as { type: number; shop_id: string; data: Record<string, unknown> }
  const orderId = payload.data?.order_id as string | undefined

  // Always 200 back to TikTok even when we skip/no-op — a non-2xx makes TikTok
  // retry the same event repeatedly, which we don't want for events we don't act on.
  if (!orderId) {
    return new Response(JSON.stringify({ received: true, skipped: 'no order_id in payload' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const appKey = Deno.env.get('TIKTOK_SHOP_APP_KEY')
  const appSecret = Deno.env.get('TIKTOK_SHOP_APP_SECRET')

  if (!appKey || !appSecret) {
    return new Response(JSON.stringify({ error: 'TIKTOK_SHOP_APP_KEY/TIKTOK_SHOP_APP_SECRET not configured' }), {
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
      return new Response(JSON.stringify({ received: true, skipped: `order ${orderId} not found` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await upsertTikTokShopOrder(db, order)
    return new Response(JSON.stringify({ received: true, order_id: orderId, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Log but still 200 — a transient TikTok API hiccup shouldn't turn into an
    // endless retry storm; the next tiktok-shop-sync run will pick this order up.
    console.error('[tiktok-shop-webhook] failed to process order', orderId, err)
    return new Response(JSON.stringify({ received: true, error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
