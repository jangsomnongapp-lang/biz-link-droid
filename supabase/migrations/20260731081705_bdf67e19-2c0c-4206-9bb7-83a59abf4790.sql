CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Direct Data API writes execute as `authenticated` / `anon`.
  -- Trusted SECURITY DEFINER helpers and admin tooling execute as their owner.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin           IS DISTINCT FROM OLD.is_admin
  OR NEW.is_supplier        IS DISTINCT FROM OLD.is_supplier
  OR NEW.is_featured        IS DISTINCT FROM OLD.is_featured
  OR NEW.is_recruiter       IS DISTINCT FROM OLD.is_recruiter
  OR NEW.is_verified        IS DISTINCT FROM OLD.is_verified
  OR NEW.member_number      IS DISTINCT FROM OLD.member_number
  OR NEW.is_super_user      IS DISTINCT FROM OLD.is_super_user
  OR NEW.master_account_id  IS DISTINCT FROM OLD.master_account_id
  OR NEW.is_specialist      IS DISTINCT FROM OLD.is_specialist
  OR NEW.is_coordinator     IS DISTINCT FROM OLD.is_coordinator
  OR NEW.is_provider        IS DISTINCT FROM OLD.is_provider
  OR NEW.is_client          IS DISTINCT FROM OLD.is_client
  OR NEW.is_organization    IS DISTINCT FROM OLD.is_organization THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DELETE FROM auth.users WHERE email LIKE 'ptest%@project001.local';