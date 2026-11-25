import "server-only";

/**
 * Indian Standard Time day/month boundaries (UTC+5:30, no DST) so "today" and "this month" match what the
 * client sees in India regardless of the server's timezone.
 */
const IST = 330 * 60 * 1000;
const DAY = 86400000;

export function istDayStart(d = new Date()): Date {
  const t = d.getTime() + IST;
  return new Date(Math.floor(t / DAY) * DAY - IST);
}

export function istMonthStart(d = new Date()): Date {
  const ist = new Date(d.getTime() + IST);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST);
}

export function istPrevMonthStart(d = new Date()): Date {
  const ist = new Date(d.getTime() + IST);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1) - IST);
}

/** yyyy-mm-dd of the IST calendar day containing `d` */
export function istKey(d: Date): string {
  return new Date(d.getTime() + IST).toISOString().slice(0, 10);
}

/** UTC-midnight Date for an IST calendar day — the representation of @db.Date columns (AdStatDaily.date). */
export function istDateOnly(d = new Date()): Date {
  return new Date(istKey(d) + "T00:00:00.000Z");
}

/** Parse "yyyy-mm-dd" as the start of that IST day (null when invalid). */
export function parseIstDay(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s + "T00:00:00.000Z");
  return Number.isNaN(t) ? null : new Date(t - IST);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
