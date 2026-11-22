import type { UserRole } from "./user";

// Attendance of the store's staff (cashiers and warehouse keepers), not of
// the airport workers (customers with a discount, who never log in).

export type AttendanceStatus = "open" | "closed" | "missing_clock_out";
export type AttendanceField = "clock_in" | "clock_out";
export type AttendanceCorrectionStatus = "pending" | "approved" | "rejected";

export const ATTENDANCE_FIELD_LABELS: Record<AttendanceField, string> = {
  clock_in: "Entrada",
  clock_out: "Salida",
};

export const ATTENDANCE_CORRECTION_STATUS_LABELS: Record<AttendanceCorrectionStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

// Business rule: cashiers and warehouse keepers must mark their entrance
// before working. The admin may mark, but is never blocked.
export function requiresAttendance(role: UserRole) {
  return role === "cashier" || role === "warehouse";
}

// Device clock further than this from the server's makes a mark suspicious.
export const SUSPICIOUS_CLOCK_MS = 5 * 60 * 1000;
// Opening the till this long before the start or after the end of the
// schedule is audited as "outside of schedule".
export const OFF_SCHEDULE_MARGIN_MIN = 30;
export const DEFAULT_TOLERANCE_MIN = 10;
// Business rule (clock-in window): "Marcar entrada" opens only this many
// minutes before the scheduled start (the admin sets it per person and day),
// and never on a day without schedule — the admin registers that workday.
// Arriving late is allowed (past the tolerance it counts as late). Hours
// worked count from the scheduled start, not from an earlier mark.
export const DEFAULT_EARLY_MIN = 5;

// One working weekday of a person's weekly template (0 = Sunday). Only used
// to fill the calendar (work_shifts) in bulk: clock-in, lateness and
// absences read the dated shifts.
export interface WorkSchedule {
  userId: number;
  weekday: number;
  // "HH:MM", store time. An end before the start ends the next day.
  startTime: string;
  endTime: string;
  toleranceMin: number;
  // Minutes before startTime that "Marcar entrada" is enabled.
  earlyMin: number;
}

// Business rule: the calendar is the source of truth of who works when. A
// person has at most one shift per date (one workday per date).
export interface WorkShift {
  id: number;
  uuid: string;
  userId: number;
  // "YYYY-MM-DD", store date the shift starts on.
  workDate: string;
  // "HH:MM", store time. An end before the start ends the next day.
  startTime: string;
  endTime: string;
  toleranceMin: number;
  earlyMin: number;
  color: ShiftColor;
  note: string | null;
}

// What a shift is without its identity (copied, pasted, from the template).
export type ShiftPattern = Pick<
  WorkShift,
  "userId" | "startTime" | "endTime" | "toleranceMin" | "earlyMin" | "color" | "note"
>;

// Fixed palette (the calendar colors a shift with one of these).
export const SHIFT_COLORS = [
  "#15803d",
  "#facc15",
  "#ea580c",
  "#c084fc",
  "#1d4ed8",
  "#2dd4bf",
  "#7e22ce",
  "#fda4af",
  "#a3a32a",
  "#0ea5e9",
] as const;
export type ShiftColor = (typeof SHIFT_COLORS)[number];

export const DEFAULT_SHIFT_COLOR: Record<"cashier" | "warehouse", ShiftColor> = {
  cashier: "#ea580c",
  warehouse: "#1d4ed8",
};

// Shifts the device keeps for offline clock-in: a forgotten workday from
// last week and the next two weeks.
export const DEVICE_SHIFT_DAYS_BEFORE = 7;
export const DEVICE_SHIFT_DAYS_AFTER = 14;

export interface AttendanceRecord {
  id: number;
  uuid: string;
  userId: number;
  userName: string;
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  toleranceMin: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: AttendanceStatus;
  offline: boolean;
  timeSuspicious: boolean;
  isCorrected: boolean;
  createdByName: string | null;
}

// Everything stored about a workday, for the admin's audit trail.
export interface AttendanceRecordDetail extends AttendanceRecord {
  clockInDeviceAt: Date | null;
  clockInReceivedAt: Date;
  clockOutDeviceAt: Date | null;
  clockOutReceivedAt: Date | null;
  createdAt: Date;
}

export interface AttendanceCorrection {
  id: number;
  uuid: string;
  attendanceUuid: string;
  attendanceId: number | null;
  userName: string | null;
  workDate: string | null;
  field: AttendanceField;
  oldValue: Date | null;
  newValue: Date;
  reason: string;
  requestedById: number;
  requestedByName: string;
  status: AttendanceCorrectionStatus;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
}

// Staff member as listed in the attendance reports.
export interface AttendancePerson {
  id: number;
  name: string;
  role: UserRole;
  isActive: boolean;
  // Store date the user was created: no absences before it.
  since: string;
}

// What the device needs to show the clock-in screen without internet.
export interface AttendanceTodayState {
  serverTime: string;
  // The person's shifts around today (see DEVICE_SHIFT_DAYS_*).
  shifts: WorkShift[];
  // The person's workdays still open (today's, or a forgotten one).
  open: { uuid: string; workDate: string; clockInAt: string }[];
  // Today's workdays already closed (to tell "you already left").
  closedToday: { uuid: string; clockInAt: string; clockOutAt: string }[];
}
