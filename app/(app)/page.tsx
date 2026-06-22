import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/db/repositories/families";
import { ChecklistView } from "@/components/checklist/checklist-view";

// Role router at "/". Admins go to their dashboard; kids get their checklist,
// with "today" computed in the family's timezone (fetched server-side).
export default async function AppHome() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");

  const sb = await createClient();
  const family = await getFamily(sb);

  return (
    <ChecklistView
      childId={profile.id}
      familyId={profile.family_id}
      timezone={family.timezone}
      childName={profile.display_name}
    />
  );
}
