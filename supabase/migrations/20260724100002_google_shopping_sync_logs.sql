SET search_path TO vertex, extensions;

-- Persisted execution history for the Google Shopping feed sync (manual runs + scheduled
-- cron runs). Mirrors amazon_price_automation_logs's shape.
CREATE TABLE IF NOT EXISTS vertex.google_shopping_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'full', 'select')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  total INTEGER,
  synced INTEGER,
  error TEXT,
  products JSONB
);

ALTER TABLE vertex.google_shopping_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read google shopping sync logs"
  ON vertex.google_shopping_sync_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages google shopping sync logs"
  ON vertex.google_shopping_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS google_shopping_sync_logs_created_at_idx
  ON vertex.google_shopping_sync_logs (created_at DESC);
