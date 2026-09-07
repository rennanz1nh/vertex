const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Only a same-origin relative path is accepted as a return target — anything else
 *  falls back to the default page in tiktok-shop-oauth-callback, so this can never
 *  be turned into an open redirect. */
function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.json().catch(() => ({})) as { returnTo?: unknown }
  const returnTo = safeReturnTo(body?.returnTo)

  // TikTok Shop's OAuth entry point takes the Partner Center "service_id" for this
  // app, not a client_id/redirect_uri pair — the redirect URL is fixed in Partner
  // Center itself, so the only thing we pass through is `state` (our return path).
  const serviceId = Deno.env.get('TIKTOK_SHOP_SERVICE_ID')

  if (!serviceId) {
    return new Response(JSON.stringify({ error: 'TIKTOK_SHOP_SERVICE_ID must be set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const params = new URLSearchParams({
    service_id: serviceId,
    ...(returnTo ? { state: returnTo } : {}),
  })

  return new Response(JSON.stringify({ url: `https://services.tiktokshop.com/open/authorize?${params.toString()}` }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
