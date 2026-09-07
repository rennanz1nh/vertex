SET search_path TO vertex, extensions;

-- Update user role to admin
UPDATE profiles 
SET role = 'admin'::app_role 
WHERE user_id = '21b9837b-5abc-485e-9ca6-167ef935966e';

-- Verify the update
SELECT user_id, role, display_name 
FROM profiles 
WHERE user_id = '21b9837b-5abc-485e-9ca6-167ef935966e';