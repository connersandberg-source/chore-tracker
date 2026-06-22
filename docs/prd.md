# Product Requirements Document — ChoreTracker

| | |
|---|---|
| **Author** | Conner Sandberg (App Studio) |
| **Date** | 2026-06-21 |
| **Version** | 1.0 |
| **Related BRD** | brd.md |
| **Platform** | Web (installable PWA) |

---

## 1. Overview

ChoreTracker is a Next.js PWA (deployed on Vercel, backed by Supabase) for a single household. Mom (admin) creates chores and assigns each to a specific child, as a one-off or a recurring task. Each child logs in on their own device and sees only their personal checklist. Completing a chore earns points; Mom approves the completion (default), then points are awarded. Children spend points on rewards Mom defines, via a redemption flow Mom approves. Mom sees all activity in real time. Row-Level Security keeps each child's data private to them and Mom.

## 2. Goals & Non-Goals

**Goals:**
- Deliver the validated core loop end to end: create → assign → recurring/one-off → kid checklist → check off → points → redeem → real-time visibility.
- Strict per-child data isolation via Supabase RLS; one admin sees everything.
- Reliable automatic daily reset of recurring chores.
- Run entirely on Vercel + Supabase free tiers.

**Non-goals (deliberately NOT in v1):**
- Multiple families or multi-tenant sign-up (single family; schema is family-keyed so this is addable later).
- Multiple/co-parent admin accounts.
- Web push notifications (planned for v1.1).
- Photo proof of completion, chore comments/chat, monthly recurrence.
- Real money / allowance payouts, payment integrations.
- Native app-store apps.
- Any AI/LLM feature.

## 3. Target Users / Personas

- **Mom (Admin)** — the household organizer; moderate tech comfort (uses apps daily, not technical). Uses ChoreTracker on her phone throughout the day to assign chores, glance at completion, and approve redemptions. Wants minimal setup effort and to stop nagging.
- **Child (7–14)** — varied tech comfort; uses a phone or tablet. Wants a simple, clearly-personal list, instant credit for finishing, and visible progress toward a reward. Low tolerance for friction (logins, errors).

## 4. User Stories

| ID | As a… | I want to… | So that… | Priority |
|----|-------|-----------|----------|----------|
| US-1 | Mom | create a chore and assign it to a specific child | they know it's theirs to do | Must |
| US-2 | Mom | make a chore recurring (daily or chosen weekdays) | I don't re-create it every day | Must |
| US-3 | Mom | set how many points a chore is worth | effort maps to reward | Must |
| US-4 | Mom | create accounts for each of my children | they can each log in on their own device | Must |
| US-5 | Child | log in and see only my own chores for today | I know exactly what to do | Must |
| US-6 | Child | check off a chore I've completed | I get credit for it | Must |
| US-7 | Mom | approve a completed chore before points are awarded | points reflect real work | Must |
| US-8 | Child | see my current points balance | I know how close I am to a reward | Must |
| US-9 | Mom | define rewards with a point cost | kids have something to work toward | Must |
| US-10 | Child | redeem points for a reward | I get something for my effort | Must |
| US-11 | Mom | approve (or deny) a redemption | I control when rewards are actually given | Must |
| US-12 | Mom | see all my children's chore status in real time | I can trust the system without asking | Must |
| US-13 | Child | not see or change my sibling's chores or points | my list stays mine | Must |
| US-14 | Mom | adjust a child's points or void/re-open a completion | I can fix mistakes | Should |
| US-15 | Mom | edit or delete a chore and its recurrence | the routine can change | Should |
| US-16 | Mom | be notified when a chore is completed (and child when one is assigned) | I don't have to keep checking | Should (v1.1) |
| US-17 | Mom | see a child's completion history | I can spot patterns | Could |

