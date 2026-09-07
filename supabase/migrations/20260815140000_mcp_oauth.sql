-- ============================================================================
-- OAuth 2.1 authorization server for the Social Media MCP itself (distinct
-- from the social_media_accounts tokens, which are OAuth tokens for
-- Instagram/TikTok/etc — these are tokens we issue to MCP clients, e.g.
-- Claude, so a request can be traced back to a real Supabase user and role
-- before any tool runs). Access/refresh tokens and authorization codes are
-- stored as SHA-256 hashes only — we never need the plaintext back, only to
-- check equality, so hashing (not just RLS) protects them even from a
-- database dump.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_name TEXT,
  redirect_uris TEXT[] NOT NULL,
  registration_source TEXT NOT NULL CHECK (registration_source IN ('dcr', 'cimd', 'manual')),
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages mcp oauth clients"
  ON public.mcp_oauth_clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scope TEXT NOT NULL DEFAULT 'mcp:read',
  user_id UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_codes_expires_idx ON public.mcp_oauth_authorization_codes (expires_at);

ALTER TABLE public.mcp_oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages mcp oauth codes"
  ON public.mcp_oauth_authorization_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  client_id TEXT NOT NULL REFERENCES public.mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  scope TEXT NOT NULL DEFAULT 'mcp:read',
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_refresh_idx ON public.mcp_oauth_tokens (refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;

ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages mcp oauth tokens"
  ON public.mcp_oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
