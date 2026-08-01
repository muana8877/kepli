import type { DateString } from "@/types";

/**
 * Calendar-day helpers. Everything here works in the *local* day, not UTC: a check-in
 * belongs to the day the user experienced, so `toISOString().slice(0, 10)` is wrong
 * for anyone west of Greenwich and is deliberately not used.
 */

/** Format a Date as `YYYY-MM-DD` in local time. */
export function toDateString(date: Date): DateString {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` into a local-midnight Date. */
export function fromDateString(value: DateString): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the week containing `date`. Weeks run Monday–Sunday. */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0 = Sunday. Shift so Monday is 0.
  const offset = (start.getDay() + 6) % 7;
  return addDays(start, -offset);
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: DateString, to: DateString): number {
  const ms = fromDateString(to).getTime() - fromDateString(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Days from today until `date`. Negative once the date has passed. */
export function daysUntil(date: DateString): number {
  return daysBetween(toDateString(new Date()), date);
}

/** Today as a `YYYY-MM-DD` string. */
export function today(): DateString {
  return toDateString(new Date());
}

/** e.g. "Fri 31 Jul". Short form for lists. */
export function formatShort(date: DateString): string {
  return fromDateString(date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** e.g. "31 July 2026". Long form for headers. */
export function formatLong(date: DateString): string {
  return fromDateString(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