## 5. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | The system shall provide a parent/admin account and per-child accounts, each authenticated by email + password (Supabase Auth) | Must |
| FR-2 | The system shall let the admin create child accounts (provision email + temporary password, or invite) and view the list of children | Must |
| FR-3 | The system shall let the admin create a chore with: title, optional description, assigned child, point value, and recurrence (one-off / daily / specific weekdays) | Must |
| FR-4 | The system shall let the admin edit and delete chores | Must |
| FR-5 | For recurring chores, the system shall present an instance for the current day on the assigned child's checklist whenever that day matches the recurrence, and shall NOT carry yesterday's checked state into today | Must |
| FR-6 | The system shall show each child a checklist of only their own chores due today, with done/not-done state | Must |
| FR-7 | The system shall let a child mark their own chore complete (and undo before approval) | Must |
| FR-8 | The system shall, on completion, create a pending completion record; points are awarded only after admin approval (default model — see §11/Decision 2) | Must |
| FR-9 | The system shall let the admin approve or reject a pending completion; approval awards the chore's points to the child's balance | Must |
| FR-10 | The system shall maintain each child's current points balance as the sum of approved earnings minus approved redemptions and admin adjustments | Must |
| FR-11 | The system shall let the admin create, edit, and delete rewards (title, optional description, point cost, active flag) | Must |
| FR-12 | The system shall let a child request to redeem a reward they can afford, creating a pending redemption that holds/escrows the points | Must |
| FR-13 | The system shall let the admin approve or deny a redemption; approval deducts points, denial returns the held points | Must |
| FR-14 | The system shall update the admin's dashboard and children's views in real time as completions/redemptions occur (Supabase Realtime) | Must |
| FR-15 | The system shall enforce Row-Level Security so a child can read/write only their own chores, completions, redemptions, and balance, and the admin can read/write all records within the family | Must |
| FR-16 | The system shall let the admin adjust a child's points (manual +/- with a note) and void/re-open an approved completion | Should |
| FR-17 | The system shall be installable as a PWA (manifest + service worker + home-screen icon) | Should |
| FR-18 | The system shall send web push notifications for "chore completed" (to admin) and "chore assigned" (to child) | Won't (v1) / planned v1.1 |
| FR-19 | The system shall present a per-child completion history view | Could |

## 6. Non-Functional Requirements

- **Performance:** Checklist and dashboard load in under 2s on a mid-range phone; check-off feels instant (optimistic UI, realtime confirm).
- **Security:** Auth required for all data; RLS enforced server-side (never trust the client); admin-only actions (approvals, account creation, reward management) gated by role. Supabase service keys never exposed client-side.
- **Privacy / data:** Personal data about minors stays in the client's Supabase project; no LLM/analytics third parties; only data needed for the loop is collected (see BRD §11).
- **Reliability:** Recurring-chore reset must be deterministic and not depend on a server being awake at midnight (see Decision 1).
- **Accessibility:** Large tap targets for kids, readable contrast, simple language; works one-handed on a phone.
- **Devices / browsers:** Modern mobile + desktop browsers (iOS Safari, Chrome, Edge); installable to iOS/Android home screens.

## 7. MVP Scope

**MVP (build first) — the core loop:**
- Admin + per-child email/password accounts; admin creates child accounts.
- Create / edit / delete chores with assignment, point value, and recurrence (one-off, daily, specific weekdays).
- Per-child checklist of today's chores with check-off; deterministic daily reset (Decision 1).
- Completion → pending → **admin approval awards points** (Decision 2 default).
- Mom-defined reward catalog; child redemption request → admin approve/deny; points balance accounting (Decision 3).
- Admin real-time dashboard across all children; real-time child views.
- RLS isolation: child sees only their own; admin sees all in the family (Decision 4).
- Family-keyed schema (single family seeded) so multi-family is later-addable without rewrite (Decision 6).
- Installable PWA.

**Later (explicitly deferred):**
- Web push notifications for assigned/completed (Decision 5 → **v1.1**).
- **v1.1 Auth simplification: "Mom invites kid + per-child 4-digit PIN"** as an alternative to email/password (recommended; see Risk in BRD).
- Admin point adjustments / void-completion (Should — include if time allows, else v1.1).
- Per-child completion history view.
- Auto-award mode toggle (flip Decision 2 to award-on-check per family preference).
- Multi-family onboarding / self sign-up; co-parent accounts.
- Photo proof, chore comments, monthly recurrence, leaderboards.

## 8. Acceptance Criteria

- [ ] Mom can create a chore, assign it to a child, set points, and set recurrence (one-off / daily / chosen weekdays) in one flow.
- [ ] A child logs in on their own device and sees only their own chores due today — never a sibling's.
- [ ] A daily recurring chore checked off yesterday appears unchecked again today, with no manual reset by Mom.
- [ ] A weekday-specific chore appears only on its configured weekdays.
- [ ] When a child checks off a chore, it becomes a pending completion and points are NOT yet added.
- [ ] When Mom approves a completion, the child's points balance increases by the chore's value, and the change appears on both views in real time.
- [ ] Mom can create a reward with a point cost; a child can request to redeem it only if they can afford it; the points are held pending.
- [ ] Mom can approve a redemption (points deducted) or deny it (points returned).
- [ ] Mom's dashboard reflects a child's check-off / redemption without a manual refresh (realtime).
- [ ] Attempting (via the API) to read or modify another child's records is rejected by RLS.
- [ ] The app installs to a phone home screen and opens full-screen.

## 9. Dependencies & Assumptions

- **Dependencies:** Vercel (hosting/CI), Supabase free tier (Postgres, Auth, Realtime, RLS). Client provides children's names, initial chores, point values, and the reward catalog.
- **Assumptions:** Each child has a device + modern browser and (for v1 email/password) a usable email address; reliable internet (cloud-backed, not offline-first); Mom is the sole admin.

## 10. Success Metrics

