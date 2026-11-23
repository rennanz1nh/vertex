-- The admin reads signatures and license photos with signed URLs from the browser
-- (Bookings list, booking modal, rental-agreement PDF). Creating a signed URL needs a
-- SELECT policy on storage.objects; none existed for these two private buckets, so the
-- admin showed "Sem assinatura", "não enviada" and could not build the PDF.
-- Staff only (admin / operador); customers keep upload-only access.
DROP POLICY IF EXISTS "Vertex staff read agreements and licenses" ON storage.objects;
CREATE POLICY "Vertex staff read agreements and licenses"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('vertex-rental-agreements', 'vertex-license-photos')
    AND vertex.get_current_user_role() IN ('admin'::vertex.app_role, 'operador'::vertex.app_role)
  );
