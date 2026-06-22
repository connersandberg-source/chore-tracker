import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { Chore, ChoreDraft } from "@/lib/domain";

const Chores = z.array(Chore);

// All chores visible to the caller. RLS scopes it: admin sees the whole family,
// a child sees only their own active chores.
export async function listChores(sb: SupabaseClient): Promise<Chore[]> {
  const { data, error } = await sb
    .from("chores")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Chores.parse(data);
}

// Create a chore. family_id and created_by come from the signed-in admin's
// profile (passed by the caller), NOT the form — RLS also requires family_id to
// match the caller's family and the caller to be an admin.
export async function createChore(
  sb: SupabaseClient,
  ctx: { family_id: string; created_by: string },
  draft: ChoreDraft,
): Promise<Chore> {
  const clean = ChoreDraft.parse(draft);
  const { data, error } = await sb
    .from("chores")
    .insert({ ...clean, family_id: ctx.family_id, created_by: ctx.created_by })
    .select("*")
    .single();
  if (error) throw error;
  return Chore.parse(data);
}

export async function updateChore(
  sb: SupabaseClient,
  id: string,
  draft: ChoreDraft,
): Promise<Chore> {
  const clean = ChoreDraft.parse(draft);
  const { data, error } = await sb
    .from("chores")
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return Chore.parse(data);
}

export async function deleteChore(
  sb: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await sb.from("chores").delete().eq("id", id);
  if (error) throw error;
}
