-- Persisted execution history for the Amazon price automation (manual runs + scheduled cron runs).
-- Mirrors ebay_price_automation_logs (base table + select-mode, combined since this table is new).
CREATE TABLE IF NOT EXISTS public.amazon_price_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'full', 'select')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'blocked')),
  total INTEGER,
  updated INTEGER,
  error TEXT,
  products JSONB,
  -- Amazon-specific guardrail bookkeeping (no eBay equivalent — required by Amazon's
  -- automated pricing tool policy, in effect since June/2026): what triggered a
  -- confirmation requirement, if any, for this run.
  guardrail_flags JSONB
);

ALTER TABLE public.amazon_price_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read amazon automation logs"
  ON public.amazon_price_automation_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages amazon automation logs"
  ON public.amazon_price_automation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS amazon_price_automation_logs_created_at_idx
  ON public.amazon_price_automation_logs (created_at DESC);
