SET search_path TO vertex, extensions;

-- Fix 1: Prevent role self-escalation on profiles table
DROP POLICY IF EXISTS "Users can update their own profile" ON vertex.profiles;

CREATE POLICY "Users can update their own profile" ON vertex.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT p.role FROM vertex.profiles p WHERE p.user_id = auth.uid())
  );

-- Fix 2: Add storage policies for "Bucket Storage" bucket
DROP POLICY IF EXISTS "Vertex - Admin and operador can view bucket storage files" ON storage.objects;
CREATE POLICY "Vertex - Admin and operador can view bucket storage files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'Vertex Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND vertex.get_current_user_role() IN ('admin', 'operador')
);

DROP POLICY IF EXISTS "Vertex - Admin and operador can upload to bucket storage" ON storage.objects;
CREATE POLICY "Vertex - Admin and operador can upload to bucket storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'Vertex Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND vertex.get_current_user_role() IN ('admin', 'operador')
);

DROP POLICY IF EXISTS "Vertex - Admin and operador can update bucket storage files" ON storage.objects;
CREATE POLICY "Vertex - Admin and operador can update bucket storage files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'Vertex Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND vertex.get_current_user_role() IN ('admin', 'operador')
);

DROP POLICY IF EXISTS "Vertex - Only admin can delete bucket storage files" ON storage.objects;
CREATE POLICY "Vertex - Only admin can delete bucket storage files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'Vertex Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND vertex.get_current_user_role() = 'admin'
);