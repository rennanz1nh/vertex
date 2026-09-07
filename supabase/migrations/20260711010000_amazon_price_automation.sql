-- Settings + last-run status for the daily Amazon price automation (single-row table).
-- Mirrors ebay_price_automation (base table + active_weekdays, combined here since this
-- table is new rather than an evolution of an existing eBay-era table).
CREATE TABLE IF NOT EXISTS public.amazon_price_automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  run_time TEXT NOT NULL DEFAULT '09:00', -- HH:MM, America/Sao_Paulo (informational — see cron note in route)
  price_adjustment NUMERIC NOT NULL DEFAULT -0.01,
  active_weekdays INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'error')),
  last_run_total INTEGER,
  last_run_updated INTEGER,
  last_run_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.amazon_price_automation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read amazon automation settings"
  ON public.amazon_price_automation
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update amazon automation settings"
  ON public.amazon_price_automation
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages amazon automation settings"
  ON public.amazon_price_automation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed the single settings row
INSERT INTO public.amazon_price_automation (enabled, run_time, price_adjustment)
SELECT false, '09:00', -0.01
WHERE NOT EXISTS (SELECT 1 FROM public.amazon_price_automation);
