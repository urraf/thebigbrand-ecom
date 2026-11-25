import "server-only";

/**
 * Ad stats are bucketed by Indian calendar day (Asia/Kolkata, UTC+5:30, no DST). `AdStatDaily.date` is a
 * Postgres DATE, stored as UTC midnight of that IST calendar day.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;

export function istDateKey(d = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC-midnight Date for the IST calendar day of `d` (value for a @db.Date column). */
export function istDay(d = new Date()): Date {
  return new Date(`${istDateKey(d)}T00:00:00.000Z`);
}

/** Start of today in IST as an absolute instant. */
export function istStartOfToday(d = new Date()): Date {
  return new Date(istDay(d).getTime() - IST_OFFSET_MS);
}

/** IST calendar date (YYYY-MM-DD) → the instant it starts (00:00 IST). */
export function istStartOf(dateIso: string): Date {
  return new Date(new Date(`${dateIso}T00:00:00.000Z`).getTime() - IST_OFFSET_MS);
}

/** IST calendar date (YYYY-MM-DD) → the last millisecond of that day in IST. */
export function istEndOf(dateIso: string): Date {
  return new Date(istStartOf(dateIso).getTime() + 864e5 - 1);
}

export function addDaysIso(dateIso: string, n: number): string {
  const t = new Date(`${dateIso}T00:00:00.000Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
