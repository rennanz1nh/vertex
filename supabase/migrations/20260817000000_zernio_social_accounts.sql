SET search_path TO vertex, extensions;

-- Accounts connected via Zernio (https://zernio.com) — a unified social API that owns
-- its own pre-approved Meta/TikTok developer apps, so publishing works without our own
-- app going through Meta App Review / TikTok's Content Posting API audit first. Kept in
-- a separate table from social_media_accounts (the native-OAuth HUB) rather than adding
-- a "provider" column there: that table's UNIQUE(platform) and required access_token
-- assume a real platform OAuth token, which doesn't apply here — Zernio holds the actual
-- Instagram/TikTok tokens on their side, we only ever store their accountId reference.
CREATE TABLE IF NOT EXISTS vertex.zernio_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  zernio_account_id TEXT NOT NULL,
  account_name TEXT,
  avatar_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT zernio_social_accounts_platform_unique UNIQUE (platform)
);

ALTER TABLE vertex.zernio_social_accounts ENABLE ROW LEVEL SECURITY;

-- Same access model as social_media_accounts: no direct client access, only the
-- Next.js API routes via the service role key.
CREATE POLICY "Service role manages zernio social accounts"
  ON vertex.zernio_social_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
