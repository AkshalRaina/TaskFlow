/** How many days ahead counts as "due soon". */
export const DUE_SOON_DAYS = 3;

/** Today's date in UTC as "YYYY-MM-DD" (due dates are stored as plain calendar dates). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A calendar date `days` after today (UTC), as a Date at midnight UTC. */
export function daysFromToday(days: number): Date {
  const date = new Date(todayUtc());
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/** Date -> "YYYY-MM-DD". */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
