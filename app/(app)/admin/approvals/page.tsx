"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Gift, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  approve,
  listPending,
  reject,
  type PendingCompletion,
} from "@/lib/db/repositories/completions";
import {
  denyRedemption,
  fulfillRedemption,
  listPendingRedemptions,
  type PendingRedemption,
} from "@/lib/db/repositories/redemptions";

export default function ApprovalsPage() {
  const sb = useMemo(() => createClient(), []);
  const [completions, setCompletions] = useState<PendingCompletion[]>([]);
  const [redemptions, setRedemptions] = useState<PendingRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        listPending(sb),
        listPendingRedemptions(sb),
      ]);
      setCompletions(c);
      setRedemptions(r);
    } catch {
      setError("Couldn't load the queue. Try again.");
    } finally {
      setLoading(false);
    }
  }, [sb]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function act(id: string, fn: () => Promise<void>) {
    if (busy.has(id)) return;
    setBusy((b) => new Set(b).add(id));
    setError(null);
    try {
      await fn();
      await reload();
    } catch {
      setError("That action didn't go through. Try again.");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(id);
        return n;
      });
    }
  }

  const nothing =
    !loading && completions.length === 0 && redemptions.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">Approvals</h1>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="pt-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : nothing ? (
        <div className="flex flex-col items-center gap-3 pt-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-success-soft text-success">
            <Check className="size-8" aria-hidden />
          </div>
          <p className="font-display text-xl font-bold text-ink">All caught up!</p>
          <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>
        </div>
      ) : (
        <>
          {completions.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Chores to approve
              </h2>
              <ul className="space-y-2">
                {completions.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {c.chore?.title ?? "Chore"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.child?.display_name} · {c.due_date} ·{" "}
                        <span className="font-semibold text-points">
                          {c.chore?.points ?? 0} pts
                        </span>
                      </p>
                    </div>
                    <ActionButtons
                      busy={busy.has(c.id)}
                      onYes={() => act(c.id, () => approve(sb, c.id))}
                      onNo={() => act(c.id, () => reject(sb, c.id))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {redemptions.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                <Gift className="size-4" aria-hidden /> Reward requests
              </h2>
              <ul className="space-y-2">
                {redemptions.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {r.reward?.title ?? "Reward"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.child?.display_name} ·{" "}
                        <span className="font-semibold text-points">
                          {r.cost} pts
                        </span>
                      </p>
                    </div>
                    <ActionButtons
                      busy={busy.has(r.id)}
                      onYes={() => act(r.id, () => fulfillRedemption(sb, r.id))}
                      onNo={() => act(r.id, () => denyRedemption(sb, r.id))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ActionButtons({
  busy,
  onYes,
  onNo,
}: {
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={onNo}
        disabled={busy}
        aria-label="Reject"
        className="flex size-10 items-center justify-center rounded-full border border-border text-destructive active:scale-90 disabled:opacity-50"
      >
        <X className="size-5" aria-hidden />
      </button>
      <button
        onClick={onYes}
        disabled={busy}
        aria-label="Approve"
        className="flex size-10 items-center justify-center rounded-full bg-success text-success-foreground active:scale-90 disabled:opacity-50"
      >
        <Check className="size-5" aria-hidden />
      </button>
    </div>
  );
}
