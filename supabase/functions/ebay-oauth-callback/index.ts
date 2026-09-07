import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://wlynwymobvcwxjpozkqi.supabase.co'
const REDIRECT_BASE = Deno.env.get('EBAY_APP_URL') || 'http://localhost:5173'

/** Only a same-origin relative path coming back in `state` is trusted as the return
 *  page — anything else (missing, a full URL, protocol-relative "//host") falls back
 *  to /admin/orders, so eBay's own redirect can never be turned into an open redirect. */
function safeReturnPath(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/admin/orders'
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error')
  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true'
  const returnPath = safeReturnPath(url.searchParams.get('state'))
  const joiner = returnPath.includes('?') ? '&' : '?'

  const successUrl = `${REDIRECT_BASE}${returnPath}${joiner}ebay_connected=true`
  const errorUrl = (msg: string) => `${REDIRECT_BASE}${returnPath}${joiner}ebay_error=${encodeURIComponent(msg)}`

  if (errorParam) {
    return Response.redirect(errorUrl(errorParam), 302)
  }
  if (!code) {
    return Response.redirect(errorUrl('Missing authorization code'), 302)
  }

  const clientId = Deno.env.get('EBAY_CLIENT_ID')
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET') ?? Deno.env.get('EBAY_CERT_ID')
  const callbackUrl = Deno.env.get('EBAY_RUNAME') ?? `${SUPABASE_URL}/functions/v1/ebay-oauth-callback`

  if (!clientId || !clientSecret) {
    return Response.redirect(errorUrl('eBay credentials not configured in Supabase secrets'), 302)
  }

  try {
    const tokenUrl = sandbox
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token'

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }).toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      return Response.redirect(errorUrl(`Token exchange failed: ${err}`), 302)
    }

    const tokenData = await res.json()
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    const env = sandbox ? 'sandbox' : 'production'

    const db = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: existing } = await db
      .from('ebay_tokens')
      .select('id')
      .eq('environment', env)
      .maybeSingle()

    if (existing) {
      await db.from('ebay_tokens').update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        access_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
        // A fresh, successful connect means whatever broke before no longer applies —
        // without this, the raw column kept showing the old error forever after the
        // first-ever failure (src/app/api/ebay/status/route.ts works around it by
        // comparing timestamps, but the row itself stayed misleading to anyone reading
        // it directly).
        last_refresh_error: null,
        last_refresh_error_at: null,
      }).eq('id', existing.id)
    } else {
      await db.from('ebay_tokens').insert({
        environment: env,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        access_token_expires_at: expiresAt,
      })
    }

    return Response.redirect(successUrl, 302)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.redirect(errorUrl(msg), 302)
  }
})
