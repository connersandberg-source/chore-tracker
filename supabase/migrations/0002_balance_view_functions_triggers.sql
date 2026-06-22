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
