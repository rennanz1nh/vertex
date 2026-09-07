import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tiktokShopRequest } from '../_shared/tiktok-shop.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const REDIRECT_BASE = Deno.env.get('TIKTOK_SHOP_APP_URL') || 'http://localhost:5173'

function safeReturnPath(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/admin/automations/tiktok-shop/orders'
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error')
  const returnPath = safeReturnPath(url.searchParams.get('state'))
  const joiner = returnPath.includes('?') ? '&' : '?'

  const successUrl = `${REDIRECT_BASE}${returnPath}${joiner}tiktok_connected=true`
  const errorUrl = (msg: string) => `${REDIRECT_BASE}${returnPath}${joiner}tiktok_error=${encodeURIComponent(msg)}`

  if (errorParam) {
    return Response.redirect(errorUrl(errorParam), 302)
  }
  if (!code) {
    return Response.redirect(errorUrl('Missing authorization code'), 302)
  }

  const appKey = Deno.env.get('TIKTOK_SHOP_APP_KEY')
  const appSecret = Deno.env.get('TIKTOK_SHOP_APP_SECRET')

  if (!appKey || !appSecret) {
    return Response.redirect(errorUrl('TikTok Shop credentials not configured in Supabase secrets'), 302)
  }

  try {
    const params = new URLSearchParams({
      app_key: appKey,
      app_secret: appSecret,
      auth_code: code,
      grant_type: 'authorized_code',
    })
    const res = await fetch(`https://auth.tiktok-shops.com/api/v2/token/get?${params.toString()}`)
    const body = await res.json()

    if (!res.ok || body.code !== 0) {
      return Response.redirect(errorUrl(`Token exchange failed: ${JSON.stringify(body)}`), 302)
    }

    const tok = body.data
    const accessTokenExpiresAt = new Date(Date.now() + tok.access_token_expire_in * 1000).toISOString()
    const refreshTokenExpiresAt = new Date(Date.now() + tok.refresh_token_expire_in * 1000).toISOString()

    const db = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Fetch which shop(s) this authorization actually grants access to — TikTok Shop
    // API calls need shop_cipher (not just the access token), so this has to happen
    // once up front, right after the token exchange.
    let shopId: string | null = null
    let shopCipher: string | null = null
    let shopName: string | null = null
    try {
      const shopsData = await tiktokShopRequest<{ shops: Array<{ id: string; cipher: string; name: string }> }>(
        { access_token: tok.access_token, refresh_token: tok.refresh_token, access_token_expires_at: accessTokenExpiresAt, shop_id: null, shop_cipher: null } as any,
        appKey,
        appSecret,
        { path: '/authorization/202309/shops' },
      )
      const shop = shopsData.shops?.[0]
      shopId = shop?.id ?? null
      shopCipher = shop?.cipher ?? null
      shopName = shop?.name ?? null
    } catch (e) {
      console.warn('[tiktok-shop-oauth-callback] failed to fetch authorized shops:', e)
    }

    const env = 'production'
    const { data: existing } = await db.from('tiktok_shop_tokens').select('id').eq('environment', env).maybeSingle()

    const row = {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token_expires_at: refreshTokenExpiresAt,
      open_id: tok.open_id ?? null,
      seller_name: tok.seller_name ?? null,
      shop_id: shopId,
      shop_cipher: shopCipher,
      shop_name: shopName,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await db.from('tiktok_shop_tokens').update(row).eq('id', existing.id)
    } else {
      await db.from('tiktok_shop_tokens').insert({ environment: env, ...row })
    }

    return Response.redirect(successUrl, 302)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.redirect(errorUrl(msg), 302)
  }
})
