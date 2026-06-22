"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckSquare, LayoutDashboard, ListChecks, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/lib/domain";

type NavItem = { href: string; label: string; icon: React.ElementType };

// Only links to routes that exist today; expands as later phases land pages.
const CHILD_NAV: NavItem[] = [{ href: "/", label: "Chores", icon: CheckSquare }];
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/chores", label: "Chores", icon: ListChecks },
];

export function AppNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const items = role === "admin" ? ADMIN_NAV : CHILD_NAV;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around border-t border-border bg-card/95 backdrop-blur">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition",
              active ? "text-sky-deep" : "text-muted-foreground",
            )}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </Link>
        );
      })}
      <button
        onClick={handleSignOut}
        className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold text-muted-foreground transition active:scale-95"
      >
        <LogOut className="size-6" aria-hidden />
        Sign out
      </button>
    </nav>
  );
}
