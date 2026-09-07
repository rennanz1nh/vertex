SET search_path TO vertex, extensions;

-- Persisted execution history for the eBay price automation (manual runs + scheduled cron runs).
-- Previously this only lived in React state and vanished on page reload.
CREATE TABLE IF NOT EXISTS vertex.ebay_price_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'full')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  total INTEGER,
  updated INTEGER,
  error TEXT,
  products JSONB
);

ALTER TABLE vertex.ebay_price_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read automation logs"
  ON vertex.ebay_price_automation_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages automation logs"
  ON vertex.ebay_price_automation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ebay_price_automation_logs_created_at_idx
  ON vertex.ebay_price_automation_logs (created_at DESC);
