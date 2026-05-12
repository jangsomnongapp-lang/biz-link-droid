# Find My Material — Implementation Plan

A private supplier-matching flow. Users post a material need (category + photos + qty); only suppliers registered in that category (and matching qty + radius) get notified in-app. Supplier replies "I have it" → opens a regular chat thread; "Sorry" → user gets a generic, anonymized notice. Max 10 active searches per user.

## 1. Database (one migration)

### Tables

**`material_requests`**
- `id, user_id, category text` (electrical|cement|steel|zinc|tools|timber|sanitary|paint|other)
- `quantity int, note text null`
- `location_filter text` (near_me|anywhere) default `near_me`
- `lat double precision null, lng double precision null` (captured at create-time for "near me" matching; nullable so feature still works without geo permission — falls back to anywhere)
- `status text` (active|found|cancelled) default `active`
- `created_at, updated_at`
- **Trigger `enforce_active_request_limit`**: BEFORE INSERT, raise if user already has 10 `active` rows. Surfaced to UI as a friendly toast (UI also pre-checks for the better message).

**`material_request_photos`**
- `id, request_id, photo_url text, sort_order int` (1–3 enforced by trigger)

**`material_request_responses`**
- `id, request_id, supplier_id, response text` (available|unavailable), `created_at`
- UNIQUE `(request_id, supplier_id)` — one response per supplier per request

**`supplier_settings`**
- `id, supplier_id uuid UNIQUE, min_quantity int default 1, categories text[] default '{}', updated_at`

**Storage bucket `material-photos`** — public read; authenticated insert/delete scoped to `auth.uid()` folder (mirrors `rental-photos` policy).

### RLS

- `material_requests`:
  - Owner: full SELECT/INSERT/UPDATE on own rows (UPDATE locked via `WITH CHECK` so `user_id` and `category` can't change; status can move active→found/cancelled only).
  - Suppliers: SELECT only when `status='active'` AND request's category is in their `supplier_settings.categories` AND `quantity >= supplier_settings.min_quantity`. Implemented via `SECURITY DEFINER` helper `supplier_can_see_request(_req_id, _uid)` to keep policy simple and avoid recursion. Distance filter is applied client-side from returned `lat/lng` (don't gate RLS on geography to keep it deterministic).
- `material_request_photos`: readable by anyone who can read the parent request; insert/delete by owner only.
- `material_request_responses`:
  - Supplier inserts own response (must be able to see the request).
  - Owner SELECTs all responses to own requests; supplier SELECTs own responses. **Supplier identity hidden from user when `response='unavailable'`** — handled in app layer by reading via a `SECURITY DEFINER` view/RPC `get_request_response_summary(_req_id)` that returns `{ available_count, unavailable_count, available_supplier_ids[] }`. Raw `supplier_id` for unavailable rows never reaches the user.
- `supplier_settings`: supplier reads/writes own row; anyone authenticated can SELECT (needed for matching) — only non-PII fields; safe.

### Notifications (in-app only, via existing `notifications` table)

Triggers:
- AFTER INSERT on `material_requests` → fan-out: insert one `notifications` row (kind `material_request`) for each supplier where `category ∈ supplier_settings.categories` AND `quantity >= min_quantity`. (Geo filtering done client-side in supplier panel; radius is soft.)
- AFTER INSERT on `material_request_responses`:
  - if `available` → notify owner kind `material_available` ("A supplier has your {category} item — tap to chat"), with `related_user_id = supplier_id` so chat link works.
  - if `unavailable` → notify owner kind `material_unavailable` ("A supplier checked your request but doesn't have this item right now"), with `related_user_id = NULL` (anonymity).

### Server-side helpers (RPCs)
- `start_material_chat(_request_id, _supplier_id)` → finds/creates a `message_threads` row between owner and supplier, posts a system context message ("Material request: ⚡ Electrical · 30 units"), returns `thread_id`. Used by both "Open chat" buttons.

## 2. Server functions (`src/lib/material.functions.ts`)
- `createMaterialRequest({ category, quantity, note, locationFilter, lat, lng, photoUrls[] })` — checks active count ≤ 10, inserts request + photos.
- `cancelMaterialRequest({ requestId })` — sets status `cancelled` (used by both "Found it" and "Cancel").
- `respondToRequest({ requestId, response })` — supplier action.
- `openMaterialChat({ requestId, supplierId })` — wraps `start_material_chat` RPC, returns thread id for navigation.
- `updateSupplierSettings({ minQuantity, categories })`.

