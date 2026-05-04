
-- Trigger functions should never be callable directly
REVOKE EXECUTE ON FUNCTION public.notify_on_comment_like() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_reply() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bump_thread_on_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_report() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_post() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_story() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_listing() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_new_rental() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_telegram(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_application() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_application_accepted() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_rental_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_member_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_rental_photo_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, authenticated, public;

-- Anon should not be able to call authenticated-only RPCs
REVOKE EXECUTE ON FUNCTION public.consume_supplier_invite(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_supplier_invite_by_token(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_phone(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;

-- Counter increments are called by signed-in users only
REVOKE EXECUTE ON FUNCTION public.increment_supplier_view(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_supplier_contact(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_post_view(uuid) FROM anon, public;

-- resolve_invite_code and record_invite_click are called from /join landing (may be anon) - keep as-is
