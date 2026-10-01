-- Simplified role system: admin + user only.
-- Legacy enum values (master, operador, leitura) remain in app_role
-- because PostgreSQL cannot remove enum values, but they are unused.
-- The 'user' value was added in a prior migration.

-- get_current_user_role() maps any legacy role to admin/user for RLS.
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE
    WHEN role IN ('admin', 'master') THEN 'admin'::app_role
    WHEN role IN ('user', 'operador', 'leitura') THEN 'user'::app_role
    ELSE role
  END
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;

-- Expose the real stored role for UI display.
CREATE OR REPLACE FUNCTION get_exact_user_role()
RETURNS app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- New users default to 'user' role.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'name'),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'user')
  );
  RETURN NEW;
END;
$$;

-- Role-escalation guard: only admins can change roles.
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
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    ) THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
