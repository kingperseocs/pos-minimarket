import type { ShiftPattern, WorkSchedule, WorkShift } from "../entities/attendance";
import { dateKeysBetween, weekdayOf } from "./attendance";

// Calendar rules (pure): copy/paste of shifts and filling dates from the
// weekly template. One shift per person and date.

export const MAX_PASTE_DATES = 62;

// A shift ready to be stored on a date.
export type DatedShift = ShiftPattern & { workDate: string };

export interface PastePlan {
  // Dates where the person had no shift.
  toCreate: DatedShift[];
  // Dates where the person had a shift, replaced (only with overwrite).
  toReplace: DatedShift[];
  // Dates where the person had a shift, left as they were.
  skipped: DatedShift[];
}

const key = (userId: number, workDate: string) => `${userId}|${workDate}`;

// What pasting `items` on every date of `targetDates` does, given the shifts
// that already exist on those dates. The same person twice in the clipboard
// for one date keeps the first (one shift per person and date).
export function planPaste(
  items: ShiftPattern[],
  targetDates: string[],
  existing: Pick<WorkShift, "userId" | "workDate">[],
  overwrite: boolean,
): PastePlan {
  const taken = new Set(existing.map((s) => key(s.userId, s.workDate)));
  const seen = new Set<string>();
  const plan: PastePlan = { toCreate: [], toReplace: [], skipped: [] };

  for (const workDate of [...new Set(targetDates)].sort()) {
    for (const item of items) {
      const k = key(item.userId, workDate);
      if (seen.has(k)) continue;
      seen.add(k);
      const shift = { ...item, workDate };
      if (!taken.has(k)) plan.toCreate.push(shift);
      else if (overwrite) plan.toReplace.push(shift);
      else plan.skipped.push(shift);
    }
  }
  return plan;
}

// Dates of [from, to], optionally only some weekdays (0 = Sunday).
export function datesInRange(from: string, to: string, weekdays?: number[]) {
  const keys = from <= to ? dateKeysBetween(from, to) : [];
  if (!weekdays || weekdays.length === 0) return keys;
  return keys.filter((k) => weekdays.includes(weekdayOf(k)));
}

// The weekly template laid on [from, to]: one shift per person and working
// weekday.
export function expandTemplate(
  template: WorkSchedule[],
  from: string,
  to: string,
  colorOf: (userId: number) => ShiftPattern["color"],
): DatedShift[] {
  const shifts: DatedShift[] = [];
  for (const workDate of datesInRange(from, to)) {
    const weekday = weekdayOf(workDate);
    for (const day of template) {
      if (day.weekday !== weekday) continue;
      shifts.push({
        userId: day.userId,
        workDate,
        startTime: day.startTime,
        endTime: day.endTime,
        toleranceMin: day.toleranceMin,
        earlyMin: day.earlyMin,
        color: colorOf(day.userId),
        note: null,
      });
    }
  }
  return shifts;
}

// "08:00" → minutes since midnight.
export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Length of a shift in minutes (a night shift wraps past midnight).
export function shiftMinutes(startTime: string, endTime: string) {
  const diff = minutesOf(endTime) - minutesOf(startTime);
  return diff > 0 ? diff : diff + 24 * 60;
}
