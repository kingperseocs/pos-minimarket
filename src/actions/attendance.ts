"use server";

import { revalidatePath } from "next/cache";
import {
  addAttendanceUseCase,
  adminCorrectUseCase,
  reviewCorrectionUseCase,
} from "@/application/use-cases/attendance/corrections";
import { saveScheduleUseCase } from "@/application/use-cases/attendance/schedules";
import {
  applyTemplateUseCase,
  createShiftUseCase,
  deleteShiftUseCase,
  listShiftsUseCase,
  pasteShiftsUseCase,
  updateShiftUseCase,
} from "@/application/use-cases/attendance/work-shifts";
import { requirePermission } from "@/infrastructure/auth/guards";
import { attendanceDeps } from "@/infrastructure/deps";
import { runAction, runDataAction } from "./action-result";

export async function saveSchedule(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await saveScheduleUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin/asistencia", "layout");
  });
}

export async function reviewCorrection(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await reviewCorrectionUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin", "layout");
  });
}

export async function correctAttendance(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await adminCorrectUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin", "layout");
  });
}

export async function addAttendance(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await addAttendanceUseCase(attendanceDeps, input, admin);
    revalidatePath("/admin", "layout");
  });
}

// ---- Calendar (work shifts) ----

const revalidateAttendance = () => revalidatePath("/admin/asistencia", "layout");

export async function listShifts(range: unknown) {
  return runDataAction(async () => {
    await requirePermission("manage");
    return listShiftsUseCase(attendanceDeps, range);
  });
}

export async function createShift(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await createShiftUseCase(attendanceDeps, input, admin);
    revalidateAttendance();
  });
}

export async function updateShift(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await updateShiftUseCase(attendanceDeps, input, admin);
    revalidateAttendance();
  });
}

export async function deleteShift(id: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await deleteShiftUseCase(attendanceDeps, id, admin);
    revalidateAttendance();
  });
}

export async function pasteShifts(input: unknown) {
  return runDataAction(async () => {
    const admin = await requirePermission("manage");
    const result = await pasteShiftsUseCase(attendanceDeps, input, admin);
    revalidateAttendance();
    return result;
  });
}

export async function applyShiftTemplate(input: unknown) {
  return runDataAction(async () => {
    const admin = await requirePermission("manage");
    const result = await applyTemplateUseCase(attendanceDeps, input, admin);
    revalidateAttendance();
    return result;
  });
}
