-- Google Shopping connection: unlike eBay (OAuth redirect) and Amazon (self-authorized
-- refresh token), the Merchant API uses a service account — the seller creates a GCP
-- service account, adds its email as a user on their Merchant Center account, and pastes
-- the service account's JSON key here (env var, never sent from the browser) plus their
-- Merchant Center ID. Access tokens are minted server-side via a signed JWT (RS256) and
-- cached until they expire — see src/lib/google-shopping-auth.ts.
CREATE TABLE IF NOT EXISTS public.google_shopping_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'production' UNIQUE,
  merchant_id TEXT NOT NULL,
  -- Resolved once on connect (accounts.dataSources.list/create) and reused for every
  -- productInputs.insert call — Merchant API requires every product to declare which
  -- data source it belongs to.
  data_source_name TEXT,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_shopping_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read google shopping tokens"
  ON public.google_shopping_tokens
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages google shopping tokens"
  ON public.google_shopping_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
