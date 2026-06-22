-- ChoreTracker — migration 0005: secure redemption request RPC
--
-- Redeeming must be server-enforced: a child must not be able to (a) spend
-- points they don't have, or (b) tamper with the cost snapshot, by calling the
-- REST API directly. RLS alone can't check a balance, so we gate the insert
-- behind a SECURITY DEFINER function that snapshots the reward's real cost and
-- re-reads v_child_balance before inserting the pending (escrowed) redemption.
-- (architecture §2.9 belt-and-suspenders note.)

create or replace function request_redemption(p_reward uuid)
returns redemptions
language plpgsql security definer set search_path = public as $$
declare
  v_family  uuid := auth_family_id();
  v_child   uuid := auth.uid();
  v_cost    integer;
  v_active  boolean;
  v_balance integer;
  v_row     redemptions;
begin
  if auth_is_admin() then
    raise exception 'admins do not redeem rewards';
  end if;

  select cost, active into v_cost, v_active
  from rewards where id = p_reward and family_id = v_family;
  if v_cost is null then raise exception 'reward not found'; end if;
  if not v_active then raise exception 'reward is not available'; end if;

  select balance into v_balance from v_child_balance where child_id = v_child;
  if coalesce(v_balance, 0) < v_cost then
    raise exception 'not enough points';
  end if;

  insert into redemptions (family_id, child_id, reward_id, cost, status)
  values (v_family, v_child, p_reward, v_cost, 'pending')
  returning * into v_row;
  return v_row;
end $$;
