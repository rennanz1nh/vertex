-- Settings + last-run status for the Google Shopping feed sync automation.
-- Structurally mirrors amazon_price_automation, but there is no "price_adjustment": the
-- Merchant API isn't a repricing tool like eBay/Amazon automations — it's a product feed
-- that must always mirror the store's real price/stock (Google suspends accounts over
-- checkout-price mismatches), so the automation's job is to re-sync price/stock/status,
-- not to move price. It also caps at effectively 2 full runs/day: Merchant API's product
-- update quota is ~2x the account's offer count per day (see NOTE in the cron route),
-- so `active_weekdays` here is a should-run gate, not a source of extra runs per day.
CREATE TABLE IF NOT EXISTS public.google_shopping_sync_automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  run_time TEXT NOT NULL DEFAULT '09:00', -- HH:MM, America/Sao_Paulo (informational — see cron note in route)
  active_weekdays INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'error')),
  last_run_total INTEGER,
  last_run_synced INTEGER,
  last_run_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_shopping_sync_automation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read google shopping automation settings"
  ON public.google_shopping_sync_automation
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update google shopping automation settings"
  ON public.google_shopping_sync_automation
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages google shopping automation settings"
  ON public.google_shopping_sync_automation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.google_shopping_sync_automation (enabled, run_time)
SELECT false, '09:00'
WHERE NOT EXISTS (SELECT 1 FROM public.google_shopping_sync_automation);
