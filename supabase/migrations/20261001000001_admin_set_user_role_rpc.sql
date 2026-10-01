-- RPC function for admins to change user roles.
-- Runs as SECURITY DEFINER to bypass the prevent_role_self_escalation trigger
-- (which blocks when auth.uid() is NULL, as happens with service-role calls).
CREATE OR REPLACE FUNCTION admin_set_user_role(target_user_id uuid, new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable the escalation trigger
  ALTER TABLE public.profiles DISABLE TRIGGER prevent_role_self_escalation_trg;
  UPDATE public.profiles SET role = new_role WHERE user_id = target_user_id;
  ALTER TABLE public.profiles ENABLE TRIGGER prevent_role_self_escalation_trg;
END;
$$;
