-- ChoreTracker — finish setup (run AFTER creating the 4 users in the Auth UI).
-- Creates the family (if missing), links each auth user to a profile, and seeds
-- the chores. Idempotent — safe to re-run. No secret key needed; the SQL editor
-- runs with the access it needs.

-- 1) Family (no-op if the seed already created it)
insert into families (id, name, timezone, auto_approve)
values ('11111111-1111-1111-1111-111111111111', 'Sandberg household', 'America/New_York', false)
on conflict (id) do nothing;

-- 2) Link the 4 auth users -> profiles (Mom = admin, kids = child)
insert into profiles (id, family_id, role, display_name, email)
select u.id,
       '11111111-1111-1111-1111-111111111111'::uuid,
       m.role::user_role,
       m.display_name,
       u.email
from (values
  ('kelsandberg@gmail.com',    'Mom',    'admin'),
  ('zanesandberg@gmail.com',   'Zane',   'child'),
  ('alainasandberg@gmail.com', 'Alaina', 'child'),
  ('connersandberg@gmail.com', 'Conner', 'child')
) as m(email, display_name, role)
join auth.users u on lower(u.email) = lower(m.email)
on conflict (id) do update
  set role         = excluded.role,
      display_name = excluded.display_name,
      family_id    = excluded.family_id,
      email        = excluded.email;

-- 3) Seed chores now that the kids exist (placeholders — CLIENT TBD)
do $$
declare
  v_family uuid := '11111111-1111-1111-1111-111111111111';
  v_admin  uuid;
  v_zane   uuid;
  v_alaina uuid;
  v_conner uuid;
begin
  select id into v_admin  from profiles where family_id = v_family and role = 'admin' limit 1;
  select id into v_zane   from profiles where family_id = v_family and display_name = 'Zane'   limit 1;
  select id into v_alaina from profiles where family_id = v_family and display_name = 'Alaina' limit 1;
  select id into v_conner from profiles where family_id = v_family and display_name = 'Conner' limit 1;

  if v_zane is null or v_alaina is null or v_conner is null then
    raise notice 'Chores skipped — not all kids linked yet. Create the 4 users first, then re-run.';
    return;
  end if;
  v_admin := coalesce(v_admin, v_zane);

  insert into chores (family_id, child_id, title, description, points, recurrence_type, weekdays, created_by)
  select v_family, c.child_id, c.title, c.description, c.points, c.rtype, c.weekdays, v_admin
  from (values
    (v_zane,   'Take the trash out',  'Curb on collection days',        10, 'weekly'::recurrence_type, array[1,4]::smallint[]),
    (v_zane,   'Cut the grass',       'Front and back yard',            20, 'weekly'::recurrence_type, array[6]::smallint[]),
    (v_zane,   'Put groceries away',  'After shopping trips',            5,  'one_off'::recurrence_type, '{}'::smallint[]),
    (v_alaina, 'Do the dishes',       'After dinner',                   10, 'daily'::recurrence_type,  '{}'::smallint[]),
    (v_alaina, 'Laundry',             'Wash, dry, fold',                15, 'weekly'::recurrence_type, array[2,5]::smallint[]),
    (v_alaina, 'Clean counters',      'Wipe kitchen counters',          5,  'daily'::recurrence_type,  '{}'::smallint[]),
    (v_conner, 'Clean room',          'Tidy and vacuum',                10, 'daily'::recurrence_type,  '{}'::smallint[]),
    (v_conner, 'Sweep kitchen',       'Sweep the kitchen floor',        5,  'daily'::recurrence_type,  '{}'::smallint[]),
    (v_conner, 'Prepare upstairs for monthly cleaning', 'Declutter before deep clean', 15, 'weekly'::recurrence_type, array[0]::smallint[])
  ) as c(child_id, title, description, points, rtype, weekdays)
  where not exists (
    select 1 from chores ch where ch.child_id = c.child_id and ch.title = c.title
  );

  raise notice 'Chores seeded for Zane / Alaina / Conner.';
end $$;
