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
