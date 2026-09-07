SET search_path TO vertex, extensions;

-- Create a function to ensure profile exists and create it if it doesn't
CREATE OR REPLACE FUNCTION vertex.ensure_profile()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'vertex'
AS $$
DECLARE
  user_profile profiles;
BEGIN
  -- Check if profile exists
  SELECT * INTO user_profile
  FROM profiles
  WHERE user_id = auth.uid();
  
  -- If no profile exists, create one
  IF user_profile IS NULL THEN
    INSERT INTO profiles (user_id, role, display_name)
    VALUES (auth.uid(), 'leitura', NULL)
    RETURNING * INTO user_profile;
  END IF;
  
  RETURN user_profile;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION vertex.ensure_profile() TO authenticated;

-- Update the handle_new_user function to use 'leitura' as default role
CREATE OR REPLACE FUNCTION vertex.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'vertex'
AS $$
BEGIN
  INSERT INTO vertex.profiles (user_id, display_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name', 'leitura');
  RETURN NEW;
END;
$$;