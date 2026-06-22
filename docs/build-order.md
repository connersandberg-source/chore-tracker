# Build Order — ChoreTracker

| | |
|---|---|
| **Author** | Blueprint (App Studio) |
| **Date** | 2026-06-21 |
| **Pairs with** | architecture.md |
| **Style** | Tracer-bullet. Each step is independently verifiable; no step assumes a later step exists. |

How to use this: do the steps **in order**. Each has a paste-ready prompt for Claude Code that does *only that step*. Finish and verify a phase before starting the next — there's an explicit **PHASE COMPLETE** gate at the end of each. Verification commands assume PowerShell on Windows (the user's environment) and the repo root `C:\Users\conne\chore-tracker`.

Reference conventions live in Anchor (`C:\Users\conne\anchor`): Next 16 App Router, Tailwind v4, Zod schemas as source of truth, a repository layer the UI calls, `@/` alias, `manifest.ts` + `public/sw.js` + `ServiceWorkerRegistrar`, ISO-date helpers. House rule: **read `node_modules/next/dist/docs/` before writing Next code** (Next 16 differs from training data).

---

## Phase 0 — Scaffold & deploy an empty shell

Goal: a deployed, blank Next.js PWA on Vercel. Prove the pipe end to end before any logic.

**Step 0.1 — Initialize the Next.js project.**
> In `C:\Users\conne\chore-tracker`, scaffold a Next.js 16 app (App Router, TypeScript, Tailwind v4, ESLint, `@/` import alias, `src`-less `app/` at root) matching the structure and tooling of the Anchor app at `C:\Users\conne\anchor` (compare `package.json`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`). The `docs/` folder already exists — don't touch it. Add `@supabase/supabase-js` and `@supabase/ssr`; do NOT add dexie. Get `npm run dev` and `npm run build` passing with a placeholder home page. Add a `CLAUDE.md` / `AGENTS.md` that says to read `node_modules/next/dist/docs/` before writing Next code.

**Step 0.2 — PWA shell (manifest, SW, registrar, offline page).**
> Add PWA support mirroring Anchor's pattern: `app/manifest.ts` (name "ChoreTracker", short_name "Chores", standalone, versioned icon URLs), placeholder `public/icon.svg` + `public/icon-maskable.svg` + a 180×180 `public/apple-touch-icon-v1.png`, `public/sw.js` (network-first navigations with `/offline` fallback, cache-first same-origin static, cache name `chore-tracker-v1`), `components/shell/service-worker-registrar.tsx` (`"use client"`, registers `/sw.js`), an `app/offline/page.tsx`, and wire icons/viewport/appleWebApp metadata into `app/layout.tsx`. Read `node_modules/next/dist/docs/` for the Next 16 manifest/metadata APIs first.

**Step 0.3 — Deploy to Vercel.**
> Connect this repo to a new git-connected Vercel project named `chore-tracker` and deploy. Confirm the live URL loads, the manifest is served, and the app is installable to a phone home screen. Report the production URL.

> **PHASE 0 COMPLETE when:** `chore-tracker.vercel.app` loads the placeholder page, installs as a PWA, and `npm run build` is green. Tell the user explicitly before moving on.

---

## Phase 1 — Supabase project, schema & RLS (the spine)

Goal: the full database exists with RLS, seeded with one family + three kids' chores/rewards. No app wiring yet — verified in the Supabase SQL editor.

**Step 1.1 — Create the Supabase project + local CLI migrations.**
> Initialize Supabase for this repo: create a `supabase/` folder with the CLI (`supabase init`), link to a new free-tier project, and set up a numbered-migrations workflow. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` to a local `.env.local` and document `SUPABASE_SERVICE_ROLE_KEY` as server-only (do NOT prefix it `NEXT_PUBLIC_`). Add `.env.local` to `.gitignore`. Don't write app code yet.

**Step 1.2 — Migration: enums + core tables.**
> Write the first migration creating the enums (`user_role`, `recurrence_type`, `completion_status`, `redemption_status`) and tables `families`, `profiles`, `chores`, `chore_completions`, `rewards`, `redemptions`, `point_adjustments` exactly as specified in `docs/architecture.md` §2 — every table `family_id`-keyed, all FKs, the `unique(chore_id, due_date)` constraint, the points/cost checks, and the indexes listed. Apply it and confirm the tables exist.

**Step 1.3 — Migration: balance view + RPC functions + auto_approve trigger.**
> Write a migration adding: the `v_child_balance` view (architecture §2.9), the `auth_family_id()` and `auth_is_admin()` SECURITY DEFINER helpers (§3.1), the SECURITY DEFINER RPCs `approve_completion`, `reject_completion`, `fulfill_redemption`, `deny_redemption` (§3.3), and the `chore_completions` insert trigger that honors `families.auto_approve`. Apply and unit-check each RPC in the SQL editor with dummy rows.

**Step 1.4 — Migration: enable + write all RLS policies.**
> Write a migration that enables RLS on every table and creates the policies exactly as spelled out in architecture §3.2 (universal `family_id = auth_family_id()` gate; admin full-access; child read-own-active; child completion insert/update/delete restricted to own `pending` rows with no `status`/`points_awarded` writes; rewards read-active; redemption insert-own-pending). Then, in the SQL editor, impersonate a child and a parent (set `request.jwt.claims`) and verify a child cannot read/write a sibling's rows and cannot self-approve.

**Step 1.5 — Seed data.**
> Write `supabase/seed.sql` creating ONE family ("Sandberg household", timezone `America/New_York`, `auto_approve=false`), and the three children's chores + a starter reward catalog from `docs/content.md` (Zane, Alaina, Conner; the 9 chores). **Point values, per-chore recurrence, and rewards are still TBD from the client** — use clearly-marked placeholder values (e.g. 5–20 pts, sensible daily/weekly recurrences) with a `-- CLIENT TBD` comment on each so they're a one-line edit later. Note: the actual auth users + profiles are created in Phase 2 (auth), so seed only the family row here and leave profile/chore seeding to run after kids exist, or seed family + rewards now and chores after profiles. Document the ordering.

> **PHASE 1 COMPLETE when:** all migrations apply cleanly on a fresh DB, the impersonation test in 1.4 proves child isolation + no self-approve, and seed runs. Tell the user, and flag to Defender that the RLS impersonation test passed.

---

## Phase 2 — Auth & the authed shell

Goal: Mom and kids can log in; the app routes by role; RLS-scoped reads work from the app.

**Step 2.1 — Supabase clients + middleware session.**
> Add `lib/supabase/client.ts` (browser, anon), `lib/supabase/server.ts` (RSC/route-handler, cookies, anon), `lib/supabase/middleware.ts` (session refresh helper), and `middleware.ts` at root using `@supabase/ssr`, following the current `@supabase/ssr` Next App Router guide. `middleware.ts` refreshes the session and gates `(app)` routes (require session → redirect to `/login`) and `(auth)` routes (redirect signed-in users to `/`). No service-role client yet.

**Step 2.2 — Zod domain schemas.**
> Create `lib/domain/schemas.ts` as the source of truth (Anchor convention): Zod schemas + inferred types for `Family`, `Profile`, `Chore`, `ChoreCompletion`, `Reward`, `Redemption`, `PointAdjustment`, and the `ChildBalance` view row, matching architecture §2 columns/enums exactly. Add `lib/domain/index.ts` barrel. No DB calls.

**Step 2.3 — Login page + AuthProvider.**
> Build `app/(auth)/login/page.tsx` (email + password, large kid-friendly tap targets, Supabase `signInWithPassword`) and `providers/auth-provider.tsx` exposing `{ session, profile }` (profile loaded from `profiles` by `auth.uid()`, giving `role` + `family_id`). Wire `AuthProvider` into `app/layout.tsx`. Create a temporary test admin + one test child directly in the Supabase dashboard to log in with. Verify both can sign in and the provider exposes the right role.

**Step 2.4 — Role router + authed shell.**
> Build `app/(app)/layout.tsx` (authed shell with role-aware nav from `components/shell/nav.tsx`) and `app/(app)/page.tsx` that reads `profile.role` and renders the kid view placeholder for `child` or redirects `admin` to `/admin` (placeholder). Add a sign-out control. Verify: admin lands on `/admin`, child lands on the checklist placeholder, signing out returns to `/login`.

> **PHASE 2 COMPLETE when:** both roles log in, are routed correctly, and an authed RSC can read its own `profiles` row through RLS. Tell the user.

---

## Phase 3 — Vertical slice A: Mom creates & assigns a chore

Goal: the first real loop segment — admin chore CRUD with recurrence — end to end against live RLS.

**Step 3.1 — Chores repository.**
> Add `lib/db/repositories/chores.ts` (and `lib/db/repositories/profiles.ts` for listing the family's children) wrapping the Supabase client: `listChores`, `listChildren`, `createChore`, `updateChore`, `deleteChore`. The UI calls these, never the raw client (Anchor convention). Validate inputs/outputs with the Zod schemas.

**Step 3.2 — Admin chore management UI.**
> Build `app/(app)/admin/chores/page.tsx`: list the family's chores grouped by child, and a create/edit form with title, optional description, assigned child (dropdown of children), point value, and recurrence (one-off / daily / specific weekdays via weekday toggles writing the `weekdays` 0–6 array), plus `start_date` and `active`. Delete with confirm. Use the repository from 3.1. Large tap targets.

**Step 3.3 — Verify chore CRUD under RLS.**
> Logged in as the test admin, create a chore for each test child, edit one, set one to weekly on chosen weekdays, delete one. Confirm rows land in Supabase with correct `family_id`, `child_id`, `weekdays`. Then confirm (DB-side) a child token cannot insert/update a chore.

> **PHASE 3 COMPLETE when:** Mom can create/edit/delete assigned chores with all three recurrence modes, persisted under RLS. Tell the user.

---

## Phase 4 — Vertical slice B: Kid checklist, recurrence & check-off

Goal: the computed daily checklist + check-off/undo. This is the recurrence engine proving Decision 1.

**Step 4.1 — Date + recurrence logic.**
> Add `lib/domain/dates.ts` (ISO `YYYY-MM-DD` helpers including `todayInZone(tz)` computing the current date in the family's timezone, per architecture §7) and `lib/domain/recurrence.ts` (`isChoreDueOn(chore, isoDate)` and `buildTodayChecklist(chores, completions, today)` per §7). Pure functions, no DB. Add quick unit checks: a daily chore is due every day on/after `start_date`; a weekly chore only on its weekdays; a one-off only on `start_date`.

**Step 4.2 — Completions repository.**
> Add `lib/db/repositories/completions.ts`: `listCompletionsForDate(childId, isoDate)`, `checkOff(choreId, childId, isoDate)` (insert a `pending` completion), `undo(completionId)` (delete/revert while pending). Zod-validated. RLS does the scoping.

**Step 4.3 — Kid checklist page.**
> Build `app/(app)/checklist/page.tsx`: compute `today = todayInZone(family.timezone)`, fetch the child's active chores + today's completions, run `buildTodayChecklist`, render today's due chores with done/pending/not-done state and big check-off toggles. Check-off inserts a pending completion (optimistic UI); undo removes it while still pending; approved items lock. Show the child's current points balance from `v_child_balance` (read-only for now).

**Step 4.4 — Verify the recurrence/reset behavior.**
> As a test child, check off a daily chore today and confirm it shows done; then verify (by setting the device/test date forward, or by querying with tomorrow's ISO date) that tomorrow it shows unchecked again with NO row and NO manual reset. Confirm a weekday chore appears only on its configured weekdays. Confirm undo works before approval and is blocked after.

> **PHASE 4 COMPLETE when:** a kid sees only their own due-today chores, check-off/undo works, and the deterministic daily reset is proven (architecture §7, PRD acceptance). Tell the user, and flag to Defender to confirm the kid cannot see a sibling's checklist.

---

## Phase 5 — Vertical slice C: Approval → points → rewards → redemption

Goal: close the economy. Approval awards points (Decision 2); rewards + escrowed redemption (Decision 3).

**Step 5.1 — Approval queue + completion approval.**
> Add to `lib/db/repositories/completions.ts`: `listPending(familyId)`, and `approve(completionId)` / `reject(completionId)` calling the `approve_completion` / `reject_completion` RPCs. Build `app/(app)/admin/approvals/page.tsx` showing pending completions per child with approve/reject. Verify approval flips status to `approved`, snapshots `points_awarded`, and the child's `v_child_balance` increases by the chore's points.

**Step 5.2 — Rewards repository + admin catalog.**
> Add `lib/db/repositories/rewards.ts` (`listRewards`, `createReward`, `updateReward`, `deleteReward`) and `app/(app)/admin/rewards/page.tsx` for reward CRUD (title, description, cost, active). Verify rewards persist with `family_id` and children can read only `active` ones.

**Step 5.3 — Redemptions repository + kid redeem flow.**
> Add `lib/db/repositories/redemptions.ts` (`listRewardsForChild`, `requestRedemption(rewardId)` — server-validated `balance >= cost` against `v_child_balance`, inserts a `pending` redemption snapshotting `cost`; `cancelRedemption` while pending) and `lib/db/repositories/balances.ts` (`getBalance(childId)`). Build `app/(app)/rewards/page.tsx`: show the catalog, the kid's balance, an affordable/locked state per reward, and a redeem button that escrows points. Verify the balance drops by the escrowed cost immediately (pending counts as held, per the view).

**Step 5.4 — Admin redemption resolution.**
> Add `fulfill(redemptionId)` / `deny(redemptionId)` (RPCs) to the redemptions repo and a redemptions section on `app/(app)/admin/approvals/page.tsx`: approve (fulfill → points stay deducted) or deny (escrow released → balance restored). Verify both outcomes against `v_child_balance`.

**Step 5.5 — (Should, if time) Point adjustments + void/reopen.**
> If time allows (else defer to v1.1 per PRD §7): add `lib/db/repositories/adjustments.ts` + an admin control to apply a signed point adjustment with a required note, and to void/re-open an approved completion. Verify the balance reflects adjustments.

> **PHASE 5 COMPLETE when:** the full loop works manually — create → assign → check off → approve (points awarded) → redeem (escrow) → fulfill/deny — all reconciling through `v_child_balance`. Tell the user, and flag to Defender: confirm a child cannot self-approve a completion or self-fulfill a redemption via the API.

---

## Phase 6 — Realtime

Goal: Mom's dashboard and kids' views update live with no refresh (FR-14).

**Step 6.1 — Enable Realtime replication.**
> In Supabase, enable Realtime (Postgres changes) on `chore_completions`, `redemptions`, and `point_adjustments` (architecture §5). Confirm changes broadcast in the Supabase Realtime inspector.

**Step 6.2 — RealtimeProvider + dashboard wiring.**
> Build `providers/realtime-provider.tsx` subscribing filtered by the user's `family_id` to the broadcast tables, exposing an invalidation signal. Wire `app/(app)/admin/page.tsx` (Mom's live dashboard: all kids' today status + pending approval counts + balances) and the kid checklist/rewards pages to refetch the affected child's checklist/queues/`v_child_balance` on relevant events. Use optimistic check-off reconciled by the realtime echo.

**Step 6.3 — Verify two-client realtime.**
> With two browser sessions (Mom + a kid), confirm: a kid's check-off pops into Mom's approvals instantly; Mom's approval updates the kid's balance instantly; a redemption request/resolution reflects on both — no manual refresh.

> **PHASE 6 COMPLETE when:** the two-client test passes for completion and redemption events. Tell the user.

---

## Phase 7 — PWA polish, seed finalization & deploy v1

Goal: production-ready install, real client data plugged in, deployed.

**Step 7.1 — Real icons + manifest finalization.**
> Replace placeholder icons with final ChoreTracker icons (kid-friendly), regenerate the exactly-180×180 `apple-touch-icon`, bump the manifest icon `?v=` and the `sw.js` cache name. Verify install-to-home-screen and full-screen launch on iOS and Android per architecture §6.

**Step 7.2 — Plug in real seed values (CLIENT INPUT).**
> Once the client provides point values, per-chore recurrence, and the reward catalog (still TBD per `docs/content.md`), update `supabase/seed.sql` / the live data accordingly — a data-only edit, no code change. If still pending at launch, ship the sensible placeholders and note them in the handoff doc for a later one-line update.

**Step 7.3 — Accessibility & kid-friendliness pass.**
> Pass over tap-target sizes, contrast, simple language, one-handed phone use (PRD §6). Confirm the checklist and dashboard load under ~2s on a mid-range phone and check-off feels instant.

**Step 7.4 — Production deploy + smoke test.**
> Set the three env vars in Vercel (service-role key server-scope only), deploy `main`, and run the PRD §8 acceptance checklist against production with real-ish accounts: chore create/assign/recurrence, per-child isolation, daily reset, approval→points, reward redeem→approve/deny, realtime, PWA install, and the API-level cross-child RLS rejection. Write the short how-to guide for Mom (create kids, add chores, define rewards, approve).

> **PHASE 7 COMPLETE = v1 SHIPPED when:** the full PRD §8 acceptance checklist passes against production. Tell the user.

---

## Hand-off summary

**Ready to start building now:** Step 0.1. The schema, RLS, auth, realtime, recurrence, and PWA designs are fully specified in `architecture.md`; every step above is dependency-ordered and independently verifiable.

**Open client inputs (don't block the build):** point values, per-chore recurrence, and the reward catalog (`docs/content.md`). Build on placeholders; finalize in Step 7.2 as a data-only edit.

**Defender watch items (recap from architecture §8–9):**
1. **Service-role key** — server-scope only in Vercel, never `NEXT_PUBLIC_`, `import 'server-only'` in `lib/supabase/admin.ts`. The create-child route must derive `family_id` from the caller's profile, not the request body.
2. **RLS is the boundary** — verify (Step 1.4, and again 4.4 / 5 / 7.4) a child cannot read/write a sibling's rows, cannot self-approve a completion, cannot self-fulfill a redemption, cannot write `points_awarded`/`status`/`cost`.
3. **Escrow race** — redemption affordability re-checked server-side against `v_child_balance`.
4. **Service worker** must not cache authenticated Supabase responses — shell + static only.
5. **Minors' PII / no third parties** — no LLM, no analytics SDK in v1; if AI is ever requested, it's a new design requiring a server-side proxy with zero-retention flags and no child PII (architecture §8).

**Relevant files:**
- `C:\Users\conne\chore-tracker\docs\architecture.md`
- `C:\Users\conne\chore-tracker\docs\build-order.md`
