-- Admin-managed site banners (Settings > Banners): hero banners on the home
-- page / category pages, and site-wide or per-page popups, each optionally
-- with a link, an overlay text, and a corner "fita" ribbon.
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  page TEXT NOT NULL, -- 'home' | category slug (women, men, ...) | 'contact-us' | 'sell-with-us' | '*' (all pages, popup only)
  placement TEXT NOT NULL DEFAULT 'hero' CHECK (placement IN ('hero', 'popup')),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  link_url TEXT,
  overlay_text TEXT,
  ribbon_text TEXT,
  ribbon_color TEXT,
  ribbon_position TEXT NOT NULL DEFAULT 'top-right' CHECK (ribbon_position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS banners_page_placement_idx ON public.banners (page, placement) WHERE active;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Storefront reads banners directly with the anon key (no cost/margin data here,
-- same as store_products) — the store queries filter to active rows themselves.
CREATE POLICY "Anyone can view banners"
  ON public.banners
  FOR SELECT
  USING (true);

CREATE POLICY "Admin and operador can insert banners"
  ON public.banners
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Admin and operador can update banners"
  ON public.banners
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    public.get_current_user_role() IN ('admin', 'operador')
  );

CREATE POLICY "Only admin can delete banners"
  ON public.banners
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    public.get_current_user_role() = 'admin'
  );

-- Public storage bucket for banner images/videos uploaded in the admin panel.
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-media', 'banner-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Banner media is publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'banner-media');

CREATE POLICY "Authenticated users can upload banner media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'banner-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update banner media"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'banner-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete banner media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'banner-media' AND auth.uid() IS NOT NULL);
