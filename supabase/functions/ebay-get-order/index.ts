// ─── ebay-get-order Edge Function ────────────────────────────────────────────
// Read-only lookup of a single eBay order by its orderId, straight from eBay's
// API — unlike ebay-sync's bulk listing endpoint, this isn't limited to the
// last 90 days, so it can recover the original line items for old orders that
// lost their product links (e.g. a historical CSV import that dropped a line).
// Never writes to the database. Same auth requirement as ebay-sync: a real,
// logged-in Supabase session — this must never be callable anonymously, since
// it returns buyer PII (name, address, phone, email) from our eBay account.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function apiBase(sandbox: boolean) {
  return sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
}

async function getAndRefreshToken(
  db: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string,
  sandbox: boolean,
): Promise<string> {
  const { data: row } = await db
    .from('ebay_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.refresh_token) {
    throw new Error('eBay not connected. Click "Conectar eBay" to authorize.')
  }

  const tokenUrl = `${apiBase(sandbox)}/identity/v1/oauth2/token`
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // No `scope` param here on purpose — see ebay-sync/index.ts for why. Omitting it
    // makes eBay return a token with the full originally-consented scope instead of
    // silently downgrading the shared ebay_tokens row every time this refreshes.
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${err}. Please click "Conectar eBay" to re-authorize.`)
  }

  const tok = await res.json() as { access_token: string; expires_in: number }

  await db.from('ebay_tokens').update({
    access_token: tok.access_token,
    access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)

  return tok.access_token
}

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

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
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

    const res = await fetch(
      `${apiBase(sandbox)}/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: `eBay API ${res.status}: ${err}` }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const order = await res.json()
    return new Response(JSON.stringify({
      orderId: order.orderId,
      buyer: order.buyer,
      pricingSummary: order.pricingSummary,
      lineItems: order.lineItems,
      cancelStatus: order.cancelStatus,
      orderFulfillmentStatus: order.orderFulfillmentStatus,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
