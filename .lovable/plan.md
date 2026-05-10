# Start a Project — Implementation Plan

A private owner↔worker project space, created from any user profile (except supplier stores). All fields optional except picking the worker. Once accepted, the chat thread becomes the "project space" with check-in / check-out / photo / completion / rating actions.

## 1. Database (migration)

New tables (all RLS — only owner & worker can read/write their project):

- **`projects`** — `id, owner_id, worker_id, status (pending|active|completed|declined), agreed_price numeric null, checkin_required bool, checkout_required bool, photo_frequency text null (morning|midday|endofday), start_date date null, duration text null, completion_requested_by uuid null, created_at, updated_at`
- **`project_logs`** — `id, project_id, user_id, log_type (checkin|checkout|photo), photo_url text null, created_at`
- **`project_ratings`** — `id, project_id, rater_id, rated_id, stars int (1–5), comment text null (≤100), created_at`  (unique on project+rater)
- **`project_messages`** — `id, project_id, sender_id, content text, created_at`  (kept separate from existing `messages` so the project space is self-contained)
- Storage bucket **`project-photos`** (public read, owner/worker write)
- Trigger: when `projects.status` becomes `active`, insert a notification for the worker; when completion is requested/confirmed, notify the other party.

RLS: only `owner_id` or `worker_id` can SELECT/INSERT/UPDATE rows for their project. Logs/messages/ratings inherit via project membership.

## 2. Server function

`src/lib/projects.functions.ts`
- `createProjectRequest({ workerId, ...optional fields })` — owner creates a `pending` project, notifies worker.
- `respondToProject({ projectId, accept })` — worker sets status `active` or `declined`, notifies owner.
- `requestCompletion({ projectId })` — sets `completion_requested_by`, notifies the other party.
- `confirmCompletion({ projectId })` — sets status `completed`, notifies both.
- `submitRating({ projectId, stars, comment })` — inserts rating (any time after completed).

## 3. UI

**Profile button (`src/routes/users.$userId.tsx` and own profile)**
- Add green `Start a project` button (#0F6E56) directly under the existing "Publish project" button, with a small amber "NEW" badge top-right. Hidden on supplier-store views (supplier-store routes are separate, no change needed there). Hidden when viewing your own profile or another supplier-only profile.

**Step 2 — `src/routes/projects.new.$workerId.tsx`**
White background. Form: agreed price toggle + amount, check-in toggle, check-out toggle, photo frequency segmented control (None / Morning / Midday / End of day), start date, duration text. Submit button: green "Send to {worker name}". Only worker selection is enforced (it's already in the URL).

**Step 3 — `src/routes/projects.$projectId.tsx` (pending view)**
Shown to the worker when `status=pending`. Owner avatar + "wants to start a project with you", summary card listing only filled fields, helper note, Decline (muted red) / Accept (green) buttons.

**Step 4 — same route, active view**
Once accepted, the page becomes the **private project space**:
- Worker panel: large green Check-in / Check-out buttons (only if enabled), Photo upload button (only if frequency set), today's activity log.
- Owner panel: latest activity, latest photo thumbnail, agreed price line, stats (days active, check-ins, photos).
- **Mini chat** (always visible) — uses `project_messages`, realtime via Supabase channel.
- "Mark as completed" button at the bottom for both.

**Step 5 — completion & rating**
- When one user marks complete, the other sees a banner: "{Name} says the project is finished. Do you confirm?" with No / Yes buttons.
- On confirmation, both see a rating sheet: 5-star tap selector + optional 100-char comment + blue "Submit ratings" button. Skippable.
- Submitted ratings appear publicly on each user's profile (simple list at bottom of profile, future-proof).

## 4. i18n
Add keys: `start_project`, `start_project_new_badge`, `agreed_price`, `yes_set_price`, `no_price`, `attendance_tracking`, `checkin_on_arrival`, `checkout_on_leave`, `daily_progress_photos`, `none/morning/midday/end_of_day`, `start_date`, `duration`, `send_to`, `project_request`, `wants_to_start_project`, `project_summary`, `decline`, `accept_project`, `check_in`, `check_out`, `upload_photo`, `mark_completed`, `confirm_completion_q`, `submit_ratings`, `ratings_public_note`.

## 5. Files

- new: `supabase/migrations/<ts>_start_project.sql` (via migration tool)
- new: `src/lib/projects.functions.ts`
- new: `src/routes/projects.new.$workerId.tsx`
- new: `src/routes/projects.$projectId.tsx`
- edit: `src/routes/users.$userId.tsx` (add button)
- edit: `src/routes/profile.tsx` (add button on own profile)
- edit: `src/lib/i18n.tsx` (translations)
- edit: `src/routes/alerts.tsx` (link `project_request` / `project_accepted` / `project_completion` notifications to `/projects/$projectId`)

## Open questions before I build

1. Photo upload — single latest photo per day, or a gallery of all photos? Spec says "Latest progress photo thumbnail" so I'll show the latest + tap to view all.
2. Ratings on profile — show aggregate stars + comment list, or just the average? I'll show average + recent comments.
3. The existing `messages`/`message_threads` tables — should the project chat reuse them or stay separate? I'll keep `project_messages` separate so the project space stays self-contained and doesn't pollute the user's main inbox. Tell me if you want it merged.

Reply **go** to build, or tell me what to change.