DROP TRIGGER IF EXISTS tg_notify_new_post ON public.posts;
CREATE TRIGGER tg_notify_new_post AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_post();

DROP TRIGGER IF EXISTS tg_notify_new_report ON public.reports;
CREATE TRIGGER tg_notify_new_report AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_report();

DROP TRIGGER IF EXISTS tg_notify_new_story ON public.stories;
CREATE TRIGGER tg_notify_new_story AFTER INSERT ON public.stories FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_story();

DROP TRIGGER IF EXISTS tg_notify_new_listing ON public.listings;
CREATE TRIGGER tg_notify_new_listing AFTER INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_listing();