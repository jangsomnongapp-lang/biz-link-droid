
-- 1. Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS master_account_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_master_account ON public.profiles(master_account_id);

-- 2. super_user_identities table
CREATE TABLE IF NOT EXISTS public.super_user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 100,
  avatar_shape text NOT NULL DEFAULT 'circle', -- 'circle' or 'square'
  is_official boolean NOT NULL DEFAULT false,
  badges text[] NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_user_id, identity_user_id)
);

ALTER TABLE public.super_user_identities ENABLE ROW LEVEL SECURITY;

-- 3. Helper: current_master_user_id() — returns the super-user master account
-- for whoever is currently logged in (either the super user themselves, or
-- one of their identity sub-accounts).
CREATE OR REPLACE FUNCTION public.current_master_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.is_super_user THEN p.id
    WHEN p.master_account_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.profiles m WHERE m.id = p.master_account_id AND m.is_super_user)
      THEN p.master_account_id
    ELSE NULL
  END
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.current_master_user_id() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.current_master_user_id() TO authenticated;

-- 4. RLS for super_user_identities
DROP POLICY IF EXISTS "master reads own identities" ON public.super_user_identities;
CREATE POLICY "master reads own identities" ON public.super_user_identities
  FOR SELECT TO authenticated
  USING (master_user_id = public.current_master_user_id());

-- writes only via server functions (service role bypasses RLS)

-- 5. Allow the master/identities to read each other's profiles (for inbox display etc.)
DROP POLICY IF EXISTS "super user reads linked profiles" ON public.profiles;
CREATE POLICY "super user reads linked profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.current_master_user_id() IS NOT NULL
    AND (
      id = public.current_master_user_id()
      OR master_account_id = public.current_master_user_id()
    )
  );

-- 6. Unified inbox: super user (or any identity) can read threads/messages
-- belonging to any identity in the same group.
DROP POLICY IF EXISTS "super user reads group threads" ON public.message_threads;
CREATE POLICY "super user reads group threads" ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    public.current_master_user_id() IS NOT NULL
    AND (
      participant_a IN (
        SELECT id FROM public.profiles
        WHERE id = public.current_master_user_id()
           OR master_account_id = public.current_master_user_id()
      )
      OR participant_b IN (
        SELECT id FROM public.profiles
        WHERE id = public.current_master_user_id()
           OR master_account_id = public.current_master_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "super user reads group messages" ON public.messages;
CREATE POLICY "super user reads group messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = messages.thread_id
        AND public.current_master_user_id() IS NOT NULL
        AND (
          t.participant_a IN (
            SELECT id FROM public.profiles
            WHERE id = public.current_master_user_id()
               OR master_account_id = public.current_master_user_id()
          )
          OR t.participant_b IN (
            SELECT id FROM public.profiles
            WHERE id = public.current_master_user_id()
               OR master_account_id = public.current_master_user_id()
          )
        )
    )
  );

-- 7. Update privilege escalation trigger to also block is_super_user / master_account_id edits
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  OR NEW.master_account_id  IS DISTINCT FROM OLD.master_account_id THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

-- 8. Mark existing admin(s) as super user
UPDATE public.profiles SET is_super_user = true WHERE is_admin = true;
