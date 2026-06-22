# Architecture — ChoreTracker

| | |
|---|---|
| **Author** | Blueprint (App Studio) |
| **Date** | 2026-06-21 |
| **Version** | 1.0 |
| **Source of truth** | prd.md (esp. §11 decisions, §12 data model), brd.md, charter.md |
| **Platform fork** | **Web** — Next.js PWA on Vercel. Single surface; no mobile/Expo build. |

This is the HOW. It designs strictly within the locked stack (Next.js PWA on Vercel + Supabase Postgres/Auth/Realtime/RLS, free tier). Every table is `family_id`-keyed from day one (PRD Decision 6). Points balance is derived from a ledger view (Decision 3). Recurrence is a computed display rule, no cron (Decision 1). Approval gates points by default with a per-family `auto_approve` flag (Decision 2).

---

## 0. Principles applied

- **Boring & proven.** Plain Supabase JS client, RLS as the security boundary, SQL views for derived state. No state-management library — React + Supabase Realtime + the App Router.
- **RLS is the boundary, not the UI.** The client never decides who-sees-what. Every isolation rule lives in a Postgres policy. The UI only decorates.
- **Derived, not mutated.** Balances and "today's checklist" are computed (a view, a client rule) so there is no counter to drift and no midnight job to miss.
- **Match the user's house style** (Anchor at `C:\Users\conne\anchor`): Next 16 App Router, Tailwind v4, Zod schemas as the source of truth (`lib/domain/schemas.ts`), a repository layer (`lib/db/repositories/*`) that the UI calls instead of touching the data client directly, `@/` path alias, `manifest.ts` + `public/sw.js` + a `ServiceWorkerRegistrar` client component, ISO-date (`YYYY-MM-DD`) helpers in `lib/domain/dates.ts`. The one deliberate divergence: Anchor is local-first (Dexie); ChoreTracker repositories wrap the **Supabase client**, not IndexedDB.

---

## 1. Tech stack & Vercel config

