-- Remove the one-store-per-user limit so a single user can create multiple supplier stores.
-- Keeps a non-unique index on user_id for the existing lookups in AppShell / settings / profile.

DO $$
DECLARE
  _conname text;
BEGIN
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'public.supplier_stores'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%(user_id)%';

  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.supplier_stores DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS supplier_stores_user_id_idx
  ON public.supplier_stores (user_id);
