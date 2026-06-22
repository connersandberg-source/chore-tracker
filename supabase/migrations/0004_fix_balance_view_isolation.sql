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
