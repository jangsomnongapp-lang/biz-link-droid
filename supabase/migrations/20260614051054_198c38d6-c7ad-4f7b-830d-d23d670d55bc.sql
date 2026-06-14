DROP POLICY IF EXISTS "no direct select on app_settings" ON public.app_settings;

ALTER PUBLICATION supabase_realtime DROP TABLE public.projects;
ALTER PUBLICATION supabase_realtime DROP TABLE public.project_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.project_messages;