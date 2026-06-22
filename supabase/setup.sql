-- ChoreTracker — combined setup (migrations 0001..0004, in order)
-- Paste this ENTIRE file into the Supabase SQL editor and Run. Then run seed.sql / finish-setup.sql.

-- ChoreTracker — migration 0001: enums + core tables
-- Source of truth: docs/architecture.md §2. Every table is family_id-keyed.
-- Apply via `supabase db push` OR paste into the Supabase SQL editor.

-- Needed for gen_random_uuid() on some projects (no-op if already present).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 2.1 Enums
-- ---------------------------------------------------------------------------
create type user_role         as enum ('admin', 'child');
create type recurrence_type   as enum ('one_off', 'daily', 'weekly');
create type completion_status as enum ('pending', 'approved', 'rejected');
create type redemption_status as enum ('pending', 'fulfilled', 'denied');

-- ---------------------------------------------------------------------------
-- 2.2 families
-- ---------------------------------------------------------------------------
create table families (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  timezone     text not null default 'America/New_York', -- "today" is computed against this (Decision 1)
  auto_approve boolean not null default false,           -- Decision 2 toggle
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2.3 profiles (one row per auth user; id == auth.users.id)
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  family_id    uuid not null references families(id),
  role         user_role not null,
  display_name text not null,
  email        text not null,
  created_at   timestamptz not null default now()
);
create index profiles_family_idx on profiles (family_id);

-- ---------------------------------------------------------------------------
-- 2.4 chores
-- ---------------------------------------------------------------------------
create table chores (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id),
  child_id        uuid not null references profiles(id),
  title           text not null,
  description     text,
  points          integer not null check (points >= 0),
  recurrence_type recurrence_type not null,
  weekdays        smallint[] not null default '{}',     -- 0=Sun..6=Sat (date-fns getDay); empty unless weekly
  start_date      date not null default current_date,
  active          boolean not null default true,
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now()
);
create index chores_family_child_active_idx on chores (family_id, child_id, active);

-- ---------------------------------------------------------------------------
-- 2.5 chore_completions (date-keyed — the recurrence engine)
-- A row exists only once a child acts on a chore for a given day. Absence of a
-- row for (chore_id, due_date) means "not done today" — this is what makes the
-- daily reset free (Decision 1): a new local date has no rows.
-- ---------------------------------------------------------------------------
create table chore_completions (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id),
  chore_id       uuid not null references chores(id) on delete cascade,
  child_id       uuid not null references profiles(id),
  due_date       date not null,
  status         completion_status not null default 'pending',
  points_awarded integer not null default 0,            -- snapshot of chores.points at approval; 0 until approved
  completed_at   timestamptz not null default now(),
  approved_at    timestamptz,
  approved_by    uuid references profiles(id),
  unique (chore_id, due_date)                            -- one completion per chore per day
);
create index completions_family_child_status_idx
  on chore_completions (family_id, child_id, status);

-- ---------------------------------------------------------------------------
-- 2.6 rewards
-- ---------------------------------------------------------------------------
create table rewards (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id),
  title       text not null,
  description text,
  cost        integer not null check (cost > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index rewards_family_active_idx on rewards (family_id, active);

-- ---------------------------------------------------------------------------
-- 2.7 redemptions (escrow + approval)
-- ---------------------------------------------------------------------------
create table redemptions (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id),
  child_id     uuid not null references profiles(id),
  reward_id    uuid not null references rewards(id),
  cost         integer not null check (cost > 0),        -- snapshot of rewards.cost at request time
  status       redemption_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references profiles(id)
);
create index redemptions_family_child_status_idx
  on redemptions (family_id, child_id, status);

-- ---------------------------------------------------------------------------
-- 2.8 point_adjustments (manual +/- with a required reason)
-- ---------------------------------------------------------------------------
create table point_adjustments (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id),
  child_id   uuid not null references profiles(id),
  delta      integer not null,                           -- signed
  note       text not null,                              -- required reason, for trust/auditability
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index point_adjustments_family_child_idx on point_adjustments (family_id, child_id);


-- ChoreTracker — migration 0002: balance view, auth helpers, RPCs, auto-approve trigger
-- Source: docs/architecture.md §2.9, §3.1, §3.3.

-- ---------------------------------------------------------------------------
-- 3.1 Auth helper functions (SECURITY DEFINER to avoid RLS recursion on profiles)
-- ---------------------------------------------------------------------------
create or replace function auth_family_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = auth.uid()
$$;

