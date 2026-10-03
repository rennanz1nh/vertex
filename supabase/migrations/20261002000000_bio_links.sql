-- Link-in-Bio feature: configurable links page for Instagram / mobile.
-- Uses vertex schema (set via NEXT_PUBLIC_SUPABASE_SCHEMA env var).

CREATE TABLE IF NOT EXISTS vertex.bio_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  icon text,
  thumbnail_url text,
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vertex.bio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL DEFAULT 'Vertex Rental Cars',
  description text,
  avatar_url text,
  background_color text DEFAULT '#000000',
  background_image_url text,
  text_color text DEFAULT '#ffffff',
  accent_color text,
  button_style text DEFAULT 'rounded',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO vertex.bio_settings (display_name, description)
VALUES ('Vertex Rental Cars', 'Aluguel de carros premium')
ON CONFLICT DO NOTHING;

ALTER TABLE vertex.bio_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertex.bio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bio_links_public_read" ON vertex.bio_links FOR SELECT USING (true);
CREATE POLICY "bio_settings_public_read" ON vertex.bio_settings FOR SELECT USING (true);

-- Grant schema usage and table permissions to Supabase roles
GRANT USAGE ON SCHEMA vertex TO anon, authenticated;
GRANT SELECT ON vertex.bio_links TO anon, authenticated;
GRANT SELECT ON vertex.bio_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON vertex.bio_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON vertex.bio_settings TO authenticated;
