-- Column order/visibility preferences for admin tables (Produtos, Pedidos, Clientes,
-- Shipping's), moved out of per-browser localStorage into the DB so there's ONE global
-- view shared across every environment (prod, dev, local) and every device — saving
-- anywhere overwrites the same single saved view for that table, read everywhere.
CREATE TABLE IF NOT EXISTS public.table_view_preferences (
  storage_key TEXT NOT NULL PRIMARY KEY,
  column_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_visibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.table_view_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages table view preferences" ON public.table_view_preferences;
CREATE POLICY "Service role manages table view preferences"
  ON public.table_view_preferences FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read table view preferences" ON public.table_view_preferences;
CREATE POLICY "Authenticated users can read table view preferences"
  ON public.table_view_preferences FOR SELECT
  TO authenticated
  USING (true);
