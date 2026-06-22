"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/providers/realtime-provider";
import { listChildren } from "@/lib/db/repositories/profiles";
import { listChores } from "@/lib/db/repositories/chores";
import {
  listFamilyCompletionsForDate,
  listPending,
} from "@/lib/db/repositories/completions";
import { listPendingRedemptions } from "@/lib/db/repositories/redemptions";
import { listBalances } from "@/lib/db/repositories/balances";
import { buildTodayChecklist } from "@/lib/domain/recurrence";
import { formatDayLabel, todayInZone } from "@/lib/domain/dates";
import type { Chore, ChoreCompletion, Profile } from "@/lib/domain";

type KidRow = {
  kid: Profile;
  balance: number;
  done: number;
  total: number;
};

export function AdminDashboard({ timezone }: { timezone: string }) {
  const sb = useMemo(() => createClient(), []);
  const today = useMemo(() => todayInZone(timezone), [timezone]);

  const [rows, setRows] = useState<KidRow[]>([]);
  const [pendingChores, setPendingChores] = useState(0);
  const [pendingRewards, setPendingRewards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [kids, chores, completions, balances, pendC, pendR] =
        await Promise.all([
          listChildren(sb),
          listChores(sb),
          listFamilyCompletionsForDate(sb, today),
          listBalances(sb),
          listPending(sb),
          listPendingRedemptions(sb),
        ]);

      setRows(
        kids.map((kid) => {
          const kidChores = chores.filter((c: Chore) => c.child_id === kid.id);
          const kidComps = completions.filter(
            (c: ChoreCompletion) => c.child_id === kid.id,
          );
          const checklist = buildTodayChecklist(kidChores, kidComps, today);
          const done = checklist.filter(
            (i) => i.status === "approved" || i.status === "pending",
          ).length;
          return {
            kid,
            balance: balances[kid.id] ?? 0,
            done,
            total: checklist.length,
          };
        }),
      );
      setPendingChores(pendC.length);
      setPendingRewards(pendR.length);
    } catch {
      setError("Couldn't load the dashboard. Try again.");
    } finally {
      setLoading(false);
    }
  }, [sb, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // Live updates: any completion / redemption / adjustment change refetches.
  useRealtime(reload);

  const pendingTotal = pendingChores + pendingRewards;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Family</h1>
        <p className="text-xs text-muted-foreground">{formatDayLabel(today)}</p>
      </header>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {pendingTotal > 0 && (
        <Link
          href="/admin/approvals"
          className="flex items-center gap-3 rounded-2xl border border-sky/40 bg-sky/10 px-4 py-3"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-deep font-display text-sm font-extrabold text-primary-foreground">
            {pendingTotal}
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
            {pendingChores > 0 && `${pendingChores} chore${pendingChores > 1 ? "s" : ""}`}
            {pendingChores > 0 && pendingRewards > 0 && " · "}
            {pendingRewards > 0 &&
              `${pendingRewards} reward${pendingRewards > 1 ? "s" : ""}`}{" "}
            waiting for you
          </span>
          <ChevronRight className="size-5 shrink-0 text-sky-deep" aria-hidden />
        </Link>
      )}

      {loading ? (
        <p className="pt-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ kid, balance, done, total }) => {
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            return (
              <li
                key={kid.id}
                className="space-y-2 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold text-ink">
                    {kid.display_name}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-points-soft px-2.5 py-1">
                    <Star className="size-3.5 fill-points text-points" aria-hidden />
                    <span className="font-display text-sm font-extrabold text-points tabular-nums">
                      {balance}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {total === 0 ? "No chores today" : `${done}/${total} done`}
                  </span>
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No kids yet.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
