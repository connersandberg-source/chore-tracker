import type { SupabaseClient } from "@supabase/supabase-js";

import { ChildBalance } from "@/lib/domain";

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
