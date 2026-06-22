// ISO date (YYYY-MM-DD) helpers, family-timezone aware. "Today" is ALWAYS
// computed in the family's timezone (never bare new Date()), so every device —
// a kid's phone in another timezone, Mom's tablet — agrees on the logical day.
// This is what makes the daily reset deterministic (architecture §7, Decision 1).

// The current calendar day in the given IANA timezone, as YYYY-MM-DD.
// en-CA formats as YYYY-MM-DD.
export function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Day of week for an ISO date: 0=Sun .. 6=Sat (matches chores.weekdays).
// Parsed at UTC noon to dodge any DST/offset edge.
export function getDayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

// Add (or subtract) whole days to an ISO date, returning a new ISO date.
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

// A friendly label like "Monday, June 22" for an ISO date.
export function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
