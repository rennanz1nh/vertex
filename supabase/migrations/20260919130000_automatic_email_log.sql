SET search_path TO vertex, extensions;

-- Sent-email history for Settings → E-mails Automáticos, so an admin can see which
-- automatic emails actually went out (and to whom), not just edit the templates.
-- Test sends ("Enviar teste") are intentionally NOT logged here — this is the record of
-- real trigger-driven sends only.
CREATE TABLE IF NOT EXISTS vertex.automatic_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key email_trigger_key NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'disabled', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automatic_email_log_created_at_idx ON vertex.automatic_email_log (created_at DESC);

ALTER TABLE vertex.automatic_email_log ENABLE ROW LEVEL SECURITY;

-- Read-only from the client side — rows are only ever written by sendAutomaticEmail
-- (server-side, service role, bypasses RLS).
CREATE POLICY "Authenticated users can view automatic email log"
  ON vertex.automatic_email_log
  FOR SELECT
  TO authenticated
  USING (true);
