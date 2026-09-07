SET search_path TO vertex, extensions;

-- Add image_url column to products table
ALTER TABLE vertex.products 
ADD COLUMN image_url TEXT;

-- Create storage bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vertex-product-images', 'vertex-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for product images
DROP POLICY IF EXISTS "Vertex - Product images are publicly accessible" ON storage.objects;
CREATE POLICY "Vertex - Product images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'vertex-product-images');

DROP POLICY IF EXISTS "Vertex - Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Vertex - Authenticated users can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'vertex-product-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Vertex - Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Vertex - Authenticated users can update product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'vertex-product-images' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Vertex - Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Vertex - Authenticated users can delete product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'vertex-product-images' AND auth.uid() IS NOT NULL);