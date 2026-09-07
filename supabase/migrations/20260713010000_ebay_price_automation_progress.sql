-- Live progress for an in-flight eBay price automation run, polled by the admin page
-- to render a progress bar. Single row (id = 1), overwritten on every run.
CREATE TABLE IF NOT EXISTS public.ebay_price_automation_progress (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'done', 'error')),
  total INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ebay_price_automation_progress (id, status, total, completed)
VALUES (1, 'idle', 0, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ebay_price_automation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read automation progress"
  ON public.ebay_price_automation_progress
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages automation progress"
  ON public.ebay_price_automation_progress
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
