# Store Followers

## What will change

1. **Follow button on store pages**: Each shop page gets a Follow / Following button next to the contact buttons. Tapping it again unfollows. Visitors who aren't signed in are sent to log in first.
2. **Live follower counts**: The shop header shows the follower count, number of products, and location. Shop cards in the Materials and Machinery lists also show the follower count.
3. **Feed priority for followed shops**: In the Home feed, posts from shops you follow appear higher and carry a small "Following" badge. Other posts stay the same.
4. **Alerts only for important posts**: Followers get an alert when a shop they follow posts an Offer or Clearance. Normal posts and catalog edits don't send alerts.
5. **My Shop insights card**: Shop owners see Followers, Views, and Inquiries (taps on Call, Telegram, or Chat) as separate numbers.
6. **Fair counting**: Shops can't follow themselves. Each account can follow a shop once. The count only includes registered accounts, which sets up future free-month rewards.

The free-month rewards and the "Popular Material Stores" section are left for a later step.

## Technical details

- New table `store_followers` (store_id → supplier_stores, user_id → auth.users, unique pair, created_at) with grants, RLS (authenticated can read; users can insert or delete only their own rows; inserting is blocked when the user owns the store).
- SECURITY DEFINER `store_follower_counts(_store_ids uuid[])` returns counts in bulk for cards and headers.
- Trigger on `posts` insert: when post_type is offer or clearance and the author owns an approved store, add a `notifications` row for each follower. This reuses the existing push-on-notification pipeline.
- `suppliers.$storeId.tsx`: follow button with an optimistic toggle, plus counts (followers, catalog items).
- `suppliers.index.tsx`: follower count on cards via the bulk RPC.
- `home.tsx`: load the user's followed store owner IDs, sort their posts first within each page, and show the badge. Memoized cards stay as they are.
- My Shop insights: existing `view_count` / `contact_count` plus the follower count.
- i18n keys in km/en: follow, following, followers, inquiries, following_badge.
