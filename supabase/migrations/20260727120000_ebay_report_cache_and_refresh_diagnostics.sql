-- Every live eBay report route (campaigns, traffic, listings, seller standards,
-- customer service) now caches its last successful payload here, keyed by report +
-- serialized query params. When the live eBay call fails (token/refresh issue, eBay
-- outage), the route falls back to this instead of showing a blank/broken page.
CREATE TABLE IF NOT EXISTS public.ebay_report_cache (
  report_key TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_key, params)
);

ALTER TABLE public.ebay_report_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ebay report cache"
  ON public.ebay_report_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages ebay report cache"
  ON public.ebay_report_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Diagnostics for the actual eBay OAuth error when a refresh_token exchange fails —
-- getEbayAccessToken() previously discarded the real eBay response body, making it
-- impossible to tell "refresh token genuinely expired" apart from "credential
-- misconfiguration" apart from "transient eBay-side error" after the fact.
ALTER TABLE public.ebay_tokens
  ADD COLUMN IF NOT EXISTS last_refresh_error TEXT,
  ADD COLUMN IF NOT EXISTS last_refresh_error_at TIMESTAMPTZ;
