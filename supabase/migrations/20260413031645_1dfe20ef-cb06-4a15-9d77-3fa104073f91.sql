-- Fix 1: Prevent role self-escalation on profiles table
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- Fix 2: Add storage policies for "Bucket Storage" bucket
CREATE POLICY "Admin and operador can view bucket storage files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND public.get_current_user_role() IN ('admin', 'operador')
);

CREATE POLICY "Admin and operador can upload to bucket storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND public.get_current_user_role() IN ('admin', 'operador')
);

CREATE POLICY "Admin and operador can update bucket storage files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND public.get_current_user_role() IN ('admin', 'operador')
);

CREATE POLICY "Only admin can delete bucket storage files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'Bucket Storage'
  AND auth.uid() IS NOT NULL
  AND public.get_current_user_role() = 'admin'
);