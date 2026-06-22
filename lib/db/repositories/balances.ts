import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ChildBalance } from "@/lib/domain";

// All children's balances (admin only, via RLS + the view's scope). Returned as
// a map of child_id -> balance for easy dashboard lookup.
export async function listBalances(
  sb: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await sb.from("v_child_balance").select("*");
  if (error) throw error;
  const rows = z.array(ChildBalance).parse(data);
  return Object.fromEntries(rows.map((r) => [r.child_id, r.balance]));
}

// A single child's current points balance from the v_child_balance view. RLS +
// the view's own scope mean a child can only read their own row.
export async function getBalance(
  sb: SupabaseClient,
  childId: string,
): Promise<number> {
  const { data, error } = await sb
    .from("v_child_balance")
    .select("*")
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 0;
  return ChildBalance.parse(data).balance;
}
