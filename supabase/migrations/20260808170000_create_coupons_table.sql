CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  -- Populated lazily the first time this row is listed after creation (see GET
  -- /api/coupons) — lets a row be seeded by migration and synced to Stripe on demand,
  -- without needing STRIPE_SECRET_KEY available at migration time.
  stripe_coupon_id TEXT,
  stripe_promotion_code_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view coupons"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and operador can manage coupons"
  ON public.coupons
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]));

INSERT INTO public.coupons (code, description, discount_type, discount_value, active) VALUES
('WELCOME10', 'Welcome discount — sent in the newsletter and order confirmation emails', 'percent', 10, true)
ON CONFLICT (code) DO NOTHING;
