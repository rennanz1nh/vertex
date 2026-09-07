-- Google Search Console connection: reuses the same GCP service account already used for
-- the Merchant API (Google Shopping) — see src/lib/search-console-auth.ts. No new secret
-- needed; the service account's email just has to be added as a user on the Search
-- Console property (Settings > Users and permissions), a one-time manual step. Only the
-- site_url and a cached access token live here.
CREATE TABLE IF NOT EXISTS public.search_console_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'production' UNIQUE,
  -- Must exactly match how the property is registered in Search Console
  -- (e.g. "https://cosmeticmkt.com/" for a URL-prefix property, or "sc-domain:cosmeticmkt.com").
  site_url TEXT NOT NULL DEFAULT 'https://cosmeticmkt.com/',
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.search_console_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read search console settings"
  ON public.search_console_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update search console settings"
  ON public.search_console_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages search console settings"
  ON public.search_console_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.search_console_settings (environment)
SELECT 'production'
WHERE NOT EXISTS (SELECT 1 FROM public.search_console_settings WHERE environment = 'production');
