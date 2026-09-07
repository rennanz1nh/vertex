SET search_path TO vertex, extensions;

-- Table to store eBay OAuth tokens (one row per environment)
CREATE TABLE IF NOT EXISTS vertex.ebay_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ebay_tokens_environment_unique UNIQUE (environment)
);

ALTER TABLE vertex.ebay_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can check connection status (read-only)
CREATE POLICY "Authenticated users can read ebay tokens"
  ON vertex.ebay_tokens
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (edge functions) can write tokens
CREATE POLICY "Service role manages ebay tokens"
  ON vertex.ebay_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
