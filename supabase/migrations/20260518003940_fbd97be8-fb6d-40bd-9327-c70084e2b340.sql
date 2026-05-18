
-- Critical performance indexes for feed, listings, and profile queries
CREATE INDEX IF NOT EXISTS idx_posts_status_created ON public.posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_status_created ON public.listings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user ON public.listings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rental_listings_status_created ON public.rental_listings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_applicant ON public.applications (applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_listing ON public.applications (listing_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_photos_user ON public.portfolio_photos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_categories_listing ON public.listing_categories (listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing ON public.listing_photos (listing_id);
CREATE INDEX IF NOT EXISTS idx_post_photos_post ON public.post_photos (post_id);

CREATE INDEX IF NOT EXISTS idx_message_threads_a ON public.message_threads (participant_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_threads_b ON public.message_threads (participant_b, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_worker ON public.projects (worker_id, created_at DESC);

-- For comment likes joins
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON public.comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS idx_rental_comment_likes_comment ON public.rental_comment_likes (comment_id);

-- Analyze to update planner statistics
ANALYZE public.posts;
ANALYZE public.listings;
ANALYZE public.rental_listings;
ANALYZE public.applications;
ANALYZE public.notifications;
