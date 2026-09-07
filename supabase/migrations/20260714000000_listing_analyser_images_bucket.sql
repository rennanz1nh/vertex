-- Public storage bucket for images uploaded in the Listing Analyser (eBay
-- listing description improvement) — separate from product-images since
-- these are ad-hoc listing photos, not the canonical product catalog images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Listing images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'listing-images');

CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'listing-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update listing images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'listing-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete listing images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'listing-images' AND auth.uid() IS NOT NULL);
