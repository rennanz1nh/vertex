import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ebay-signature-256',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only POST is allowed
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.text()

    // Parse body if JSON, otherwise ignore parse errors
    let deletionData: any = {}
    try { deletionData = JSON.parse(body) } catch { /* non-JSON body is ok */ }

    console.log('eBay account deletion notification received:', JSON.stringify(deletionData))

    // eBay challenge response (GET verification request)
    // eBay may send a GET with ?challenge_code=xxx to verify the endpoint
    const url = new URL(req.url)
    const challengeCode = url.searchParams.get('challenge_code')
    if (challengeCode) {
      const verificationToken = Deno.env.get('EBAY_DELETION_VERIFICATION_TOKEN') || ''
      const endpoint = url.toString().split('?')[0]
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(challengeCode + verificationToken + endpoint)
      )
      const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
      return new Response(JSON.stringify({ challengeResponse: hashHex }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Try to log to Supabase, but never let DB errors fail the 200 response
    try {
      const db = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await db.from('ebay_deletion_notifications').insert({
        payload: deletionData,
        received_at: new Date().toISOString(),
      })
    } catch (dbErr) {
      console.warn('DB log failed (non-fatal):', dbErr)
    }

    // Always return 200 to keep eBay compliance
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    // Still return 200 to avoid eBay marking endpoint as down
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
