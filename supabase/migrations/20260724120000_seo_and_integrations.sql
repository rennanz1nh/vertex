SET search_path TO vertex, extensions;

-- SEO + marketing integrations managed from Admin > Settings.
--
-- Three pieces:
--   site_settings  — single-row: global SEO defaults, Google/Facebook tag IDs,
--                    LocalBusiness (Google Business) structured-data fields
--   page_seo       — per-page title/description/og overrides (home, categories, ...)
--   product_seo    — per-product SEO overrides, keyed by products.id

-- ---------------------------------------------------------------------------
-- site_settings (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vertex.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- General / SEO defaults
  site_url TEXT,                       -- canonical base, e.g. https://vertex-rental-cars.vercel.app (fallback in code if null)
  site_name TEXT NOT NULL DEFAULT 'Vertex Rental Cars',
  default_title TEXT,                  -- default <title> when a page/product has none
  default_description TEXT,            -- default meta description
  default_og_image TEXT,               -- default social share image (absolute URL)
  -- Google tags
  ga4_measurement_id TEXT,             -- G-XXXXXXX
  gtm_container_id TEXT,               -- GTM-XXXXXXX
  google_ads_conversion_id TEXT,       -- AW-XXXXXXXXX
  google_site_verification TEXT,       -- Search Console meta verification token
  -- Google Business Profile / LocalBusiness structured data
  business_name TEXT,
  business_phone TEXT,
  business_email TEXT,
  business_street TEXT,
  business_city TEXT,
  business_state TEXT,
  business_zip TEXT,
  business_country TEXT DEFAULT 'US',
  business_hours TEXT,                 -- freeform, e.g. "Mo-Fr 09:00-18:00"
  business_maps_url TEXT,              -- Google Maps / Business listing URL
  -- Facebook / Meta
  facebook_pixel_id TEXT,
  facebook_domain_verification TEXT,   -- <meta name="facebook-domain-verification">
  facebook_page_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vertex.site_settings ENABLE ROW LEVEL SECURITY;

-- Public SELECT: the storefront (anon key, server-rendered) reads these to inject
-- tags and build metadata. No secrets live here — only public tag IDs and SEO text.
CREATE POLICY "Anyone can view site settings"
  ON vertex.site_settings FOR SELECT USING (true);

CREATE POLICY "Admin and operador can insert site settings"
  ON vertex.site_settings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND vertex.get_current_user_role() IN ('admin', 'operador'));

CREATE POLICY "Admin and operador can update site settings"
  ON vertex.site_settings FOR UPDATE
  USING (auth.uid() IS NOT NULL AND vertex.get_current_user_role() IN ('admin', 'operador'));

-- Seed the single row
INSERT INTO vertex.site_settings (site_name)
SELECT 'Vertex Rental Cars'
WHERE NOT EXISTS (SELECT 1 FROM vertex.site_settings);

-- ---------------------------------------------------------------------------
-- page_seo (per-page overrides)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vertex.page_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,       -- home | products | women | men | women-skin | ... | contact-us | sell-with-us
  title TEXT,
  description TEXT,
  og_image TEXT,
  noindex BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vertex.page_seo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view page seo"
  ON vertex.page_seo FOR SELECT USING (true);

CREATE POLICY "Admin and operador can insert page seo"
  ON vertex.page_seo FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND vertex.get_current_user_role() IN ('admin', 'operador'));

CREATE POLICY "Admin and operador can update page seo"
  ON vertex.page_seo FOR UPDATE
  USING (auth.uid() IS NOT NULL AND vertex.get_current_user_role() IN ('admin', 'operador'));

CREATE POLICY "Admin can delete page seo"
  ON vertex.page_seo FOR DELETE
  USING (auth.uid() IS NOT NULL AND vertex.get_current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- product_seo (per-product overrides)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vertex.product_seo (
  product_id UUID PRIMARY KEY REFERENCES vertex.products(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  og_image TEXT,
  noindex BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vertex.product_seo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product seo"
  ON vertex.product_seo FOR SELECT USING (true);

CREATE POLICY "Admin and operador can insert product seo"
  ON vertex.product_seo FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND vertex.get_current_user_role() IN ('admin', 'operador'));

CREATE POLICY "Admin and operador can update product seo"
  ON vertex.product_seo FOR UPDATE
  USING (auth.uid() IS NOT NULL AND vertex.get_current_user_role() IN ('admin', 'operador'));

CREATE POLICY "Admin can delete product seo"
  ON vertex.product_seo FOR DELETE
  USING (auth.uid() IS NOT NULL AND vertex.get_current_user_role() = 'admin');

-- Expose product_seo columns through the public store view for convenient reads
DROP VIEW IF EXISTS vertex.store_products;
CREATE VIEW vertex.store_products AS
SELECT
  p.id,
  p."Produto Nome",
  p."Informacoes dos produtos / descricao",
  p."Valor de venda (Online)",
  p.sale_price,
  p."Quantidade no Estoque",
  p."Marca",
  p."Linha do produto",
  p."SKU",
  p."Volume",
  p.image_url,
  p.gallery_urls,
  p.details,
  p.store_visible,
  p.store_category,
  p.store_categories,
  p.ribbon_text,
  p.ribbon_color
FROM vertex.products p
WHERE p.store_visible = true;

GRANT SELECT ON vertex.store_products TO anon;
