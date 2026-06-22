"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { listChores } from "@/lib/db/repositories/chores";
import {
  checkOff,
  listCompletionsForDate,
  undo,
} from "@/lib/db/repositories/completions";
import { getBalance } from "@/lib/db/repositories/balances";
import { buildTodayChecklist, type ChecklistItem } from "@/lib/domain/recurrence";
import { formatDayLabel, todayInZone } from "@/lib/domain/dates";

export function ChecklistView({
  childId,
  familyId,
  timezone,
  childName,
}: {
  childId: string;
  familyId: string;
  timezone: string;
  childName: string;
}) {
  const sb = useMemo(() => createClient(), []);
  const today = useMemo(() => todayInZone(timezone), [timezone]);

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      const [chores, completions, bal] = await Promise.all([
        listChores(sb),
        listCompletionsForDate(sb, childId, today),
        getBalance(sb, childId),
      ]);
      setItems(buildTodayChecklist(chores, completions, today));
      setBalance(bal);
    } catch {
      setError("Couldn't load your chores. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [sb, childId, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const setItemStatus = (choreId: string, patch: Partial<ChecklistItem>) =>
    setItems((prev) =>
      prev.map((it) => (it.chore.id === choreId ? { ...it, ...patch } : it)),
    );

  async function toggle(item: ChecklistItem) {
    if (item.status === "approved") return; // locked once Mom approves
    if (busy.has(item.chore.id)) return;
    setBusy((b) => new Set(b).add(item.chore.id));
    setError(null);

    try {
      if (item.status === "not_done" || item.status === "rejected") {
        setItemStatus(item.chore.id, { status: "pending" }); // optimistic
        const row = await checkOff(sb, {
          family_id: familyId,
          chore_id: item.chore.id,
          child_id: childId,
          due_date: today,
        });
        // Reflect the real row (auto-approve may have made it 'approved').
        setItemStatus(item.chore.id, { status: row.status, completion: row });
        if (row.status === "approved") await refreshBalance();
      } else if (item.status === "pending" && item.completion) {
        setItemStatus(item.chore.id, { status: "not_done", completion: null }); // optimistic
        await undo(sb, item.completion.id);
      }
    } catch {
      setError("That didn't save. Check your connection and try again.");
      await reload();
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(item.chore.id);
        return n;
      });
    }
  }

  async function refreshBalance() {
    try {
      setBalance(await getBalance(sb, childId));
    } catch {
      /* non-fatal */
    }
  }

  const doneCount = items.filter(
    (i) => i.status === "approved" || i.status === "pending",
  ).length;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">
              Hi {childName}!
            </h1>
            <p className="text-xs text-muted-foreground">{formatDayLabel(today)}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-points-soft px-3 py-1.5">
            <Star className="size-4 fill-points text-points" aria-hidden />
            <span className="font-display text-lg font-extrabold text-points tabular-nums">
              {balance}
            </span>
          </div>
        </div>
        {!loading && items.length > 0 && (
          <p className="text-sm font-semibold text-muted-foreground">
            {doneCount} of {items.length} done today
          </p>
        )}
      </header>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="pt-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-success-soft text-success">
            <Check className="size-8" aria-hidden />
          </div>
          <p className="font-display text-xl font-bold text-ink">
            Nothing due today!
          </p>
          <p className="text-sm text-muted-foreground">Enjoy your day. 🎉</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ChoreCard
              key={item.chore.id}
              item={item}
              busy={busy.has(item.chore.id)}
              onToggle={() => toggle(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChoreCard({
  item,
  busy,
  onToggle,
}: {
  item: ChecklistItem;
  busy: boolean;
  onToggle: () => void;
}) {
  const { chore, status } = item;

  return (
    <li>
      <button
        onClick={onToggle}
        disabled={busy || status === "approved"}
        className={cn(
          "flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition active:scale-[0.99]",
          status === "approved"
            ? "border-success/30 bg-success-soft"
            : status === "pending"
              ? "border-sky/40 bg-sky/10"
              : "border-border bg-card",
        )}
      >
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition",
            status === "approved"
              ? "border-success bg-success text-success-foreground"
              : status === "pending"
                ? "border-sky-deep bg-sky-deep text-primary-foreground"
                : "border-input bg-card text-transparent",
          )}
        >
          <Check className="size-6" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{chore.title}</span>
          {chore.description && (
            <span className="block truncate text-xs text-muted-foreground">
              {chore.description}
            </span>
          )}
          {status === "pending" && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-sky-deep">
              <Clock className="size-3" aria-hidden /> Waiting for Mom
            </span>
          )}
          {status === "approved" && (
            <span className="mt-0.5 block text-xs font-semibold text-success">
              Approved · +{item.completion?.points_awarded ?? chore.points} pts
            </span>
          )}
          {status === "rejected" && (
            <span className="mt-0.5 block text-xs font-semibold text-destructive">
              Not approved — tap to try again
            </span>
          )}
        </span>

        <span className="shrink-0 font-display text-base font-extrabold text-points tabular-nums">
          {chore.points}
        </span>
      </button>
    </li>
  );
}