- Recurring chores cover the daily routine; Mom does no daily re-assignment.
- Mom can answer "is it done?" for any child in under 10 seconds from the app.
- Majority of assigned chores completed weekly once points/rewards are live.
- At least one reward redeemed within the first two weeks.
- App live and stable for 2 weeks of daily family use post-launch.

## 11. Open Questions — Resolved (decisions for Blueprint)

These were the six open questions in the brief. Each is resolved below with a recommendation Blueprint should design to. Any item marked *Confirm with client* is a default we'll proceed with unless the client objects.

**Decision 1 — Recurring reset (daily vs weekday; who resets at midnight).**
**Resolution:** Do NOT physically "reset" rows at midnight. Model recurrence as a rule on the chore (`recurrence_type`: `one_off` | `daily` | `weekly`; plus `weekdays` array for weekly). The child's "today" checklist is *computed* for the current local date: a chore is due today if its rule matches today, and its done-state comes from a `chore_completion` row keyed by `(chore_id, due_date)`. Because completions are date-stamped, a new day naturally shows the chore as not-done with zero scheduled jobs. This is the Anchor pattern (a "day" is a display rule over date-keyed records, not a destructive reset) and is the most reliable choice on Vercel/Supabase free tier (no cron required, no missed-midnight risk).
- *Optional later:* a Supabase scheduled function (pg_cron) only if we want to pre-materialize daily instances for history/analytics — not needed for v1.
- *Timezone:* store the family's timezone; compute "today" against it so check-off windows are consistent across devices.

**Decision 2 — Completion approval vs auto-award.**
**Resolution (default): Mom approves before points are awarded.** Rationale: prevents gaming, matches BRD risk mitigation, and keeps Mom in control (she's the one motivated to adopt this). Check-off creates a `pending` completion; approval transitions it to `approved` and credits points. *Build a per-family `auto_approve` flag (default off) so a future toggle can award-on-check without a schema change.* *Confirm with client — but proceed with approval-default.*

**Decision 3 — Reward catalog + redemption/approval flow.**
**Resolution:** `rewards` table (family-scoped): title, description, point cost, active flag. A child requests a redemption only if `balance >= cost`; this creates a `pending` redemption that **escrows** the cost (so they can't double-spend while pending). Mom approves (points deducted, redemption `fulfilled`) or denies (escrow released). Balance = sum(approved completion points) − sum(fulfilled redemption costs) ± admin adjustments. Recommend deriving balance from a ledger/view rather than a single mutable counter, for auditability.

**Decision 4 — Roles & data isolation (RLS).**
**Resolution:** Every row carries `family_id`. Profiles have a `role` (`admin` | `child`) and `family_id`. RLS policies:
- Child: may `select`/`update` only rows where the chore/completion/redemption belongs to *their own* `child_id`; may not see other children's rows; may not change point values or approval state.
- Admin: full access to all rows where `family_id` = their family.
- All policies scoped to the requester's `family_id` (this is also what makes Decision 6 work).
RLS is the security boundary — the client UI must never be trusted to hide data.

**Decision 5 — Notifications (web push).**
**Resolution: Defer to v1.1.** Web push on iOS PWAs is workable but adds setup (service worker push, VAPID keys, per-device subscription, permission UX) that isn't core to the loop. v1 ships realtime in-app updates (FR-14), which already gives Mom live visibility while the app is open. v1.1 adds push for "chore completed" (admin) and "chore assigned" (child).

**Decision 6 — Multi-family / multi-parent.**
**Resolution: Single family in v1, but schema is family-keyed from day one.** Every table has `family_id` and all RLS is scoped by it, so adding multiple families later is an onboarding/UI change, not a rebuild. v1 seeds exactly one family and one admin; self-serve family sign-up and co-parent (second admin) accounts are explicitly deferred.

## 12. Suggested Data Model (for Blueprint — not binding)

Provided so Blueprint can move straight to schema; refine as needed.
- **families** — id, name, timezone, auto_approve (bool, default false).
- **profiles** — id (= auth user id), family_id, role (`admin`|`child`), display_name, email.
- **chores** — id, family_id, child_id (assignee), title, description, points, recurrence_type (`one_off`|`daily`|`weekly`), weekdays (int[] for weekly), active, created_by.
- **chore_completions** — id, family_id, chore_id, child_id, due_date, status (`pending`|`approved`|`rejected`), completed_at, approved_at, points_awarded. Unique on (chore_id, due_date) to prevent double check-off per day.
- **rewards** — id, family_id, title, description, cost, active.
- **redemptions** — id, family_id, child_id, reward_id, cost, status (`pending`|`fulfilled`|`denied`), requested_at, resolved_at.
- **point_adjustments** — id, family_id, child_id, delta, note, created_by, created_at (Should).
- **Balance** — derive from a SQL view summing approved completions − fulfilled/pending-escrowed redemptions ± adjustments, rather than a mutable counter.
