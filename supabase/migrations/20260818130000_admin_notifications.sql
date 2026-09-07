-- In-app admin notification bell: new sales, delivery status updates, eBay "send offer"
-- eligibility. Independent of the ntfy.sh push system (notification_settings/push_notifications) —
-- this is the persisted feed the bell UI reads via Realtime, not an external push.
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('new_order', 'delivery_update', 'ebay_offer_eligible')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages admin notifications" ON public.admin_notifications;
CREATE POLICY "Service role manages admin notifications"
  ON public.admin_notifications FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read admin notifications" ON public.admin_notifications;
CREATE POLICY "Authenticated users can read admin notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (true);

-- Single global row tracking when the bell was last opened — shared across every admin
-- session (matches this app's existing "one shared view" pattern, e.g. table_view_preferences).
CREATE TABLE IF NOT EXISTS public.admin_notifications_seen (
  id BOOLEAN NOT NULL PRIMARY KEY DEFAULT true CHECK (id = true),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
INSERT INTO public.admin_notifications_seen (id, last_seen_at) VALUES (true, now())
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.admin_notifications_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages notifications seen" ON public.admin_notifications_seen;
CREATE POLICY "Service role manages notifications seen"
  ON public.admin_notifications_seen FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read notifications seen" ON public.admin_notifications_seen;
CREATE POLICY "Authenticated users can read notifications seen"
  ON public.admin_notifications_seen FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can update notifications seen" ON public.admin_notifications_seen;
CREATE POLICY "Authenticated users can update notifications seen"
  ON public.admin_notifications_seen FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);
