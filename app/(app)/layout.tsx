import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth";
import { AppNav } from "@/components/shell/nav";

// Authed shell. Proxy already guarantees a session here; we load the profile for
// role-aware nav. If a session exists but no profile (edge case), bounce to login.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="pt-safe flex items-center justify-between border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
        <span className="font-display text-lg font-extrabold text-sky-deep">
          ChoreTracker
        </span>
        <span className="text-sm font-semibold text-muted-foreground">
          {profile.display_name}
        </span>
      </header>

      <main className="mx-auto max-w-md px-5 pb-28 pt-5">{children}</main>

      <AppNav role={profile.role} />
    </div>
  );
}
