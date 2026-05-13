# Rollout plan — 4 phases

The scope you selected is huge. I'll ship in phases so you can review each one before I move on. Most of "Start a Project" and "Find My Material" already exists in the codebase — the gap is mostly UI polish + the new BOOM/Rewards system (which is the bulk of new work).

---

## Phase 0 — Quick fix (this turn)

- Change default `supplier_settings.min_quantity` from 100 → 1, and update the existing supplier row that has 100 down to 1 so test requests stop being silently filtered.
- Add green "Start a project" button on profile (#0F6E56) with amber "NEW" badge, between "Publish project" and "Free project help". Already wired to `/projects/new/$workerId` flow which exists.

## Phase 1 — Find My Material polish (next turn)

- Move "Find my material" entry to top-bar split with "Invite friends" on `/home`.
- New search form: 9 categories (add Paint), enforce 1-3 photos, near_me/anywhere filter UI, validation messages.
- "My searches" list with status badges + 10-active-search limit message.
- Supplier `/online-orders` panel: badge count, photo display, settings (min qty + categories editable).

## Phase 2 — Start a Project completion (turn after)

- Verify Step 2 form has all 7 fields (search, price toggle, check-in, check-out, photo freq, start date, duration).
- Worker accept/decline screen with summary card (skip empty fields).
- Project space: conditional rendering of check-in/out/photo sections based on settings, never empty.
- Mark complete → confirm → ratings flow.

## Phase 3 — Availability + Rewards (multi-turn, biggest)

This is essentially a new app section. Will require:
- 5 new tables (daily_availability, lottery_tickets, streak_tracker, lottery_draws, prize_claims)
- BOOM ticket screen + Availability gate (one-per-day check)
- Rewards Panel inside profile with active ticket, streak, prizes
- BuildHub Rewards super-user identity setup
- Draw management admin panel (auto/manual)
- Auto-publish winner post on feed
- Push notifications + 48h claim expiry (needs cron)
- Streak nightly job (pg_cron or scheduled server fn)

I'll break Phase 3 into 3-4 sub-turns when we get there.

---

## This turn deliverable

Just Phase 0: the supplier min_qty fix + the green "Start a project" button. That unblocks your supplier testing and gets the most-asked-for button visible. Then you tell me to continue with Phase 1.

Approve to proceed.