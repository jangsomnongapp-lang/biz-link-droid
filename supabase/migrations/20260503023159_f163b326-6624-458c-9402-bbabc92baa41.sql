-- Add member_number column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS member_number bigint UNIQUE;

-- Sequence starting at 9, increment by 10
CREATE SEQUENCE IF NOT EXISTS public.profile_member_number_seq START WITH 9 INCREMENT BY 10 MINVALUE 9;

-- Backfill existing rows ordered by created_at
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.profiles
  WHERE member_number IS NULL
)
UPDATE public.profiles p
SET member_number = 9 + (o.rn - 1) * 10
FROM ordered o
WHERE p.id = o.id;

-- Advance sequence past current max
SELECT setval('public.profile_member_number_seq', GREATEST(9, COALESCE((SELECT MAX(member_number) FROM public.profiles), -1) + 10) - 10 + 10, true);

-- Trigger to assign on insert
CREATE OR REPLACE FUNCTION public.assign_member_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    NEW.member_number := nextval('public.profile_member_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_member_number ON public.profiles;
CREATE TRIGGER trg_assign_member_number
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_member_number();