import { redirect } from "next/navigation";
import { CheckSquare } from "lucide-react";

import { getSessionProfile } from "@/lib/auth";

// Role router at "/". Admins go to their dashboard; kids see their checklist
// (a placeholder until Phase 4 builds the real recurrence-driven list).
export default async function AppHome() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");

  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-sky/15 text-sky-deep">
        <CheckSquare className="size-8" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink">
          Hi {profile.display_name}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Your chores will show up here. We&apos;re still setting things up.
        </p>
      </div>
    </div>
  );
}
