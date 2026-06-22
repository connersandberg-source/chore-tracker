import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { Redemption } from "@/lib/domain";

// Redemption rows joined to the reward (and, for admins, the child) for display.
export const RedemptionWithReward = Redemption.extend({
  reward: z.object({ title: z.string() }).nullable(),
});
export type RedemptionWithReward = z.infer<typeof RedemptionWithReward>;

export const PendingRedemption = Redemption.extend({
  reward: z.object({ title: z.string() }).nullable(),
  child: z.object({ display_name: z.string() }).nullable(),
});
export type PendingRedemption = z.infer<typeof PendingRedemption>;

// Kid requests a reward. Goes through the SECURITY DEFINER RPC, which snapshots
// the cost and re-checks the balance server-side (migration 0005), then escrows
// the points by inserting a pending redemption.
export async function requestRedemption(
  sb: SupabaseClient,
  rewardId: string,
): Promise<Redemption> {
  const { data, error } = await sb.rpc("request_redemption", {
    p_reward: rewardId,
  });
  if (error) throw error;
  return Redemption.parse(data);
}

// Cancel a still-pending request (RLS allows deleting only own pending row);
// releases the escrow.
export async function cancelRedemption(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.from("redemptions").delete().eq("id", id);
  if (error) throw error;
}

// A child's own redemptions (newest first), with the reward title.
export async function listMyRedemptions(
  sb: SupabaseClient,
  childId: string,
): Promise<RedemptionWithReward[]> {
  const { data, error } = await sb
    .from("redemptions")
    .select("*, reward:rewards(title)")
    .eq("child_id", childId)
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return z.array(RedemptionWithReward).parse(data);
}

// Admin: all pending redemptions in the family, with reward + child names.
export async function listPendingRedemptions(
  sb: SupabaseClient,
): Promise<PendingRedemption[]> {
  const { data, error } = await sb
    .from("redemptions")
    .select("*, reward:rewards(title), child:profiles!child_id(display_name)")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw error;
  return z.array(PendingRedemption).parse(data);
}

// Admin resolves a redemption via the SECURITY DEFINER RPCs.
export async function fulfillRedemption(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.rpc("fulfill_redemption", { p_redemption: id });
  if (error) throw error;
}

export async function denyRedemption(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.rpc("deny_redemption", { p_redemption: id });
  if (error) throw error;
}
