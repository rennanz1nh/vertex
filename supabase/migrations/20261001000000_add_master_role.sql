SET search_path TO vertex, extensions;

-- Add 'master' role to the app_role enum (highest privilege level).
-- master has full unrestricted access; admin, operador, leitura follow below it.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'master' BEFORE 'admin';

-- IMPORTANT: The functions below reference the new 'master' enum value.
-- PostgreSQL requires a COMMIT between ADD VALUE and its first use.
-- When running via `supabase db push` or the MCP apply_migration tool,
-- split this into two migrations (the ALTER TYPE above, then the rest).
-- The remote database already has these applied as two separate migrations.

-- Update get_current_user_role() so that existing RLS policies (which compare
-- against 'admin') automatically grant access to master users too.  A future
-- migration can return the raw role once every policy has been updated.
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN role = 'master' THEN 'admin'::app_role
    ELSE role
  END
  FROM vertex.profiles
  WHERE user_id = auth.uid();
$$;

-- Expose the real stored role for UI display and fine-grained server-side checks.
CREATE OR REPLACE FUNCTION get_exact_user_role()
RETURNS app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM vertex.profiles WHERE user_id = auth.uid();
$$;

-- New users should default to operador; admins promote them explicitly.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vertex
AS $$
BEGIN
  INSERT INTO vertex.profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'name'),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'operador')
  );
  RETURN NEW;
END;
$$;

-- Update role-escalation guard to also allow master users to change roles.
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'master'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
