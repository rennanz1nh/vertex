-- Link-in-Bio feature: configurable links page for Instagram / mobile.

CREATE TABLE IF NOT EXISTS public.bio_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL DEFAULT 'Vertex Rental Cars',
  description text,
  avatar_url text,
  background_color text DEFAULT '#000000',
  text_color text DEFAULT '#ffffff',
  button_style text DEFAULT 'rounded',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.bio_settings (display_name, description)
VALUES ('Vertex Rental Cars', 'Aluguel de carros premium')
ON CONFLICT DO NOTHING;

ALTER TABLE public.bio_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bio_links_public_read" ON public.bio_links FOR SELECT USING (true);
CREATE POLICY "bio_settings_public_read" ON public.bio_settings FOR SELECT USING (true);
