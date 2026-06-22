import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { Profile } from "@/lib/domain";

// Repository layer: the UI calls these, never the raw Supabase client. RLS does
// the scoping (a child only ever reads their own family). Rows are validated
// against the domain schemas as they cross this boundary.

const Profiles = z.array(Profile);

// The family's children (admin reads all family profiles via RLS).
export async function listChildren(sb: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("role", "child")
    .order("display_name");
  if (error) throw error;
  return Profiles.parse(data);
}
