-- ChoreTracker — seed data (docs/content.md)
--
-- ORDERING NOTE: profiles map 1:1 to auth.users, which are created in Phase 2
-- (auth). So this file is designed to run in two passes:
--   Pass 1 (now, Phase 1): inserts the family + reward catalog. The chores
--           block finds no children yet and cleanly skips.
--   Pass 2 (after Phase 2): once Mom has created the three child accounts
--           (display_name 'Zane' / 'Alaina' / 'Conner'), re-run this file (or
--           just the chores block) and the chores are inserted, idempotently.
--
-- !! CLIENT TBD !! point values, per-chore recurrence, and the reward catalog
-- below are PLACEHOLDERS. Replace with the client's real numbers at build-order
-- Step 7.2 — a data-only edit, no code change.

-- Fixed family id so later inserts / env can reference it deterministically.
insert into families (id, name, timezone, auto_approve)
values ('11111111-1111-1111-1111-111111111111', 'Sandberg household', 'America/New_York', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reward catalog (placeholders — CLIENT TBD)
-- ---------------------------------------------------------------------------
insert into rewards (family_id, title, description, cost, active) values
  ('11111111-1111-1111-1111-111111111111', '30 min screen time', 'Extra screen time', 20, true), -- CLIENT TBD
  ('11111111-1111-1111-1111-111111111111', 'Pick the movie',     'Choose family movie night', 35, true), -- CLIENT TBD
  ('11111111-1111-1111-1111-111111111111', '$5 allowance',       'Five dollars cash', 60, true), -- CLIENT TBD
  ('11111111-1111-1111-1111-111111111111', 'Friend sleepover',   'Have a friend over', 100, true) -- CLIENT TBD
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Chores (placeholders — CLIENT TBD). Runs only once the three child profiles
-- exist; otherwise skips with a notice. Idempotent: won't duplicate a chore
-- with the same (child, title).
-- ---------------------------------------------------------------------------
do $$
declare
  v_family   uuid := '11111111-1111-1111-1111-111111111111';
  v_admin    uuid;
  v_zane     uuid;
  v_alaina   uuid;
  v_conner   uuid;
begin
  select id into v_admin  from profiles where family_id = v_family and role = 'admin' limit 1;
  select id into v_zane   from profiles where family_id = v_family and display_name = 'Zane'   limit 1;
  select id into v_alaina from profiles where family_id = v_family and display_name = 'Alaina' limit 1;
  select id into v_conner from profiles where family_id = v_family and display_name = 'Conner' limit 1;

  if v_zane is null or v_alaina is null or v_conner is null then
    raise notice 'Seed: child profiles not all present yet — skipping chores. Re-run after Phase 2 auth.';
    return;
  end if;
  -- created_by needs an admin; fall back to a child if Mom not seeded (dev only).
  v_admin := coalesce(v_admin, v_zane);

  -- (child, title, description, points, recurrence_type, weekdays, active)
  -- weekdays: 0=Sun..6=Sat. CLIENT TBD on points + recurrence throughout.
  insert into chores (family_id, child_id, title, description, points, recurrence_type, weekdays, created_by)
  select v_family, c.child_id, c.title, c.description, c.points, c.rtype, c.weekdays, v_admin
  from (values
    (v_zane,   'Take the trash out',  'Curb on collection days',        10, 'weekly'::recurrence_type, array[1,4]::smallint[]), -- CLIENT TBD
    (v_zane,   'Cut the grass',       'Front and back yard',            20, 'weekly'::recurrence_type, array[6]::smallint[]),   -- CLIENT TBD
    (v_zane,   'Put groceries away',  'After shopping trips',            5,  'one_off'::recurrence_type, '{}'::smallint[]),       -- CLIENT TBD
    (v_alaina, 'Do the dishes',       'After dinner',                   10, 'daily'::recurrence_type,  '{}'::smallint[]),        -- CLIENT TBD
    (v_alaina, 'Laundry',             'Wash, dry, fold',                15, 'weekly'::recurrence_type, array[2,5]::smallint[]),  -- CLIENT TBD
    (v_alaina, 'Clean counters',      'Wipe kitchen counters',          5,  'daily'::recurrence_type,  '{}'::smallint[]),        -- CLIENT TBD
    (v_conner, 'Clean room',          'Tidy and vacuum',                10, 'daily'::recurrence_type,  '{}'::smallint[]),        -- CLIENT TBD
    (v_conner, 'Sweep kitchen',       'Sweep the kitchen floor',        5,  'daily'::recurrence_type,  '{}'::smallint[]),        -- CLIENT TBD
    (v_conner, 'Prepare upstairs for monthly cleaning', 'Declutter before deep clean', 15, 'weekly'::recurrence_type, array[0]::smallint[]) -- CLIENT TBD
  ) as c(child_id, title, description, points, rtype, weekdays)
  where not exists (
    select 1 from chores ch where ch.child_id = c.child_id and ch.title = c.title
  );

  raise notice 'Seed: chores inserted for Zane / Alaina / Conner.';
end $$;
