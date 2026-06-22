"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Gift, Lock, Star, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { listRewards } from "@/lib/db/repositories/rewards";
import { getBalance } from "@/lib/db/repositories/balances";
import {
  cancelRedemption,
  listMyRedemptions,
  requestRedemption,
  type RedemptionWithReward,
} from "@/lib/db/repositories/redemptions";
import type { Reward } from "@/lib/domain";

export function RewardsView({ childId }: { childId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [mine, setMine] = useState<RedemptionWithReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      const [bal, list, redemptions] = await Promise.all([
        getBalance(sb, childId),
        listRewards(sb),
        listMyRedemptions(sb, childId),
      ]);
      setBalance(bal);
      setRewards(list);
      setMine(redemptions);
    } catch {
      setError("Couldn't load rewards. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [sb, childId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function withBusy(key: string, fn: () => Promise<unknown>) {
    if (busy.has(key)) return;
    setBusy((b) => new Set(b).add(key));
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      const msg =
        e instanceof Error && /not enough points/i.test(e.message)
          ? "Not enough points yet — keep going!"
          : "That didn't work. Try again.";
      setError(msg);
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(key);
        return n;
      });
    }
  }

  const pending = mine.filter((m) => m.status === "pending");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Rewards</h1>
        <div className="flex items-center gap-1.5 rounded-full bg-points-soft px-3 py-1.5">
          <Star className="size-4 fill-points text-points" aria-hidden />
          <span className="font-display text-lg font-extrabold text-points tabular-nums">
            {balance}
          </span>
        </div>
      </header>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="pt-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Waiting for Mom
              </h2>
              <ul className="space-y-2">
                {pending.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl border border-sky/40 bg-sky/10 px-4 py-3"
                  >
                    <Clock className="size-5 shrink-0 text-sky-deep" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        {m.reward?.title ?? "Reward"}
                      </p>
                      <p className="text-xs font-semibold text-sky-deep">
                        {m.cost} pts held
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        withBusy(m.id, () => cancelRedemption(sb, m.id))
                      }
                      disabled={busy.has(m.id)}
                      aria-label="Cancel"
                      className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground active:scale-90 disabled:opacity-50"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Store
            </h2>
            {rewards.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No rewards yet. Ask Mom to add some!
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {rewards.map((r) => {
                  const affordable = balance >= r.cost;
                  return (
                    <li
                      key={r.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="flex size-10 items-center justify-center rounded-xl bg-points-soft text-points">
                        <Gift className="size-5" aria-hidden />
                      </div>
                      <p className="flex-1 font-semibold leading-tight text-ink">
                        {r.title}
                      </p>
                      <p className="font-display text-base font-extrabold text-points tabular-nums">
                        {r.cost} pts
                      </p>
                      <button
                        onClick={() =>
                          withBusy(r.id, () => requestRedemption(sb, r.id))
                        }
                        disabled={!affordable || busy.has(r.id)}
                        className={cn(
                          "flex h-10 items-center justify-center gap-1 rounded-xl text-sm font-bold transition active:scale-95",
                          affordable
                            ? "bg-sky-deep text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {affordable ? (
                          "Redeem"
                        ) : (
                          <>
                            <Lock className="size-3.5" aria-hidden /> {r.cost - balance} more
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
