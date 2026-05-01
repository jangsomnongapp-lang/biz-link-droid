ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_specialist boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone, is_provider, is_coordinator, is_organization, is_client, is_specialist, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    coalesce((new.raw_user_meta_data->>'is_provider')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_coordinator')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_organization')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_client')::boolean, false),
    coalesce((new.raw_user_meta_data->>'is_specialist')::boolean, false),
    coalesce(new.raw_user_meta_data->>'language', 'km')
  );
  return new;
end;
$function$;