import {
  DEFAULT_SHIFT_COLOR,
  requiresAttendance,
  type AttendancePerson,
  type WorkShift,
} from "@/domain/entities/attendance";
import type { UserRole } from "@/domain/entities/user";
import { ValidationError } from "@/domain/errors";
import { addDays, dateKeysBetween } from "@/domain/services/attendance";
import { expandTemplate, planPaste, type DatedShift } from "@/domain/services/work-shifts";
import {
  applyTemplateSchema,
  createShiftSchema,
  pasteShiftsSchema,
  shiftRangeSchema,
  updateShiftSchema,
} from "@/application/validation/attendance";
import { idSchema } from "@/application/validation/id";
import { nowOf, type AttendanceDeps } from "./deps";

type Admin = { id: number; role: UserRole };

// Longest range listed or filled at once (a month view shows ~6 weeks).
const MAX_RANGE_DAYS = 120;

export interface PasteResult {
  created: number;
  replaced: number;
  skipped: number;
}

// Staff who can have shifts: active cashiers and warehouse keepers.
export async function listShiftStaffUseCase(deps: AttendanceDeps) {
  const people = await deps.attendance.listPeople();
  return people.filter((p) => p.isActive && requiresAttendance(p.role));
}

async function assertStaff(deps: AttendanceDeps, userIds: number[]) {
  const staff = await listShiftStaffUseCase(deps);
  const byId = new Map(staff.map((p) => [p.id, p]));
  for (const id of new Set(userIds)) {
    if (!byId.has(id)) {
      throw new ValidationError("Solo se asignan turnos a cajeros y almaceneros activos");
    }
  }
  return byId;
}

function assertRange(from: string, to: string) {
  if (dateKeysBetween(from, to).length > MAX_RANGE_DAYS) {
    throw new ValidationError(`El rango máximo es de ${MAX_RANGE_DAYS} días`);
  }
}

export async function listShiftsUseCase(deps: AttendanceDeps, input: unknown) {
  const range = shiftRangeSchema.parse(input);
  assertRange(range.from, range.to);
  return deps.workShifts.listBetween(range.from, range.to);
}

const shiftSummary = (s: Pick<WorkShift, "userId" | "workDate" | "startTime" | "endTime">) => ({
  userId: s.userId,
  workDate: s.workDate,
  startTime: s.startTime,
  endTime: s.endTime,
});

// Every change to the calendar is audited: shifts decide who was late or
// absent.
export async function createShiftUseCase(deps: AttendanceDeps, input: unknown, admin: Admin) {
  const data = createShiftSchema.parse(input);
  await assertStaff(deps, [data.userId]);
  const [existing] = await deps.workShifts.listBetween(data.workDate, data.workDate, data.userId);
  if (existing) throw new ValidationError("Esa persona ya tiene un turno ese día");
  await deps.workShifts.upsertMany([data], admin.id);
  await deps.audit.record({
    type: "work_shift_created",
    actorId: admin.id,
    payload: shiftSummary(data),
    occurredAt: nowOf(deps),
  });
}

export async function updateShiftUseCase(deps: AttendanceDeps, input: unknown, admin: Admin) {
  const { id, ...data } = updateShiftSchema.parse(input);
  const before = await deps.workShifts.findById(id);
  if (!before) throw new ValidationError("El turno ya no existe");
  await assertStaff(deps, [data.userId]);
  const after = await deps.workShifts.update(id, data, admin.id);
  await deps.audit.record({
    type: "work_shift_updated",
    actorId: admin.id,
    payload: { id, before: shiftSummary(before), after: shiftSummary(after) },
    occurredAt: nowOf(deps),
  });
  return after;
}

export async function deleteShiftUseCase(deps: AttendanceDeps, input: unknown, admin: Admin) {
  const id = idSchema.parse(input);
  const before = await deps.workShifts.findById(id);
  if (!before) return;
  await deps.workShifts.delete(id);
  await deps.audit.record({
    type: "work_shift_deleted",
    actorId: admin.id,
    payload: { id, ...shiftSummary(before) },
    occurredAt: nowOf(deps),
  });
}

