-- Every eBay access-token refresh attempt (success or failure), unlike ebay_tokens'
-- last_refresh_error which only ever holds the single most recent one — needed to tell
-- a recurring disconnect problem apart from a one-off blip.
CREATE TABLE IF NOT EXISTS public.ebay_token_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  success BOOLEAN NOT NULL,
  error TEXT,
  new_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ebay_token_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view token refresh log"
  ON public.ebay_token_refresh_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and operador can manage token refresh log"
  ON public.ebay_token_refresh_log
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]));

CREATE INDEX IF NOT EXISTS ebay_token_refresh_log_created_at_idx ON public.ebay_token_refresh_log (created_at DESC);
