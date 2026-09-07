SET search_path TO vertex, extensions;

CREATE OR REPLACE FUNCTION vertex.ensure_profile()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vertex
AS $$
DECLARE
  user_profile profiles;
  current_user_id uuid;
BEGIN
  -- Get the current user id
  current_user_id := auth.uid();
  
  -- Return null if no user is authenticated
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if profile exists
  SELECT * INTO user_profile
  FROM profiles
  WHERE user_id = current_user_id;
  
  -- If no profile exists, create one
  IF user_profile IS NULL THEN
    INSERT INTO profiles (user_id, role, display_name)
    VALUES (current_user_id, 'leitura', NULL)
    RETURNING * INTO user_profile;
  END IF;
  
  RETURN user_profile;
END;
$$;