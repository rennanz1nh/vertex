-- Social Media HUB: read-only connections to Instagram, TikTok, Facebook, YouTube
-- and Pinterest. One connected account per platform at a time (reconnecting replaces
-- it) — this app never publishes anything, only reads posts/metrics with the token.
CREATE TABLE IF NOT EXISTS public.social_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'youtube', 'pinterest')),
  account_id TEXT,
  account_name TEXT,
  avatar_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_media_accounts_platform_unique UNIQUE (platform)
);

ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;

-- No client-side access at all (not even read) — access tokens live in this table,
-- so every read/write goes through the Next.js API routes using the service role key,
-- which only ever return the non-sensitive fields (platform, name, avatar, dates).
CREATE POLICY "Service role manages social media accounts"
  ON public.social_media_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