create or replace function auth_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- 2.9 Derived balance — a view, not a counter (Decision 3)
-- balance = approved completion points
--         - cost of pending (escrow) AND fulfilled (spent) redemptions
--         + signed adjustments.
-- Denied redemptions are excluded, which auto-returns the held points.
--
-- security_invoker = on is REQUIRED: without it the view would run as its owner
-- and BYPASS RLS, letting a child read every child's balance. With it, the
-- querying user's RLS on the base tables applies, so a child sees only their row.
-- ---------------------------------------------------------------------------
create view v_child_balance with (security_invoker = on) as
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
  p.id        as child_id,
  p.family_id as family_id,
  coalesce(e.pts, 0) - coalesce(h.pts, 0) + coalesce(a.pts, 0) as balance,
  coalesce(e.pts, 0) as lifetime_earned,
  coalesce(h.pts, 0) as committed_to_rewards
from profiles p
left join earned   e on e.child_id = p.id
left join held     h on h.child_id = p.id
left join adjusted a on a.child_id = p.id
where p.role = 'child';

-- ---------------------------------------------------------------------------
-- 3.3 Approval = points, enforced server-side (atomic, admin-only)
-- ---------------------------------------------------------------------------
create or replace function approve_completion(p_completion uuid) returns void
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

create or replace function reject_completion(p_completion uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_is_admin() then raise exception 'not authorized'; end if;
  update chore_completions c
  set status = 'rejected',
      approved_at = now(),
      approved_by = auth.uid(),
      points_awarded = 0
  where c.id = p_completion
    and c.family_id = auth_family_id()
    and c.status = 'pending';
end $$;

create or replace function fulfill_redemption(p_redemption uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_is_admin() then raise exception 'not authorized'; end if;
  update redemptions r
  set status = 'fulfilled',
      resolved_at = now(),
      resolved_by = auth.uid()
  where r.id = p_redemption
    and r.family_id = auth_family_id()
    and r.status = 'pending';
end $$;

create or replace function deny_redemption(p_redemption uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not auth_is_admin() then raise exception 'not authorized'; end if;
  update redemptions r
  set status = 'denied',          -- escrow auto-released by the balance view
      resolved_at = now(),
      resolved_by = auth.uid()
  where r.id = p_redemption
    and r.family_id = auth_family_id()
    and r.status = 'pending';
end $$;

-- ---------------------------------------------------------------------------
-- Auto-approve trigger (Decision 2): if families.auto_approve, a fresh
-- completion is approved immediately with points snapshotted. Flipping the flag
-- needs no schema change.
-- ---------------------------------------------------------------------------
create or replace function apply_auto_approve() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_auto boolean;
  v_pts  integer;
begin
  if new.status <> 'pending' then
    return new;  -- already decided (e.g. admin-inserted); leave as-is
  end if;
  select auto_approve into v_auto from families where id = new.family_id;
  if coalesce(v_auto, false) then
    select points into v_pts from chores where id = new.chore_id;
    new.status := 'approved';
    new.points_awarded := coalesce(v_pts, 0);
    new.approved_at := now();
    -- approved_by stays null = system auto-approval
  end if;
  return new;
end $$;

create trigger trg_auto_approve
  before insert on chore_completions
  for each row execute function apply_auto_approve();


-- ChoreTracker — migration 0003: enable RLS + all policies
-- Source: docs/architecture.md §3.2. RLS is the security boundary, not the UI.
-- Universal rule: every policy first requires family_id = auth_family_id().
-- Multiple permissive policies on a table are OR'd together by Postgres.

alter table families          enable row level security;
alter table profiles          enable row level security;
alter table chores            enable row level security;
alter table chore_completions enable row level security;
alter table rewards           enable row level security;
alter table redemptions       enable row level security;
alter table point_adjustments enable row level security;

-- ---------------------------------------------------------------------------
-- families — read own family; admin may update it (e.g. timezone, auto_approve)
-- ---------------------------------------------------------------------------
create policy families_select on families for select
  using (id = auth_family_id());
create policy families_admin_update on families for update
  using (id = auth_family_id() and auth_is_admin())
  with check (id = auth_family_id() and auth_is_admin());

-- ---------------------------------------------------------------------------
-- profiles — everyone in a family can read the family's profiles; only admin
-- writes (child accounts are created via the service-role route in practice).
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles for select
  using (family_id = auth_family_id());
create policy profiles_admin_write on profiles for all
  using (family_id = auth_family_id() and auth_is_admin())
  with check (family_id = auth_family_id() and auth_is_admin());

-- ---------------------------------------------------------------------------
-- chores — child reads only their own ACTIVE chores; admin reads/writes all.
-- ---------------------------------------------------------------------------
create policy chores_select on chores for select using (
  family_id = auth_family_id()
  and (auth_is_admin() or (child_id = auth.uid() and active))
);
create policy chores_admin_write on chores for all
  using (family_id = auth_family_id() and auth_is_admin())
  with check (family_id = auth_family_id() and auth_is_admin());

-- ---------------------------------------------------------------------------
-- chore_completions — the load-bearing isolation. A child may only insert a
-- PENDING, zero-point completion for THEMSELVES, and only for a chore actually
-- assigned to them. Awarding points / approving is structurally impossible for
-- a child — only the admin policy (and the SECURITY DEFINER RPCs) can.
-- ---------------------------------------------------------------------------
create policy completions_select on chore_completions for select using (
  family_id = auth_family_id()
  and (auth_is_admin() or child_id = auth.uid())
);
create policy completions_child_insert on chore_completions for insert with check (
  family_id = auth_family_id()
  and child_id = auth.uid()
  and status = 'pending'
  and points_awarded = 0
  -- the chore must actually be assigned to this child (no logging sibling chores)
  and exists (
    select 1 from chores ch
    where ch.id = chore_id and ch.child_id = auth.uid() and ch.active
  )
);
-- undo: a child may update/delete only their own STILL-pending completion.
create policy completions_child_update on chore_completions for update
  using (family_id = auth_family_id() and child_id = auth.uid() and status = 'pending')
  with check (family_id = auth_family_id() and child_id = auth.uid() and status = 'pending');
create policy completions_child_delete on chore_completions for delete
  using (family_id = auth_family_id() and child_id = auth.uid() and status = 'pending');
-- admin: full control (approve/reject happen here, via the RPCs).
create policy completions_admin_all on chore_completions for all
  using (family_id = auth_family_id() and auth_is_admin())
  with check (family_id = auth_family_id() and auth_is_admin());

-- ---------------------------------------------------------------------------
-- rewards — child reads only ACTIVE rewards; admin reads/writes all.
-- ---------------------------------------------------------------------------
create policy rewards_select on rewards for select using (
  family_id = auth_family_id()
  and (auth_is_admin() or active)
);
create policy rewards_admin_write on rewards for all
  using (family_id = auth_family_id() and auth_is_admin())
  with check (family_id = auth_family_id() and auth_is_admin());

-- ---------------------------------------------------------------------------
-- redemptions — child requests (pending) and can cancel (delete) own pending;
-- admin resolves (fulfill/deny via RPCs). Affordability is re-checked
-- server-side against v_child_balance in the request path.
-- ---------------------------------------------------------------------------
create policy redemptions_select on redemptions for select using (
  family_id = auth_family_id()
  and (auth_is_admin() or child_id = auth.uid())
);
create policy redemptions_child_insert on redemptions for insert with check (
  family_id = auth_family_id()
  and child_id = auth.uid()
  and status = 'pending'
);
-- cancel a pending request (releases escrow). No 'cancelled' status exists, so
-- cancel = delete the still-pending row; resolved rows are admin-only.
create policy redemptions_child_cancel on redemptions for delete
  using (family_id = auth_family_id() and child_id = auth.uid() and status = 'pending');
create policy redemptions_admin_all on redemptions for all
  using (family_id = auth_family_id() and auth_is_admin())
  with check (family_id = auth_family_id() and auth_is_admin());

-- ---------------------------------------------------------------------------
-- point_adjustments — child reads own (so balance reconciles); admin writes.
-- ---------------------------------------------------------------------------
create policy point_adjustments_select on point_adjustments for select using (
  family_id = auth_family_id()
  and (auth_is_admin() or child_id = auth.uid())
);
create policy point_adjustments_admin_write on point_adjustments for all
  using (family_id = auth_family_id() and auth_is_admin())
  with check (family_id = auth_family_id() and auth_is_admin());


-- ChoreTracker — migration 0004: fix v_child_balance row isolation
--
-- Found in Phase 2 verification: a child querying v_child_balance saw EVERY
-- child's row, not just their own. Cause: the view runs security_invoker=on, so
-- the querying user's RLS applies to base tables — but the `profiles` policy
-- lets any family member read the whole family's profiles (needed so Mom sees
-- the kids). The view scans `profiles` for the child list, so siblings' rows
-- (child_id + a misleading 0 balance) leaked. Sibling point TOTALS were already
-- safe (their completions/redemptions are hidden by RLS), but row existence was
-- not. Scope the view: admins see all children; a child sees only their own row.

create or replace view v_child_balance with (security_invoker = on) as
with earned as (
  select family_id, child_id, coalesce(sum(points_awarded), 0) as pts
  from chore_completions
  where status = 'approved'
  group by family_id, child_id
),
held as (
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
  p.id        as child_id,
  p.family_id as family_id,
  coalesce(e.pts, 0) - coalesce(h.pts, 0) + coalesce(a.pts, 0) as balance,
  coalesce(e.pts, 0) as lifetime_earned,
  coalesce(h.pts, 0) as committed_to_rewards
from profiles p
left join earned   e on e.child_id = p.id
left join held     h on h.child_id = p.id
left join adjusted a on a.child_id = p.id
where p.role = 'child'
  and (auth_is_admin() or p.id = auth.uid());  -- admin: all kids; child: self only


