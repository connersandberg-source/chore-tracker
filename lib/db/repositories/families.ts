import type { SupabaseClient } from "@supabase/supabase-js";

import { Family } from "@/lib/domain";

// The caller's family (RLS returns only their own family row). Used mainly for
// the timezone that "today" is computed against.
export async function getFamily(sb: SupabaseClient): Promise<Family> {
  const { data, error } = await sb.from("families").select("*").limit(1).single();
  if (error) throw error;
  return Family.parse(data);
}