### 1.1 Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC) | Match Anchor. Read `node_modules/next/dist/docs/` before writing Next code (house rule in Anchor's `AGENTS.md`). |
| Language | TypeScript 5, strict | |
| Styling | Tailwind v4 (`@tailwindcss/postcss`) | Match Anchor. Large tap targets for kids (PRD §6 a11y). |
| UI helpers | `clsx` + `tailwind-merge` (`cn()`), `lucide-react`, `class-variance-authority` | Same set as Anchor. |
| Validation | **Zod 4** — `lib/domain/schemas.ts` is the source of truth | Validate every form input and every row crossing the repo boundary. |
| Dates | `date-fns` | ISO-date helpers; family timezone aware (Decision 1). |
| Backend | **Supabase** — Postgres + Auth (email/password) + Realtime + RLS | Free tier. |
| Supabase client | `@supabase/supabase-js` + `@supabase/ssr` | `@supabase/ssr` gives the cookie-based server/client split the App Router needs (middleware session refresh, RSC reads, route-handler writes). |
| Hosting / CI | Vercel | Git-connected for this project (Anchor is CLI-deployed; ChoreTracker should be git-connected so kids' devices always get the deployed build). |

**Dependencies (package.json delta from Anchor):** add `@supabase/supabase-js`, `@supabase/ssr`. Keep `class-variance-authority`, `clsx`, `tailwind-merge`, `date-fns`, `lucide-react`, `zod`, `next`, `react`, `react-dom`. **Drop** `dexie`, `dexie-react-hooks` (no local-first store here).

### 1.2 Environment variables

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL. Public by design. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key. RLS makes this safe to expose. |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used **only** by the admin "create kid account" route handler (it calls `auth.admin.createUser`). **Never** imported into a client component or a `NEXT_PUBLIC_` var. Set in Vercel as a plain (encrypted) env var, server scope only. |
| `SUPABASE_DB_PASSWORD` | local dev only (Supabase CLI) | For running migrations via the CLI; not deployed. |

> Defender watch item: a single accidental `NEXT_PUBLIC_` prefix on the service-role key, or importing `lib/supabase/admin.ts` from a Client Component, leaks god-mode over a database of minors' data. See §9.

### 1.3 Vercel config

- **Framework preset:** Next.js (auto). No `vercel.json` needed for v1; defaults are correct.
- **Project name:** `chore-tracker` → `chore-tracker.vercel.app`.
- **Git connection:** connect the repo so `main` auto-deploys (preferred over Anchor's CLI flow for a multi-user app).
- **Env vars:** set the three runtime vars above in the Vercel dashboard for Production + Preview. Service-role key scoped server-side.
- **Node / build:** defaults (`next build`). No edge runtime required; the Supabase SSR client runs on the Node runtime in middleware and route handlers.
- **Region:** default. Pick the Vercel region nearest the Supabase project region to keep auth/DB round-trips low; not critical at one-family scale.

### 1.4 Repository layout (matches Anchor's shape)

```
chore-tracker/
  app/
    layout.tsx                      # fonts, metadata, viewport, SW registrar, providers
    globals.css
    manifest.ts                     # PWA manifest (Anchor pattern)
    offline/page.tsx                # offline fallback shell
    middleware-free auth pages:
    (auth)/login/page.tsx           # email + password sign-in (kids + mom)
    (app)/
      layout.tsx                    # authed shell: loads profile, role-aware nav
      page.tsx                      # role router → kid checklist OR mom dashboard
      checklist/page.tsx            # KID: today's chores (computed), check off
      rewards/page.tsx              # KID: catalog + balance + redeem
      me/page.tsx                   # KID: balance + redemption status
      admin/
        page.tsx                    # MOM: live dashboard (all kids, pending queues)
        chores/page.tsx             # MOM: chore CRUD + recurrence
        kids/page.tsx               # MOM: create/list child accounts
        rewards/page.tsx            # MOM: reward catalog CRUD
        approvals/page.tsx          # MOM: pending completions + redemptions
  app/api/
    admin/create-child/route.ts     # server-only: service-role createUser + profile
  lib/
    supabase/
      client.ts                     # browser client (anon) — "use client"
      server.ts                     # RSC/route-handler client (cookies, anon)
      middleware.ts                 # session-refresh helper
      admin.ts                      # SERVICE ROLE client — server-only, import-guarded
    domain/
      schemas.ts                    # Zod: Family, Profile, Chore, Completion, Reward, Redemption, Adjustment
      dates.ts                      # ISO date + family-timezone "today" helpers
      recurrence.ts                 # isChoreDueOn(rule, date) + buildTodayChecklist()
      points.ts                     # balance/affordability helpers over the view
      index.ts                      # barrel
    db/
      repositories/
        families.ts
        profiles.ts
        chores.ts
        completions.ts
        rewards.ts
        redemptions.ts
        adjustments.ts
        balances.ts                 # reads the v_child_balance view
  components/
    shell/service-worker-registrar.tsx
    shell/nav.tsx
    checklist/*  rewards/*  admin/*  ui/*
  providers/
    auth-provider.tsx               # exposes session + profile (role, family_id)
    realtime-provider.tsx           # subscribes to family channels
  middleware.ts                     # refresh session + gate (app) and (auth) routes
  supabase/
    migrations/                     # numbered SQL migrations (CLI-managed)
    seed.sql                        # one family, three kids' profiles, chores, rewards
```

---

## 2. Database schema

All tables live in `public`, all carry `family_id uuid not null references families(id)`, and all have RLS enabled. Timestamps are `timestamptz default now()`. Enums are Postgres `enum` types for integrity.

### 2.1 Enums

```sql
create type user_role        as enum ('admin', 'child');
create type recurrence_type  as enum ('one_off', 'daily', 'weekly');
create type completion_status as enum ('pending', 'approved', 'rejected');
create type redemption_status as enum ('pending', 'fulfilled', 'denied');
```

### 2.2 `families`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `name` | `text not null` | e.g. "Sandberg household" |
| `timezone` | `text not null default 'America/New_York'` | IANA tz; "today" is computed against this (Decision 1). |
| `auto_approve` | `boolean not null default false` | Decision 2 toggle. Off = Mom approves before points. |
| `created_at` | `timestamptz default now()` | |

### 2.3 `profiles`

One row per auth user. `id` equals the Supabase Auth `user.id`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` → `references auth.users(id) on delete cascade` | |
| `family_id` | `uuid not null` → `families(id)` | |
| `role` | `user_role not null` | `'admin'` (Mom) or `'child'`. |
| `display_name` | `text not null` | "Zane", "Alaina", "Conner", "Mom". |
| `email` | `text not null` | mirror of auth email for display. |
| `created_at` | `timestamptz default now()` | |

> A user's `family_id` and `role` are read constantly by RLS. To avoid recursive policy lookups and keep policies fast, expose them as **SECURITY DEFINER helper functions** (§3.1) rather than sub-selecting `profiles` inside every policy.

### 2.4 `chores`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `family_id` | `uuid not null` → `families(id)` | |
| `child_id` | `uuid not null` → `profiles(id)` | assignee. Must be a `child` in the same family (enforced by trigger or app-level check). |
| `title` | `text not null` | "Take the trash out". |
| `description` | `text` | optional. |
| `points` | `integer not null check (points >= 0)` | effort → reward (FR-3). |
| `recurrence_type` | `recurrence_type not null` | `one_off` / `daily` / `weekly`. |
| `weekdays` | `smallint[] not null default '{}'` | for `weekly`: ISO weekday numbers **0=Sun … 6=Sat** (match `date-fns` `getDay`). Empty for non-weekly. |
| `start_date` | `date not null default current_date` | first eligible day (esp. for `one_off`, and to stop a daily chore appearing before it exists). |
| `active` | `boolean not null default true` | soft-disable instead of delete where history matters. |
| `created_by` | `uuid not null` → `profiles(id)` | the admin. |
| `created_at` | `timestamptz default now()` | |

Index: `(family_id, child_id, active)` for checklist queries.

### 2.5 `chore_completions` (date-keyed — this is the recurrence engine)

A row exists **only once a child has acted on a chore for a given day.** Absence of a row for `(chore_id, due_date)` means "not done today." This is what makes the daily reset free (Decision 1): a new local date has no rows, so every recurring chore shows unchecked, with zero scheduled jobs.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `family_id` | `uuid not null` → `families(id)` | |
| `chore_id` | `uuid not null` → `chores(id) on delete cascade` | |
| `child_id` | `uuid not null` → `profiles(id)` | denormalized assignee for RLS + balance speed. |
| `due_date` | `date not null` | the local calendar day this completion is for. |
| `status` | `completion_status not null default 'pending'` | `pending` → `approved`/`rejected`. If `families.auto_approve`, a trigger/app sets `approved` immediately. |
| `points_awarded` | `integer not null default 0` | snapshot of `chores.points` **at approval time** (so later chore edits don't retro-change history). 0 until approved. |
| `completed_at` | `timestamptz default now()` | when the kid checked it. |
| `approved_at` | `timestamptz` | when Mom approved; null otherwise. |
| `approved_by` | `uuid` → `profiles(id)` | the admin who approved. |

**Constraints:**
- `unique (chore_id, due_date)` — one completion per chore per day; prevents double check-off (PRD §12).
- Check: `due_date >= (select start_date from chores where id = chore_id)` enforced at app level (cheap) — keeps a chore from being completed before it starts.

Index: `(family_id, child_id, status)` for the approval queue and balance view; `(chore_id, due_date)` is the unique index.

### 2.6 `rewards`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `family_id` | `uuid not null` → `families(id)` | |
| `title` | `text not null` | |
| `description` | `text` | optional. |
| `cost` | `integer not null check (cost > 0)` | point price (FR-11). |
| `active` | `boolean not null default true` | |
| `created_at` | `timestamptz default now()` | |

### 2.7 `redemptions` (escrow + approval)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `family_id` | `uuid not null` → `families(id)` | |
| `child_id` | `uuid not null` → `profiles(id)` | |
| `reward_id` | `uuid not null` → `rewards(id)` | |
| `cost` | `integer not null check (cost > 0)` | **snapshot** of `rewards.cost` at request time (price can change later). |
| `status` | `redemption_status not null default 'pending'` | `pending` escrows the cost; `fulfilled` deducts; `denied` releases. |
| `requested_at` | `timestamptz default now()` | |
| `resolved_at` | `timestamptz` | |
| `resolved_by` | `uuid` → `profiles(id)` | the admin. |

Index: `(family_id, child_id, status)`.

### 2.8 `point_adjustments` (Should — include if time allows, else v1.1)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `family_id` | `uuid not null` → `families(id)` | |
| `child_id` | `uuid not null` → `profiles(id)` | |
| `delta` | `integer not null` | signed; +/- points (FR-16). |
| `note` | `text not null` | required reason, for trust/auditability. |
| `created_by` | `uuid not null` → `profiles(id)` | the admin. |
| `created_at` | `timestamptz default now()` | |

### 2.9 Derived balance — view, not a counter (Decision 3)

Balance = (approved completion points) − (cost of pending **and** fulfilled redemptions) + (signed adjustments).

Pending redemptions are subtracted too — that is the **escrow**: a kid can't double-spend held points while Mom hasn't ruled yet. Denied redemptions (`status='denied'`) are simply excluded, which returns the held points automatically.

```sql
create view v_child_balance as
with earned as (
  select family_id, child_id, coalesce(sum(points_awarded), 0) as pts
  from chore_completions
  where status = 'approved'
  group by family_id, child_id
),
held as (   -- escrowed (pending) + spent (fulfilled); denied excluded
  select family_id, child_id, coalesce(sum(cost), 0) as pts
  from redemptions
  where status in ('pending', 'fulfilled')
  group by family_id, child_id
),
adjusted as (
  select family_id, child_id, coalesce(sum(delta), 0) as pts
  from point_adjustments
  group by family_id, child_id
)
select
  p.id            as child_id,
  p.family_id     as family_id,
  coalesce(e.pts, 0) - coalesce(h.pts, 0) + coalesce(a.pts, 0) as balance,
  coalesce(e.pts, 0)                                            as lifetime_earned,
  coalesce(h.pts, 0)                                            as committed_to_rewards
from profiles p
left join earned    e on e.child_id = p.id
left join held      h on h.child_id = p.id
left join adjusted  a on a.child_id = p.id
where p.role = 'child';
```

> **A redeem is affordable iff `balance >= rewards.cost`.** Because `balance` already nets out pending escrow, two rapid redeem requests can't both pass. Belt-and-suspenders: the redemption-insert path (route handler or RPC) re-reads the view inside the same transaction and rejects if `balance < cost`, so the check isn't a client-trust check. Views inherit RLS from their base tables, so a child querying `v_child_balance` only ever sees their own row (§3).

---

## 3. Row-Level Security

RLS is enabled on **every** table. The model: **admins see/write all rows in their own family; children see/write only their own rows, and never approval/points fields.**

### 3.1 Helper functions (avoid recursive policy lookups)

```sql
-- SECURITY DEFINER so it can read profiles without RLS recursion.
create function auth_family_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = auth.uid()
$$;

create function auth_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$;
```

Policies reference `auth_family_id()` and `auth_is_admin()` instead of sub-selecting `profiles`, so a policy on `profiles` doesn't recurse into itself.

### 3.2 Policy logic per table

**Universal family gate:** every policy first requires `family_id = auth_family_id()`. Nothing crosses families — this is also what makes multi-family (Decision 6) a UI change, not a rewrite.

| Table | `select` | `insert` | `update` | `delete` |
|---|---|---|---|---|
| `families` | row where `id = auth_family_id()` | — (seeded) | admin only, own family | — |
| `profiles` | own family (so Mom sees kids; kids see siblings' **names only** for nothing in UI, but rows are minimal) | admin only (via service-role route in practice) | admin only | admin only |
| `chores` | admin: all in family. child: `child_id = auth.uid()` **and** `active` | admin only | admin only | admin only |
| `chore_completions` | admin: all in family. child: `child_id = auth.uid()` | child: only `child_id = auth.uid()`, `status='pending'`, `points_awarded=0`; admin: any | child: own row, **only while `status='pending'`** (undo = update or delete), may **not** set `status`/`points_awarded`; admin: any (approve/reject) | child: own pending row (undo); admin: any |
| `rewards` | admin: all; child: `active` rewards in family | admin only | admin only | admin only |
| `redemptions` | admin: all; child: own | child: own, `status='pending'`, `cost` snapshot validated server-side; admin: any | child: cancel own while `pending`; admin: resolve (`fulfilled`/`denied`) | admin only |
| `point_adjustments` | admin: all; child: own (read so balance reconciles) | admin only | admin only | admin only |

**Spelled-out examples (the load-bearing ones):**

```sql
-- chores: a child reads only their own active chores; admin reads the whole family.
create policy chores_select on chores for select using (
  family_id = auth_family_id()
  and (auth_is_admin() or (child_id = auth.uid() and active))
);
create policy chores_admin_write on chores for all using (
  family_id = auth_family_id() and auth_is_admin()
) with check (
  family_id = auth_family_id() and auth_is_admin()
);

-- completions: a child may insert ONLY a pending row for themselves, with no points.
create policy completions_child_insert on chore_completions for insert with check (
  family_id = auth_family_id()
  and child_id = auth.uid()
  and status = 'pending'
  and points_awarded = 0
);
-- a child may undo (update/delete) only their own STILL-pending completion;
-- once approved it is locked to them.
create policy completions_child_update on chore_completions for update using (
  family_id = auth_family_id() and child_id = auth.uid() and status = 'pending'
) with check (
  family_id = auth_family_id() and child_id = auth.uid() and status = 'pending'
);
create policy completions_child_delete on chore_completions for delete using (
  family_id = auth_family_id() and child_id = auth.uid() and status = 'pending'
);
-- admin: full control of completions (this is where approval + points_awarded happen).
create policy completions_admin_all on chore_completions for all using (
  family_id = auth_family_id() and auth_is_admin()
) with check (
  family_id = auth_family_id() and auth_is_admin()
);
```

> The child's `update`/`insert` policies deliberately forbid setting `status` to anything but `pending` and forbid touching `points_awarded`. **Awarding points is structurally impossible for a child** — only the admin policy can move a completion to `approved` and write `points_awarded`. The `WITH CHECK` clauses are the teeth; the UI hiding the buttons is just courtesy.

### 3.3 Approval = points, enforced server-side

Approval should be **atomic** so `points_awarded` can never disagree with `status`. Implement as a `SECURITY DEFINER` RPC the admin calls (rather than a raw client update), so the point snapshot is taken server-side:

```sql
create function approve_completion(p_completion uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_is_admin() then raise exception 'not authorized'; end if;
  update chore_completions c
  set status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      points_awarded = (select points from chores ch where ch.id = c.chore_id)
  where c.id = p_completion
    and c.family_id = auth_family_id()
    and c.status = 'pending';
end $$;
```

Parallel RPCs: `reject_completion`, `fulfill_redemption` (sets `fulfilled`/`resolved_*`), `deny_redemption` (sets `denied` → escrow auto-released by the view). `auto_approve` is honored by an **insert trigger** on `chore_completions`: if `families.auto_approve` is true, the trigger immediately calls the same award logic, so flipping the flag needs no schema change (Decision 2).

---

## 4. Auth model

- **Provider:** Supabase Auth, email/password (FR-1). `@supabase/ssr` cookie sessions; `middleware.ts` refreshes the session on every request and gates `(app)` (require session) and `(auth)` (redirect away if already signed in).
- **Role storage:** in `profiles.role` (`admin` | `child`), read once per session into the `AuthProvider` and used for client routing; **never** the security boundary (RLS is). `app/(app)/page.tsx` reads role and renders the kid checklist or routes to `/admin`.
- **Identity = `profiles.id = auth.users.id`.** A profile is created the instant an account is created, in the same server action.
- **Mom invites/creates kids (FR-2):** the only place the **service-role key** is used.
  1. Mom (admin) submits name + email (+ optional temp password) on `/admin/kids`.
  2. A **server route handler** `app/api/admin/create-child/route.ts` runs: it first verifies the caller is an admin (reads their session profile), then uses `lib/supabase/admin.ts` (service-role) to `auth.admin.createUser({ email, password, email_confirm: true })`, then inserts a `profiles` row with `role='child'`, the **admin's `family_id`**, and `display_name`. Returns the temp password for Mom to hand to the kid.
  3. The route handler is the trust boundary: service-role bypasses RLS, so it must re-derive `family_id` from the *caller's* profile, never from the request body.
- **v1.1 PIN path is pre-accommodated:** because role/identity live in `profiles` and isolation lives in RLS keyed on `auth.uid()`, swapping the *credential* (email/password → Mom-issued PIN that mints a session) touches only the login route and the create-child handler. No schema or RLS change. (BRD top risk; PRD §7 deferred.)
- **Password resets** are mediated by Mom as admin (BRD §11) — in v1 she re-issues a temp password via the same admin route.

---

## 5. Realtime strategy

Supabase Realtime (Postgres changes) keeps Mom's dashboard and the kids' views live (FR-14). RLS applies to Realtime too, so each subscriber only receives changes for rows they're allowed to see.

**Tables that broadcast (enable Realtime replication on):** `chore_completions`, `redemptions`, `point_adjustments`. (Chores and rewards change rarely and only by Mom; a light refetch on her own mutation is enough — but enabling them is harmless and lets a kid's checklist update if Mom adds a chore mid-day.)

**Subscription model (`providers/realtime-provider.tsx`):**
- Subscribe filtered by `family_id=eq.<myFamily>` on the broadcast tables.
- **Mom's dashboard:** on any `INSERT`/`UPDATE` to `chore_completions` or `redemptions`, refetch the affected child's checklist row(s), the pending-approval queues, and `v_child_balance`. A new `pending` completion pops into her approvals queue instantly; an approval she makes flips the kid's view.
- **Kid checklist:** on `UPDATE` of their own `chore_completions` (e.g. Mom approves), update the item's status + their balance. On `INSERT` to their own `redemptions` resolving, update the rewards/me view.
- **Balance is a view**, which Realtime can't broadcast directly; so the provider treats completion/redemption/adjustment events as the **invalidation signal** and refetches `v_child_balance` for the affected child. Cheap (one row) and always correct.
- **Optimistic UI** on check-off (the kid sees the tick immediately), reconciled by the Realtime echo — same instinct as Anchor's optimistic autosave.

**Connection budget:** one family = at most ~4 concurrent clients (Mom + 3 kids), each one channel. Comfortably inside the free-tier Realtime limit (BRD risk: free-tier connections — fine at this scale; revisit only for multi-family).

---

## 6. PWA setup

Mirror Anchor exactly (it's a solved, shipped pattern in this studio).

- **`app/manifest.ts`** (`MetadataRoute.Manifest`): `name` "ChoreTracker", `short_name` "Chores", `display: "standalone"`, `start_url: "/"`, `scope: "/"`, theme/background colors, versioned icon URLs (`/icon.svg?v=1`, plus a maskable variant). Bump `?v=` on any icon change — iOS/Android cache home-screen icons by URL forever (Anchor's hard-won lesson).
- **Icons:** an `icon.svg` + `icon-maskable.svg` and an **exactly 180×180** `apple-touch-icon-v1.png` referenced from `app/layout.tsx` `metadata.icons.apple` (iOS softens any other size; iOS caches by URL so icon changes ship under a new filename).
- **`app/layout.tsx`:** `appleWebApp.capable`, `other: { "apple-mobile-web-app-capable": "yes" }`, `viewport` with `viewportFit: "cover"`, theme color. Mount `<ServiceWorkerRegistrar />` and the providers (`AuthProvider`, `RealtimeProvider`).
- **`public/sw.js`:** network-first for navigations with an `/offline` fallback, cache-first for same-origin static assets, versioned `CACHE` name (`chore-tracker-v1`). Bump the cache name on static-asset change.
- **`components/shell/service-worker-registrar.tsx`:** `"use client"`, registers `/sw.js` on mount.

**Offline behavior expectations (be honest in copy — this is a cloud-backed app, not offline-first like Anchor):**
- The app **shell** loads offline (cached); the **data does not** — checklist, balances, and approvals all require Supabase. Offline shows the `/offline` page or a "reconnecting" state.
- This is acceptable per BRD/PRD assumptions ("reliable internet; cloud-backed, not offline-first"). No write queue in v1. Optimistic check-off still feels instant when online.
- Defender watch item: do **not** let the SW cache authenticated API/data responses — only cache the app shell and static assets, or a kid could see stale/another-state data. The provided SW only caches `response.type === "basic"` same-origin static GETs, which excludes Supabase API calls (different origin) — keep it that way.

---

## 7. Recurrence computation (client-side, no cron)

The whole "daily reset" is a pure function over (a) the chore's recurrence rule and (b) which `chore_completions` rows exist for **today's date in the family's timezone**. No job ever runs.

**Step 1 — what is "today"?** Compute the current date **in `families.timezone`** (not the device tz, not UTC), as an ISO `YYYY-MM-DD` string. `lib/domain/dates.ts` gains a `todayInZone(tz)` helper (date-fns / `Intl.DateTimeFormat` with `timeZone`). Decision 1's timezone note.

**Step 2 — is a chore due today?** `lib/domain/recurrence.ts`:

```ts
// 0=Sun … 6=Sat, matching date-fns getDay and chores.weekdays.
export function isChoreDueOn(
  chore: { recurrence_type: 'one_off' | 'daily' | 'weekly';
           weekdays: number[]; start_date: string },
  isoDate: string
): boolean {
  if (isoDate < chore.start_date) return false;          // not started yet
  switch (chore.recurrence_type) {
    case 'one_off': return isoDate === chore.start_date;  // its single day…
    case 'daily':   return true;                          // …every day on/after start
    case 'weekly':  return chore.weekdays.includes(getDayOf(isoDate));
  }
}
```

A `one_off` is "due" only on `start_date` until completed; once a completion row exists (any status) it leaves the active list. (For v1 simplicity, a one-off with no completion still shows on its start day; if the client wants it to linger until done, that's a display tweak, not a schema change.)

**Step 3 — build today's checklist** (`buildTodayChecklist`):
1. Fetch the child's `active` chores (RLS already scopes to them).
2. `today = todayInZone(family.timezone)`.
3. Keep chores where `isChoreDueOn(chore, today)`.
4. Fetch `chore_completions` for those `chore_id`s where `due_date = today`.
5. Join: each due chore gets `status` = the completion row's status if present, else **`not_done`** (no row).
6. Render. Check-off = `insert` a `pending` completion for `(chore_id, child_id, today)`. Undo = `delete`/revert that pending row. Approval flips it to `approved` server-side.

Because completions are keyed by `due_date`, **tomorrow has no rows → every recurring chore is unchecked again, automatically** (Acceptance: "checked yesterday appears unchecked today, no manual reset"). A weekday chore simply fails `isChoreDueOn` on off days (Acceptance: "appears only on configured weekdays").

> One subtlety to verify (Defender): the `unique(chore_id, due_date)` constraint plus computing `today` in the **family** timezone means a kid in a different device timezone still checks off against the same logical day as Mom sees. Always pass `family.timezone` into the date helper; never call bare `new Date()` for "today."

---

## 8. Data privacy flow

**Per BRD §11 and PRD §6/§2 non-goals: there is NO LLM, NO analytics, NO third-party data processor in v1.** This section exists to make that explicit and to flag what would change it.

**Where data lives and moves:**
- All personal data about minors (names, emails, chores, completions, points, redemptions) lives **only** in the client's own Supabase Postgres project. It moves between the family's browsers and that Supabase project over TLS, governed by RLS.
- **No outbound flow to any third-party LLM API.** There is nothing to configure for zero-retention / no-training, because no prompt, no row, and no identifier ever leaves for an AI vendor. (If a future version adds AI — e.g. chore suggestions — that is a new design that must route through a server-side proxy with the vendor's zero-retention flags set, and must never send a child's name/email. Out of scope for v1; flag to Defender if it ever appears in a change request.)
- **No analytics SDK** (no GA, no PostHog, no Sentry session replay) in v1. Vercel's own request logs are infrastructure, not third-party data sharing; keep Vercel Web Analytics **off** (or, if enabled later, it's aggregate/cookieless and carries no child PII — but default off given the minor-data sensitivity).

**Sensitive-data callouts (for Defender):**
- **Minors' PII.** Names + emails of children. Minimization is already enforced by scope (no photos, no addresses, no sensitive identifiers — PRD §6, BRD §11). Don't add fields that collect more than the loop needs.
- **The service-role key** is the single highest-value secret: it bypasses RLS over a database of children's data. Server-only, never `NEXT_PUBLIC_`, never imported client-side (§1.2, §9).
- **Kid email addresses** exist only because v1 chose email/password. The v1.1 PIN path (§4) would let children have **no email at all**, further minimizing minor data — recommend it to the client.

---

## 9. Security checklist (hand to Defender)

- [ ] RLS **enabled** on every table (`families`, `profiles`, `chores`, `chore_completions`, `rewards`, `redemptions`, `point_adjustments`) and on access to `v_child_balance` (verify the view returns only the caller's row for a child).
- [ ] No table is reachable with RLS disabled; no policy uses `using (true)`.
- [ ] Child policies forbid writing `status`/`points_awarded`/`cost` (the `WITH CHECK` clauses). Verify a child **cannot** self-approve or self-award via the API.
- [ ] Approval/award and redemption resolution go through `SECURITY DEFINER` RPCs that re-check `auth_is_admin()` and `auth_family_id()` — never raw client updates of those fields.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-scope only in Vercel; `lib/supabase/admin.ts` has an `import 'server-only'` guard; no `NEXT_PUBLIC_` prefix anywhere near it.
- [ ] The create-child route re-derives `family_id` from the **caller's** profile, not the request body; rejects non-admin callers.
- [ ] Cross-family isolation: every policy gates on `family_id = auth_family_id()` (proves Decision 6 is safe).
- [ ] Redemption affordability is re-checked server-side against `v_child_balance` inside the insert path (escrow can't be bypassed by racing two requests).
- [ ] Service worker never caches Supabase/auth responses (only same-origin static shell).
- [ ] Acceptance test: signed in as Zane, attempt via the JS client to `select`/`update` Alaina's chores, completions, redemptions, and balance — **all rejected** (PRD acceptance: "Attempting via the API to read or modify another child's records is rejected by RLS").

---

## 10. What's ready / open inputs

- **Schema, RLS, auth, realtime, recurrence, PWA** are fully specified above — build-order.md sequences them.
- **Seed content** (`docs/content.md`): kids Zane / Alaina / Conner and the 9 starting chores are known; **point values, per-chore recurrence, and the reward catalog are still TBD from the client.** Build with placeholder seed values (e.g. 5–20 pts, sensible recurrences) in `supabase/seed.sql`; the real numbers are a one-line data edit at handoff, not a code change. Flagged in build-order Phase 1 and Phase 7.
