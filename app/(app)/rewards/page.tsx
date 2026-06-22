import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth";
import { RewardsView } from "@/components/rewards/rewards-view";

export const metadata = { title: "Rewards" };

// Kid's rewards store. Admins manage the catalog at /admin/rewards instead.
export default async function RewardsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/rewards");

  return <RewardsView childId={profile.id} />;
}
