import type { AnalyticsPeriod } from "../entities/sales-analytics";
import { storeDateKey, storeDayStart, storeMonthStart } from "../value-objects/store-time";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  from: Date;
  to: Date;
}

export interface PeriodRanges {
  current: DateRange;
  previous: DateRange;
  // Store days (YYYY-MM-DD) each range covers, oldest first: the x-axis.
  currentDays: string[];
  previousDays: string[];
}

// YYYY-MM-DD keys from the day of `from` to the day of `to` (store zone).
export function storeDaysBetween(from: Date, to: Date): string[] {
  const days: string[] = [];
  const last = storeDateKey(to);
  // Noon avoids any edge at midnight; Peru has no daylight saving.
  let cursor = new Date(`${storeDateKey(from)}T12:00:00-05:00`);
  while (storeDateKey(cursor) <= last) {
    days.push(storeDateKey(cursor));
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return days;
}

// The current window ends now; the previous one has the same length and ends
// at the same time of day, so "today until 3 pm" compares with "yesterday
// until 3 pm" and the comparison is always fair.
export function periodRanges(period: AnalyticsPeriod, now: Date): PeriodRanges {
  const today = storeDayStart(now);
  let current: DateRange;
  let previous: DateRange;

  if (period === "month") {
    const monthStart = storeMonthStart(now);
    const previousStart = storeMonthStart(new Date(monthStart.getTime() - DAY_MS));
    const elapsed = now.getTime() - monthStart.getTime();
    current = { from: monthStart, to: now };
    previous = {
      from: previousStart,
      // A short previous month (February) stops at its own end.
      to: new Date(Math.min(previousStart.getTime() + elapsed, monthStart.getTime() - 1)),
    };
  } else {
    const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
    const shift = days * DAY_MS;
    current = { from: new Date(today.getTime() - (days - 1) * DAY_MS), to: now };
    previous = {
      from: new Date(current.from.getTime() - shift),
      to: new Date(now.getTime() - shift),
    };
  }

  return {
    current,
    previous,
    currentDays: storeDaysBetween(current.from, current.to),
    previousDays: storeDaysBetween(previous.from, previous.to),
  };
}
