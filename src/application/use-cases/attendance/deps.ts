import type { AttendanceRepository } from "@/domain/repositories/attendance-repository";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { CashShiftRepository } from "@/domain/repositories/cash-shift-repository";
import type { WorkScheduleRepository } from "@/domain/repositories/work-schedule-repository";
import type { WorkShiftRepository } from "@/domain/repositories/work-shift-repository";
import type { ScheduledShift } from "@/domain/services/attendance";

export interface AttendanceDeps {
  attendance: AttendanceRepository;
  // Weekly template (only to fill the calendar).
  schedules: WorkScheduleRepository;
  // The calendar: source of truth of who works when.
  workShifts: WorkShiftRepository;
  audit: Pick<AuditRepository, "record" | "recordWithUuid">;
  // Cash drawer shifts (not work shifts).
  shifts: Pick<CashShiftRepository, "hasOpenShift">;
  // Server clock (injectable for tests).
  now?: () => Date;
}

export const nowOf = (deps: AttendanceDeps) => (deps.now ? deps.now() : new Date());

// The schedule frozen in the workday at clock-in.
export function snapshotShift(record: {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  toleranceMin: number | null;
}): ScheduledShift | null {
  if (!record.scheduledStart || !record.scheduledEnd) return null;
  return {
    start: record.scheduledStart,
    end: record.scheduledEnd,
    toleranceMin: record.toleranceMin ?? 0,
    // Only matters before clocking in.
    earlyMin: 0,
  };
}
