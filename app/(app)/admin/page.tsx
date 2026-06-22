import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { getSessionProfile } from "@/lib/auth";

export const metadata = { title: "Dashboard" };

// Mom's dashboard (placeholder). The live family view lands in Phase 6.
export default async function AdminHome() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-sky/15 text-sky-deep">
        <LayoutDashboard className="size-8" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {profile.display_name}. Chore management, approvals, and the
          kids&apos; live status will appear here as we build them out.
        </p>
      </div>
    </div>
  );
}