// Stores already-dated shifts in [from, to]: new ones are created, those
// that collide with an existing shift are replaced or skipped.
async function storeDated(
  deps: AttendanceDeps,
  shifts: DatedShift[],
  range: { from: string; to: string },
  overwrite: boolean,
  admin: Admin,
): Promise<PasteResult> {
  const existing = await deps.workShifts.listBetween(range.from, range.to);
  const taken = new Set(existing.map((s) => `${s.userId}|${s.workDate}`));
  const isTaken = (s: DatedShift) => taken.has(`${s.userId}|${s.workDate}`);
  const toCreate = shifts.filter((s) => !isTaken(s));
  const toReplace = overwrite ? shifts.filter(isTaken) : [];
  await deps.workShifts.upsertMany([...toCreate, ...toReplace], admin.id);
  return {
    created: toCreate.length,
    replaced: toReplace.length,
    skipped: shifts.length - toCreate.length - toReplace.length,
  };
}

// Copied shift(s) (one or a whole day) pasted on the chosen dates.
export async function pasteShiftsUseCase(
  deps: AttendanceDeps,
  input: unknown,
  admin: Admin,
): Promise<PasteResult> {
  const data = pasteShiftsSchema.parse(input);
  await assertStaff(deps, data.items.map((i) => i.userId));
  const dates = [...new Set(data.targetDates)].sort();
  const existing = await deps.workShifts.listBetween(dates[0], dates.at(-1)!);
  const plan = planPaste(data.items, dates, existing, data.overwrite);
  await deps.workShifts.upsertMany([...plan.toCreate, ...plan.toReplace], admin.id);
  const result = {
    created: plan.toCreate.length,
    replaced: plan.toReplace.length,
    skipped: plan.skipped.length,
  };
  await deps.audit.record({
    type: "work_shifts_pasted",
    actorId: admin.id,
    payload: {
      items: data.items.map((i) => ({ userId: i.userId, startTime: i.startTime, endTime: i.endTime })),
      targetDates: dates,
      overwrite: data.overwrite,
      ...result,
    },
    occurredAt: nowOf(deps),
  });
  return result;
}

// The weekly template laid on a range of dates (fills weeks in one click).
export async function applyTemplateUseCase(
  deps: AttendanceDeps,
  input: unknown,
  admin: Admin,
): Promise<PasteResult> {
  const data = applyTemplateSchema.parse(input);
  assertRange(data.from, data.to);
  const staff = await listShiftStaffUseCase(deps);
  const byId = new Map<number, AttendancePerson>(staff.map((p) => [p.id, p]));
  const wanted = data.userIds ? new Set(data.userIds) : null;
  const template = (await deps.schedules.listAll()).filter(
    (s) => byId.has(s.userId) && (!wanted || wanted.has(s.userId)),
  );
  const shifts = expandTemplate(template, data.from, data.to, (userId) => {
    const role = byId.get(userId)!.role;
    return DEFAULT_SHIFT_COLOR[role === "warehouse" ? "warehouse" : "cashier"];
  });
  if (shifts.length === 0) {
    throw new ValidationError("La plantilla semanal no tiene días para esas personas");
  }
  const result = await storeDated(deps, shifts, data, data.overwrite, admin);
  await deps.audit.record({
    type: "work_shift_template_applied",
    actorId: admin.id,
    payload: { from: data.from, to: data.to, userIds: data.userIds ?? null, overwrite: data.overwrite, ...result },
    occurredAt: nowOf(deps),
  });
  return result;
}

// The person's shifts around a date (what the device caches for offline
// clock-in, or what a correction needs).
export function shiftsAround(deps: AttendanceDeps, userId: number, dateKey: string, before: number, after: number) {
  return deps.workShifts.listBetween(addDays(dateKey, -before), addDays(dateKey, after), userId);
}
