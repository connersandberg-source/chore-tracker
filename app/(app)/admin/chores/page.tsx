"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import {
  createChore,
  deleteChore,
  listChores,
  updateChore,
} from "@/lib/db/repositories/chores";
import { listChildren } from "@/lib/db/repositories/profiles";
import type { Chore, ChoreDraft, Profile, RecurrenceType } from "@/lib/domain";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function emptyDraft(childId: string): ChoreDraft {
  return {
    child_id: childId,
    title: "",
    description: null,
    points: 10,
    recurrence_type: "daily",
    weekdays: [],
    start_date: todayISO(),
    active: true,
  };
}

function recurrenceLabel(c: Chore): string {
  if (c.recurrence_type === "daily") return "Every day";
  if (c.recurrence_type === "one_off") return `One time · ${c.start_date}`;
  const days = [...c.weekdays].sort().map((d) => WEEKDAYS[d]).join(", ");
  return days ? `Weekly · ${days}` : "Weekly";
}

export default function AdminChoresPage() {
  const { profile } = useAuth();
  const sb = useMemo(() => createClient(), []);

  const [children, setChildren] = useState<Profile[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ChoreDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [kids, list] = await Promise.all([listChildren(sb), listChores(sb)]);
      setChildren(kids);
      setChores(list);
    } catch {
      setError("Couldn't load chores. Pull to refresh or try again.");
    } finally {
      setLoading(false);
    }
  }, [sb]);

  useEffect(() => {
    // Load on mount. State is set after an await inside reload(), not
    // synchronously, so the cascading-render warning is a false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft(children[0]?.id ?? ""));
  }

  function startEdit(c: Chore) {
    setEditingId(c.id);
    setDraft({
      child_id: c.child_id,
      title: c.title,
      description: c.description,
      points: c.points,
      recurrence_type: c.recurrence_type,
      weekdays: c.weekdays,
      start_date: c.start_date,
      active: c.active,
    });
  }

  function closeForm() {
    setDraft(null);
    setEditingId(null);
  }

  async function onSave() {
    if (!draft || !profile) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateChore(sb, editingId, draft);
      } else {
        await createChore(
          sb,
          { family_id: profile.family_id, created_by: profile.id },
          draft,
        );
      }
      closeForm();
      await reload();
    } catch {
      setError("Couldn't save that chore. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(c: Chore) {
    if (!confirm(`Delete "${c.title}"? This can't be undone.`)) return;
    try {
      await deleteChore(sb, c.id);
      await reload();
    } catch {
      setError("Couldn't delete that chore.");
    }
  }

  const grouped = children.map((kid) => ({
    kid,
    items: chores.filter((c) => c.child_id === kid.id),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">Chores</h1>
        <button
          onClick={startCreate}
          disabled={children.length === 0}
          className="flex items-center gap-1.5 rounded-full bg-sky-deep px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm active:scale-95 disabled:opacity-50"
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
      ) : (
        <div className="space-y-6">
          {grouped.map(({ kid, items }) => (
            <section key={kid.id} className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {kid.display_name}
              </h2>
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                  No chores yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-semibold text-ink">
                          <span className="truncate">{c.title}</span>
                          {!c.active && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                              Off
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {recurrenceLabel(c)} ·{" "}
                          <span className="font-semibold text-points">
                            {c.points} pts
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => startEdit(c)}
                        aria-label="Edit"
                        className="rounded-lg p-2 text-muted-foreground active:scale-90"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => onDelete(c)}
                        aria-label="Delete"
                        className="rounded-lg p-2 text-destructive active:scale-90"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {children.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No kids yet. Add child accounts first, then assign chores.
            </p>
          )}
        </div>
      )}

      {draft && (
        <ChoreForm
          draft={draft}
          setDraft={setDraft}
          kids={children}
          editing={!!editingId}
          saving={saving}
          onSave={onSave}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

function ChoreForm({
  draft,
  setDraft,
  kids,
  editing,
  saving,
  onSave,
  onClose,
}: {
  draft: ChoreDraft;
  setDraft: (d: ChoreDraft) => void;
  kids: Profile[];
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = <K extends keyof ChoreDraft>(k: K, v: ChoreDraft[K]) =>
    setDraft({ ...draft, [k]: v });

  function toggleDay(d: number) {
    const has = draft.weekdays.includes(d);
    set(
      "weekdays",
      has ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d],
    );
  }

  const field =
    "h-12 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus:border-sky focus:ring-2 focus:ring-ring/40";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit chore" : "New chore"}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">
            {editing ? "Edit chore" : "New chore"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1">
            <X className="size-5 text-muted-foreground" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-ink">Chore</span>
            <input
              className={field}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Take the trash out"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-ink">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              className={field}
              value={draft.description ?? ""}
              onChange={(e) =>
                set("description", e.target.value ? e.target.value : null)
              }
              placeholder="Curb on collection days"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-ink">Who</span>
              <select
                className={field}
                value={draft.child_id}
                onChange={(e) => set("child_id", e.target.value)}
              >
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-ink">Points</span>
              <input
                type="number"
                min={0}
                max={1000}
                className={field}
                value={draft.points}
                onChange={(e) => set("points", Number(e.target.value) || 0)}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">Repeats</span>
            <div className="grid grid-cols-3 gap-2">
              {(["daily", "weekly", "one_off"] as RecurrenceType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("recurrence_type", r)}
                  className={`h-11 rounded-xl border text-sm font-semibold capitalize transition ${
                    draft.recurrence_type === r
                      ? "border-sky-deep bg-sky/15 text-sky-deep"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {r === "one_off" ? "One time" : r}
                </button>
              ))}
            </div>
          </div>

          {draft.recurrence_type === "weekly" && (
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-ink">On which days</span>
              <div className="flex justify-between gap-1">
                {WEEKDAYS.map((label, d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`size-10 rounded-full text-xs font-bold transition ${
                      draft.weekdays.includes(d)
                        ? "bg-sky-deep text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {label[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-ink">
              {draft.recurrence_type === "one_off" ? "Date" : "Starts"}
            </span>
            <input
              type="date"
              className={field}
              value={draft.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-semibold text-ink">Active</span>
            <input
              type="checkbox"
              className="size-5 accent-sky-deep"
              checked={draft.active}
              onChange={(e) => set("active", e.target.checked)}
            />
          </label>

          <button
            onClick={onSave}
            disabled={saving || !draft.title.trim() || !draft.child_id}
            className="h-13 w-full rounded-xl bg-sky-deep text-base font-bold text-primary-foreground shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Add chore"}
          </button>
        </div>
      </div>
    </div>
  );
}
