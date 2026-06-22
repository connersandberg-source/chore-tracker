"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import {
  createReward,
  deleteReward,
  listRewards,
  updateReward,
} from "@/lib/db/repositories/rewards";
import type { Reward, RewardDraft } from "@/lib/domain";

function emptyDraft(): RewardDraft {
  return { title: "", description: null, cost: 20, active: true };
}

export default function AdminRewardsPage() {
  const { profile } = useAuth();
  const sb = useMemo(() => createClient(), []);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RewardDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRewards(await listRewards(sb));
    } catch {
      setError("Couldn't load rewards. Try again.");
    } finally {
      setLoading(false);
    }
  }, [sb]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  function startEdit(r: Reward) {
    setEditingId(r.id);
    setDraft({
      title: r.title,
      description: r.description,
      cost: r.cost,
      active: r.active,
    });
  }

  async function onSave() {
    if (!draft || !profile) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) await updateReward(sb, editingId, draft);
      else await createReward(sb, { family_id: profile.family_id }, draft);
      setDraft(null);
      setEditingId(null);
      await reload();
    } catch {
      setError("Couldn't save that reward. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(r: Reward) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try {
      await deleteReward(sb, r.id);
      await reload();
    } catch {
      setError("Couldn't delete that reward.");
    }
  }

  const field =
    "h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus:border-sky focus:ring-2 focus:ring-ring/40";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Rewards</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setDraft(emptyDraft());
          }}
          className="flex items-center gap-1.5 rounded-full bg-sky-deep px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm active:scale-95"
        >
          <Plus className="size-4" aria-hidden /> New
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="pt-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rewards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No rewards yet. Add one the kids can save up for.
        </p>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <span className="truncate">{r.title}</span>
                  {!r.active && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      Off
                    </span>
                  )}
                </p>
                {r.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {r.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-display text-base font-extrabold text-points tabular-nums">
                {r.cost}
              </span>
              <button
                onClick={() => startEdit(r)}
                aria-label="Edit"
                className="rounded-lg p-2 text-muted-foreground active:scale-90"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                onClick={() => onDelete(r)}
                aria-label="Delete"
                className="rounded-lg p-2 text-destructive active:scale-90"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 sm:items-center">
          <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-background p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">
                {editingId ? "Edit reward" : "New reward"}
              </h2>
              <button
                onClick={() => {
                  setDraft(null);
                  setEditingId(null);
                }}
                aria-label="Close"
                className="p-1"
              >
                <X className="size-5 text-muted-foreground" aria-hidden />
              </button>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-ink">Reward</span>
              <input
                className={field}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="30 min screen time"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-ink">
                Notes{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                className={field}
                value={draft.description ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    description: e.target.value ? e.target.value : null,
                  })
                }
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-ink">Cost (points)</span>
              <input
                type="number"
                min={1}
                className={field}
                value={draft.cost}
                onChange={(e) =>
                  setDraft({ ...draft, cost: Number(e.target.value) || 0 })
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-sm font-semibold text-ink">Active</span>
              <input
                type="checkbox"
                className="size-5 accent-sky-deep"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
            </label>

            <button
              onClick={onSave}
              disabled={saving || !draft.title.trim() || draft.cost < 1}
              className="h-13 w-full rounded-xl bg-sky-deep text-base font-bold text-primary-foreground shadow-sm active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add reward"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