## 3. UI

### Top bar on `/home`
Replace the current header strip with two equal-width buttons:
```
[ Invite friends (existing, muted) ] [ Find my material (orange #c87000) → /find-material ]
```
Visible to all authenticated users.

### `/find-material` (Step 1)
- "New material search" (orange) → `/find-material/new`
- "My searches" (dark, badge with active count) → `/find-material/mine`
- Counter line: "X of 10 active searches · Y remaining"

### `/find-material/new` (Step 2)
- 9-pill category grid (single-select, required)
- Photo grid: 3 slots, min 1 required (uses existing `material-photos` bucket, same upload pattern as rentals)
- Quantity number input (required)
- Note textarea (optional, ≤120 chars)
- Location toggle: Near me (default, requests `navigator.geolocation`) / Anywhere
- Sticky submit: "Send request to suppliers" — helper text below dynamically reads "Suppliers in {category} within 20km will be notified" (or "across Cambodia" for Anywhere)
- Limit-reached state: full-screen message + "Manage my searches" button, no silent block.

### `/find-material/mine` (Step 4 — user side)
List of own active requests: category icon · quantity · time · status badge ("{n} replies" / "waiting"). Each card has one button "Found it · Cancel" (calls `cancelMaterialRequest`). Tapping a card with replies → list of available supplier avatars; tap supplier → `openMaterialChat` → navigate to thread.

### Supplier panel — `/online-orders`
- Linked from a new orange "Online orders" button on supplier's own `/profile` (only when `is_supplier=true`), badge = unread requests count.
- Tabs: **Requests** · **My settings**.
- Requests tab: lists requests where supplier matches (category ∈ settings + qty ≥ min + within 20km if request was `near_me`). Each row → category · user name · qty · distance · time, with "Sorry" (muted red) and "I have it" (orange) buttons. "I have it" → records response + opens chat. "Sorry" → records response, no chat.
- Settings tab: min-quantity number input, multi-select category chips (same 9 options).

### Chat context card
In `src/routes/messages.$threadId.tsx`, when the thread's most recent system message is a material-request marker, render a sticky card at top: "⚡ Electrical · 30 units · {note}". Cheap implementation: detect by parsing the system message we inserted in `start_material_chat`.

### Notifications routing (`src/routes/alerts.tsx`)
- `material_request` → supplier panel `/online-orders`
- `material_available` → opens chat with `related_user_id`
- `material_unavailable` → opens `/find-material/mine`

## 4. i18n
Add keys: `find_my_material`, `new_material_search`, `my_searches`, `active_searches_counter`, all 9 category names, `quantity_needed`, `note_optional`, `near_me_20km`, `anywhere_cambodia`, `send_to_suppliers`, `suppliers_will_be_notified`, `limit_reached_msg`, `found_it_cancel`, `i_have_it`, `sorry_not_available`, `online_orders`, `material_requests`, `min_quantity`, `my_categories`, `supplier_has_item`, `supplier_doesnt_have_item`.

## 5. Files

New
- `supabase/migrations/<ts>_find_my_material.sql`
- `src/lib/material.functions.ts`
- `src/routes/find-material.tsx` (Step 1 entry)
- `src/routes/find-material.new.tsx` (Step 2)
- `src/routes/find-material.mine.tsx` (Step 4)
- `src/routes/online-orders.tsx` (Step 5)
- `src/components/MaterialContextCard.tsx`
- `src/components/CategoryPillGrid.tsx` (shared by new search + supplier settings)

Edited
- `src/routes/home.tsx` — add top-bar with two buttons
- `src/routes/profile.tsx` — orange "Online orders" button under "Liquidation" (suppliers only)
- `src/routes/messages.$threadId.tsx` — render `MaterialContextCard` when applicable
- `src/routes/alerts.tsx` — handle 3 new notification kinds
- `src/lib/i18n.tsx` — translations

## Open questions before I build
1. **Geo radius** — I'll use the browser geolocation API and compute distance client-side for both fan-out filtering (in supplier panel) and the user's "Near me" choice. RLS won't enforce 20 km — anyone in the right category can technically see the request server-side. OK with that, or do you want a strict server-side radius (requires PostGIS + more complex RLS)?
2. **Categories overlap with existing `categories` table** — I'm using a fixed enum string list (matches the spec exactly) to keep matching simple. If you'd rather link to `categories.code`, say so.
3. **Photos** — using a new public `material-photos` bucket. OK, or reuse `project-photos`?

Reply **go** to build, or tell me what to change.