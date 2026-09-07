-- Table to store Amazon SP-API LWA tokens (one row per environment).
-- Mirrors ebay_tokens. Amazon's app is self-authorized (Fase 3 of the integration plan),
-- so the refresh_token is generated once in Seller Central and pasted in directly —
-- there is no OAuth redirect callback like the eBay flow.
CREATE TABLE IF NOT EXISTS public.amazon_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  seller_id TEXT,
  marketplace_id TEXT NOT NULL DEFAULT 'ATVPDKIKX0DER', -- Amazon.com (US) marketplace
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amazon_tokens_environment_unique UNIQUE (environment)
);

ALTER TABLE public.amazon_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can check connection status (read-only)
CREATE POLICY "Authenticated users can read amazon tokens"
  ON public.amazon_tokens
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (edge functions / server routes with the service key) can write tokens
CREATE POLICY "Service role manages amazon tokens"
  ON public.amazon_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
