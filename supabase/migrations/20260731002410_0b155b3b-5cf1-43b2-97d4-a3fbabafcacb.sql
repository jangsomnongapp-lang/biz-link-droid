TRUNCATE TABLE
  public.comment_likes, public.post_likes, public.post_comments, public.post_photos, public.posts,
  public.story_views, public.stories,
  public.applications, public.listing_categories, public.listing_photos, public.listings,
  public.rental_comment_likes, public.rental_comments, public.rental_likes, public.rental_photos, public.rental_requests, public.rental_listings,
  public.project_logs, public.project_messages, public.project_ratings, public.projects,
  public.messages, public.message_threads,
  public.notifications, public.device_tokens,
  public.material_request_photos, public.material_request_responses, public.material_requests,
  public.supplier_categories, public.supplier_settings, public.supplier_store_categories, public.supplier_store_photos, public.supplier_stores, public.supplier_invites,
  public.prize_claims, public.lottery_tickets, public.lottery_draws, public.streak_tracker, public.daily_availability,
  public.invite_clicks, public.invite_joins, public.invite_rewards, public.invite_codes,
  public.reports, public.portfolio_photos, public.user_categories,
  public.password_reset_codes, public.telegram_password_resets, public.super_user_identities
RESTART IDENTITY CASCADE;

DELETE FROM auth.users
WHERE id NOT IN (
  'dde116c0-8e2b-413c-9a4e-43302225e521',
  'a125549f-e001-4202-a09c-343c76b77dfa'
);

DELETE FROM public.profiles
WHERE id NOT IN (
  'dde116c0-8e2b-413c-9a4e-43302225e521',
  'a125549f-e001-4202-a09c-343c76b77dfa'
);