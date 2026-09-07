-- Tracks which eBay listing IDs have already been seen as "eligible for an offer" (has
-- watchers/cart-abandoners), so the polling cron only pushes a notification for genuinely
-- NEW eligibility, not the same listings every time it checks.
CREATE TABLE IF NOT EXISTS public.ebay_eligible_offers_seen (
  listing_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ebay_eligible_offers_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view eligible offers seen"
  ON public.ebay_eligible_offers_seen
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and operador can manage eligible offers seen"
  ON public.ebay_eligible_offers_seen
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]));

INSERT INTO public.push_notifications (trigger_key, enabled, title, message, tags) VALUES
('ebay_offers_eligible', true, 'eBay: novas ofertas disponíveis', E'{count} anúncio(s) com watchers elegíveis para receber oferta.
Toque para ver e enviar.', 'bell')
ON CONFLICT (trigger_key) DO NOTHING;
