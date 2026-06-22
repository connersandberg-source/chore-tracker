import { getDayOf } from "./dates";
import type { Chore, ChoreCompletion, CompletionStatus } from "./schemas";

// Pure recurrence logic — no DB, no clock. "Today's checklist" is a function of
// the chore's rule plus which completion rows exist for today's date. Because
// completions are keyed by due_date, tomorrow has no rows → every recurring
// chore is unchecked again automatically, with zero scheduled jobs.

// Is a chore due on the given ISO date?
export function isChoreDueOn(
  chore: Pick<Chore, "recurrence_type" | "weekdays" | "start_date">,
  isoDate: string,
): boolean {
  if (isoDate < chore.start_date) return false; // not started yet (lexical compare is valid for YYYY-MM-DD)
  switch (chore.recurrence_type) {
    case "one_off":
      return isoDate === chore.start_date; // its single day
    case "daily":
      return true; // every day on/after start
    case "weekly":
      return chore.weekdays.includes(getDayOf(isoDate));
  }
}

export type ChecklistStatus = CompletionStatus | "not_done";

export type ChecklistItem = {
  chore: Chore;
  status: ChecklistStatus;
  completion: ChoreCompletion | null;
};

// Build today's checklist for a child: their active, due-today chores joined to
// any completion row for today. No row → "not_done".
export function buildTodayChecklist(
  chores: Chore[],
  completions: ChoreCompletion[],
  today: string,
): ChecklistItem[] {
  const byChore = new Map(completions.map((c) => [c.chore_id, c]));
  return chores
    .filter((c) => c.active && isChoreDueOn(c, today))
    .map((chore) => {
      const completion = byChore.get(chore.id) ?? null;
      return {
        chore,
        status: completion ? completion.status : "not_done",
        completion,
      };
    });
}
