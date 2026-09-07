-- Product Create (Automações): a drafting lab for products with missing photos/info —
-- separate from the real `products` catalog so drafts can be iterated on freely before
-- anything is actually published to a store.
CREATE TABLE IF NOT EXISTS public.product_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  brand TEXT,
  category TEXT,
  notes TEXT,
  price NUMERIC,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_description TEXT,
  ai_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_image_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product drafts"
  ON public.product_drafts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and operador can manage product drafts"
  ON public.product_drafts
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::app_role, 'operador'::app_role]));
