const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Only a same-origin relative path is accepted as a return target — anything else
 *  (a full URL, protocol-relative "//host", or missing) falls back to the default page
 *  in ebay-oauth-callback, so this can never be turned into an open redirect. */
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

  const clientId = Deno.env.get('EBAY_CLIENT_ID')
  const ruName = Deno.env.get('EBAY_RUNAME')
  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true'

  if (!clientId || !ruName) {
    return new Response(JSON.stringify({ error: 'EBAY_CLIENT_ID and EBAY_RUNAME must be set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authBase = sandbox
    ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
    : 'https://auth.ebay.com/oauth2/authorize'

  const scope = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.finances',
    'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    // Required by the Negotiation API (find_eligible_items / send_offer_to_interested_buyers)
    // used by the "Send Offer" page — added later than the scopes above, so an account
    // connected before this needs to reconnect once for eBay to re-consent with it.
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: ruName,
    scope,
    ...(returnTo ? { state: returnTo } : {}),
  })

  return new Response(JSON.stringify({ url: `${authBase}?${params.toString()}` }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
