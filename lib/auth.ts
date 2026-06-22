import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/lib/domain";

// Server-side: the current user's validated profile (role + family_id), or null
// if not signed in / no profile row. Used by server components to route by role.
// Auth/visibility is still enforced by RLS; this is for rendering decisions.
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const parsed = data ? Profile.safeParse(data) : null;
  return parsed?.success ? parsed.data : null;
}
