SET search_path TO vertex, extensions;

-- Public storage bucket for images uploaded in the Listing Analyser (eBay
-- listing description improvement) — separate from product-images since
-- these are ad-hoc listing photos, not the canonical product catalog images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vertex-listing-images', 'vertex-listing-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Vertex - Listing images are publicly accessible" ON storage.objects;
CREATE POLICY "Vertex - Listing images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vertex-listing-images');

DROP POLICY IF EXISTS "Vertex - Authenticated users can upload listing images" ON storage.objects;
CREATE POLICY "Vertex - Authenticated users can upload listing images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'vertex-listing-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Vertex - Authenticated users can update listing images" ON storage.objects;
CREATE POLICY "Vertex - Authenticated users can update listing images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'vertex-listing-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Vertex - Authenticated users can delete listing images" ON storage.objects;
CREATE POLICY "Vertex - Authenticated users can delete listing images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'vertex-listing-images' AND auth.uid() IS NOT NULL);
