import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/db/repositories/families";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata = { title: "Family" };

// Mom's live dashboard — every kid's today status, points, and pending counts,
// updating in real time.
export default async function AdminHome() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const sb = await createClient();
  const family = await getFamily(sb);

  return <AdminDashboard timezone={family.timezone} />;
}
