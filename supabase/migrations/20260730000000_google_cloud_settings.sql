-- Google Cloud Console tab settings: currently just the GA4 numeric Property ID (Admin >
-- Property Settings in Google Analytics — NOT the "G-XXXX" Measurement ID already stored in
-- site_settings), needed to check whether a BigQuery export link exists via the Analytics
-- Admin API. Reuses the same GCP service account as Google Shopping/Search Console — see
-- src/lib/google-cloud-auth.ts. No new secret.
CREATE TABLE IF NOT EXISTS public.google_cloud_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'production' UNIQUE,
  ga4_property_id TEXT,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_cloud_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read google cloud settings"
  ON public.google_cloud_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update google cloud settings"
  ON public.google_cloud_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages google cloud settings"
  ON public.google_cloud_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.google_cloud_settings (environment)
SELECT 'production'
WHERE NOT EXISTS (SELECT 1 FROM public.google_cloud_settings WHERE environment = 'production');
