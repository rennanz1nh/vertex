SET search_path TO vertex, extensions;

-- Settings + last-run status for the daily eBay price automation (single-row table)
CREATE TABLE IF NOT EXISTS vertex.ebay_price_automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  run_time TEXT NOT NULL DEFAULT '09:00', -- HH:MM, America/Sao_Paulo (informational — see cron note below)
  price_adjustment NUMERIC NOT NULL DEFAULT -0.01,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'error')),
  last_run_total INTEGER,
  last_run_updated INTEGER,
  last_run_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vertex.ebay_price_automation ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admin panel) can read + update settings
CREATE POLICY "Authenticated users can read automation settings"
  ON vertex.ebay_price_automation
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update automation settings"
  ON vertex.ebay_price_automation
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role (cron route, using the service key) manages everything, including the initial insert
CREATE POLICY "Service role manages automation settings"
  ON vertex.ebay_price_automation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed the single settings row
INSERT INTO vertex.ebay_price_automation (enabled, run_time, price_adjustment)
SELECT false, '09:00', -0.01
WHERE NOT EXISTS (SELECT 1 FROM vertex.ebay_price_automation);
