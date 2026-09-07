import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Require authentication
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const USPS_USER_ID = Deno.env.get('USPS_USER_ID')
  if (!USPS_USER_ID) {
    return new Response(JSON.stringify({ error: 'USPS_USER_ID not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { tracking_number } = await req.json()
    if (!tracking_number || typeof tracking_number !== 'string') {
      return new Response(JSON.stringify({ error: 'tracking_number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate format: USPS tracking numbers are alphanumeric, 10-34 chars
    const normalized = tracking_number.trim().toUpperCase()
    if (!/^[A-Z0-9]{10,34}$/.test(normalized)) {
      return new Response(JSON.stringify({ error: 'Invalid tracking number format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const xml = `<TrackFieldRequest USERID="${USPS_USER_ID}"><TrackID ID="${normalized}"></TrackID></TrackFieldRequest>`
    const url = `https://secure.shippingapis.com/ShippingAPI.dll?API=TrackV2&XML=${encodeURIComponent(xml)}`

    const response = await fetch(url)
    const text = await response.text()

    let status = 'unknown'
    let statusDetail = ''
    let location = ''
    let events: Array<{ date: string; time: string; event: string; city: string; state: string }> = []

    const errorMatch = text.match(/<Description>(.*?)<\/Description>/)
    if (text.includes('<Error>') && errorMatch) {
      return new Response(JSON.stringify({
        tracking_number: normalized,
        status: 'error',
        statusDetail: errorMatch[1],
        events: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const categoryMatch = text.match(/<StatusCategory>(.*?)<\/StatusCategory>/)
    if (categoryMatch) {
      const category = categoryMatch[1]
      if (category === 'Delivered') status = 'Delivered'
      else if (category === 'In Transit' || category === 'Out for Delivery') status = 'In Transit'
      else if (category === 'Pre-Shipment') status = 'Pre-Shipment'
      else status = category
    }

    const summaryMatch = text.match(/<StatusSummary>(.*?)<\/StatusSummary>/)
    if (summaryMatch) statusDetail = summaryMatch[1]

    const eventRegex = /<TrackDetail>([\s\S]*?)<\/TrackDetail>/g
    let eventMatch
    while ((eventMatch = eventRegex.exec(text)) !== null) {
      const block = eventMatch[1]
      const eventDate = block.match(/<EventDate>(.*?)<\/EventDate>/)?.[1] || ''
      const eventTime = block.match(/<EventTime>(.*?)<\/EventTime>/)?.[1] || ''
      const event = block.match(/<Event>(.*?)<\/Event>/)?.[1] || ''
      const city = block.match(/<EventCity>(.*?)<\/EventCity>/)?.[1] || ''
      const state = block.match(/<EventState>(.*?)<\/EventState>/)?.[1] || ''
      events.push({ date: eventDate, time: eventTime, event, city, state })
    }

    const cityMatch = text.match(/<EventCity>(.*?)<\/EventCity>/)
    const stateMatch = text.match(/<EventState>(.*?)<\/EventState>/)
    if (cityMatch && stateMatch) location = `${cityMatch[1]}, ${stateMatch[1]}`

    return new Response(JSON.stringify({
      tracking_number: normalized,
      status,
      statusDetail,
      location,
      events,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
