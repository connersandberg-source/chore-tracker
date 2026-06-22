import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { Reward, RewardDraft } from "@/lib/domain";

const Rewards = z.array(Reward);

// All rewards visible to the caller. RLS: admin sees all; a child sees only
// active ones.
export async function listRewards(sb: SupabaseClient): Promise<Reward[]> {
  const { data, error } = await sb
    .from("rewards")
    .select("*")
    .order("cost", { ascending: true });
  if (error) throw error;
  return Rewards.parse(data);
}

export async function createReward(
  sb: SupabaseClient,
  ctx: { family_id: string },
  draft: RewardDraft,
): Promise<Reward> {
  const clean = RewardDraft.parse(draft);
  const { data, error } = await sb
    .from("rewards")
    .insert({ ...clean, family_id: ctx.family_id })
    .select("*")
    .single();
  if (error) throw error;
  return Reward.parse(data);
}

export async function updateReward(
  sb: SupabaseClient,
  id: string,
  draft: RewardDraft,
): Promise<Reward> {
  const clean = RewardDraft.parse(draft);
  const { data, error } = await sb
    .from("rewards")
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return Reward.parse(data);
}

export async function deleteReward(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.from("rewards").delete().eq("id", id);
  if (error) throw error;
}
