import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { View } from "react-big-calendar";
import {
  DEFAULT_SHIFT_COLOR,
  type ShiftColor,
  type ShiftPattern,
  type WorkShift,
} from "@/domain/entities/attendance";
import type { UserRole } from "@/domain/entities/user";

// The calendar runs in the browser's zone, which in the store is the store's
// (America/Lima): dates are "YYYY-MM-DD" and times "HH:MM" on both sides.

export interface StaffMember {
  id: number;
  name: string;
  role: UserRole;
}

export interface ShiftEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  shift: WorkShift;
  person: StaffMember | null;
}

export type Clipboard =
  | { kind: "shift"; label: string; items: ShiftPattern[] }
  | { kind: "day"; label: string; items: ShiftPattern[] };

export const WEEK_STARTS_ON = 1;
export const AGENDA_DAYS = 30;

export const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");
export const toHHMM = (date: Date) => format(date, "HH:mm");

export function atLocal(dateKey: string, hhmm: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function shiftToEvent(shift: WorkShift, person: StaffMember | null): ShiftEvent {
  const start = atLocal(shift.workDate, shift.startTime);
  let end = atLocal(shift.workDate, shift.endTime);
  // Night shift: ends the next day.
  if (end <= start) end = atLocal(toDateKey(addDays(start, 1)), shift.endTime);
  return {
    id: shift.id,
    title: `${person?.name ?? "Personal retirado"} · ${shift.startTime}–${shift.endTime}`,
    start,
    end,
    shift,
    person,
  };
}

export function patternOf(shift: WorkShift): ShiftPattern {
  return {
    userId: shift.userId,
    startTime: shift.startTime,
    endTime: shift.endTime,
    toleranceMin: shift.toleranceMin,
    earlyMin: shift.earlyMin,
    color: shift.color,
    note: shift.note,
  };
}

// Dates the view shows (plus the day before: a night shift from it spills
// into the first visible day).
export function visibleRange(date: Date, view: View) {
  let from: Date;
  let to: Date;
  if (view === "month") {
    from = startOfWeek(startOfMonth(date), { weekStartsOn: WEEK_STARTS_ON });
    to = endOfWeek(endOfMonth(date), { weekStartsOn: WEEK_STARTS_ON });
  } else if (view === "week" || view === "work_week") {
    from = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
    to = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
  } else if (view === "agenda") {
    from = date;
    to = addDays(date, AGENDA_DAYS);
  } else {
    from = date;
    to = date;
  }
  return { from: toDateKey(addDays(from, -1)), to: toDateKey(to) };
}

// Black or white text, whichever reads better on the shift's color.
export function textOn(color: string) {
  const hex = color.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? "#111827" : "#ffffff";
}

// The color a person's new shift gets: their latest one, or their role's.
export function preferredColor(person: StaffMember, shifts: WorkShift[]): ShiftColor {
  const mine = shifts.filter((s) => s.userId === person.id);
  return (
    mine.at(-1)?.color ??
    DEFAULT_SHIFT_COLOR[person.role === "warehouse" ? "warehouse" : "cashier"]
  );
}
