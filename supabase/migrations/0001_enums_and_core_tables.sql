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
