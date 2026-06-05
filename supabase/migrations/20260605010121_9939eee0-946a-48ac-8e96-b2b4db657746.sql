
-- 1) app_settings: hide telegram_webhook_secret from SELECT, allow admin reads of non-secret fields
DROP POLICY IF EXISTS "admins can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "admins read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "admins select app_settings" ON public.app_settings;

CREATE OR REPLACE VIEW public.app_settings_public
WITH (security_invoker = on) AS
SELECT id, telegram_chat_id, telegram_webhook_url, updated_at
FROM public.app_settings;

GRANT SELECT ON public.app_settings_public TO authenticated;

-- Replace any SELECT policies with one that denies direct reads (writes still allowed via existing admin policies)
CREATE POLICY "no direct select on app_settings"
  ON public.app_settings FOR SELECT
  USING (false);

-- 2) profiles: lock additional role flags from user self-edit
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR public.is_admin(auth.uid())
     OR current_user <> session_user THEN
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
$function$;

-- 3) invite_joins: explicit deny on client inserts (recorded by SECURITY DEFINER RPC only)
DROP POLICY IF EXISTS "no client inserts on invite_joins" ON public.invite_joins;
CREATE POLICY "no client inserts on invite_joins"
  ON public.invite_joins FOR INSERT
  TO authenticated
  WITH CHECK (false);
