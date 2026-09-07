-- Shipping box presets, moved out of browser localStorage into the database so the
-- same boxes are available on every device and in both dev and prod (previously each
-- browser had its own localStorage copy). Read/written server-side via /api/boxes
-- using the service role; also readable by any authenticated admin for safety.

CREATE TABLE IF NOT EXISTS public.box_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  length TEXT NOT NULL,
  width TEXT NOT NULL,
  height TEXT NOT NULL,
  distance_unit TEXT NOT NULL DEFAULT 'in',
  unit_count TEXT,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.box_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages box presets" ON public.box_presets;
CREATE POLICY "Service role manages box presets"
  ON public.box_presets FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read box presets" ON public.box_presets;
CREATE POLICY "Authenticated users can read box presets"
  ON public.box_presets FOR SELECT
  TO authenticated
  USING (true);
