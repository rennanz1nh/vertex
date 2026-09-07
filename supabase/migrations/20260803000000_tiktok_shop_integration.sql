SET search_path TO vertex, extensions;

-- TikTok Shop integration: OAuth tokens, price/inventory automation settings, logs,
-- live progress, and the order_items column used to dedupe TikTok Shop line items on
-- re-sync (mirrors the eBay/Amazon integration tables).

-- ─── OAuth tokens ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vertex.tiktok_shop_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  open_id TEXT,
  seller_name TEXT,
  shop_id TEXT,
  shop_cipher TEXT,
  shop_name TEXT,
  last_refresh_error TEXT,
  last_refresh_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tiktok_shop_tokens_environment_unique UNIQUE (environment)
);

ALTER TABLE vertex.tiktok_shop_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tiktok shop tokens"
  ON vertex.tiktok_shop_tokens
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages tiktok shop tokens"
  ON vertex.tiktok_shop_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Price/inventory automation settings (single-row table) ───────────────────
CREATE TABLE IF NOT EXISTS vertex.tiktok_shop_price_automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  run_time TEXT NOT NULL DEFAULT '09:00',
  price_adjustment NUMERIC NOT NULL DEFAULT -0.01,
  active_weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'error')),
  last_run_total INTEGER,
  last_run_updated INTEGER,
  last_run_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vertex.tiktok_shop_price_automation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tiktok price automation"
  ON vertex.tiktok_shop_price_automation
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update tiktok price automation"
  ON vertex.tiktok_shop_price_automation
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages tiktok price automation"
  ON vertex.tiktok_shop_price_automation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO vertex.tiktok_shop_price_automation (enabled, run_time, price_adjustment)
SELECT false, '09:00', -0.01
WHERE NOT EXISTS (SELECT 1 FROM vertex.tiktok_shop_price_automation);

-- ─── Execution history ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vertex.tiktok_shop_price_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'full', 'select')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  total INTEGER,
  updated INTEGER,
  error TEXT,
  products JSONB
);

ALTER TABLE vertex.tiktok_shop_price_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tiktok automation logs"
  ON vertex.tiktok_shop_price_automation_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages tiktok automation logs"
  ON vertex.tiktok_shop_price_automation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS tiktok_shop_price_automation_logs_created_at_idx
  ON vertex.tiktok_shop_price_automation_logs (created_at DESC);

-- ─── Live progress for an in-flight run ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vertex.tiktok_shop_price_automation_progress (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'done', 'error')),
  total INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO vertex.tiktok_shop_price_automation_progress (id, status, total, completed)
VALUES (1, 'idle', 0, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE vertex.tiktok_shop_price_automation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tiktok automation progress"
  ON vertex.tiktok_shop_price_automation_progress
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages tiktok automation progress"
  ON vertex.tiktok_shop_price_automation_progress
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Order sync columns ────────────────────────────────────────────────────────
-- tiktok_line_item_id anchors upserts on re-sync (same role as ebay_line_item_id /
-- asin), tiktok_fulfillment_status mirrors ebay_fulfillment_status for display, and
-- tiktok_status_manual lets a human override the status without a sync overwriting it.
ALTER TABLE vertex.order_items ADD COLUMN IF NOT EXISTS tiktok_line_item_id TEXT;
ALTER TABLE vertex.orders ADD COLUMN IF NOT EXISTS tiktok_fulfillment_status TEXT;
ALTER TABLE vertex.orders ADD COLUMN IF NOT EXISTS tiktok_status_manual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vertex.orders ADD COLUMN IF NOT EXISTS comissao_tiktok NUMERIC NOT NULL DEFAULT 0;
