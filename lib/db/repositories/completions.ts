import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ChoreCompletion } from "@/lib/domain";

const Completions = z.array(ChoreCompletion);

// A child's completion rows for one calendar day. RLS scopes to the caller.
export async function listCompletionsForDate(
  sb: SupabaseClient,
  childId: string,
  isoDate: string,
): Promise<ChoreCompletion[]> {
  const { data, error } = await sb
    .from("chore_completions")
    .select("*")
    .eq("child_id", childId)
    .eq("due_date", isoDate);
  if (error) throw error;
  return Completions.parse(data);
}

// Check a chore off for a given day: insert a PENDING completion. status and
// points_awarded use DB defaults ('pending' / 0) — the child's RLS insert policy
// requires exactly that, and that the chore is assigned to them.
export async function checkOff(
  sb: SupabaseClient,
  input: { family_id: string; chore_id: string; child_id: string; due_date: string },
): Promise<ChoreCompletion> {
  const { data, error } = await sb
    .from("chore_completions")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return ChoreCompletion.parse(data);
}

// Undo a check-off while it's still pending (RLS forbids deleting an approved
// one). Returns silently; caller reloads.
export async function undo(
  sb: SupabaseClient,
  completionId: string,
): Promise<void> {
  const { error } = await sb
    .from("chore_completions")
    .delete()
    .eq("id", completionId);
  if (error) throw error;
}
