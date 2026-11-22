import { z } from "zod";
import {
  DEFAULT_EARLY_MIN,
  DEFAULT_TOLERANCE_MIN,
  SHIFT_COLORS,
} from "@/domain/entities/attendance";
import { MAX_PASTE_DATES } from "@/domain/services/work-shifts";
import { idSchema, idWithMessage } from "./id";

const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const hhmm = (message: string) => z.string().regex(TIME_PATTERN, message);

const reason = z
  .string()
  .trim()
  .min(5, "Escribe el motivo (ej. Se me olvidó marcar la salida)")
  .max(200);

// Free-text reason the person writes when asking to fix a forgotten mark.
export const MAX_CORRECTION_REASON_WORDS = 200;
// Generous character cap so a 200-word text always fits.
const MAX_CORRECTION_REASON_CHARS = 2000;
export const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

const correctionReason = z
  .string()
  .trim()
  .min(5, "Cuéntanos qué pasó (al menos unas palabras)")
  .max(MAX_CORRECTION_REASON_CHARS, "El motivo es demasiado largo")
  .refine(
    (text) => countWords(text) <= MAX_CORRECTION_REASON_WORDS,
    `Máximo ${MAX_CORRECTION_REASON_WORDS} palabras`,
  );

// A mark made on the device: when it was pressed and when it was sent, so
// the server can tell how wrong the device clock is.
const punch = {
  uuid: z.uuid(),
  // Who marked on the device: a queued mark is only sent with that person's
  // session (a shared tablet must not attribute it to the next cashier).
  userId: z.number().int().positive().optional(),
  deviceAt: z.iso.datetime(),
  sentAt: z.iso.datetime(),
  live: z.boolean(),
  clockMovedBack: z.boolean().default(false),
};

export const clockInSchema = z.object(punch);
export const clockOutSchema = z.object(punch);

// "Ayer no marcaste salida": asked by the person, approved by an admin.
export const requestCorrectionSchema = z.object({
  uuid: z.uuid(),
  userId: z.number().int().positive().optional(),
  attendanceUuid: z.uuid(),
  field: z.enum(["clock_in", "clock_out"]),
  newValue: z.iso.datetime({ offset: true }),
  reason: correctionReason,
});

export const reviewCorrectionSchema = z.object({
  id: idSchema,
  approve: z.boolean(),
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
});

// The admin fixes a mark directly (already approved, still audited).
export const adminCorrectSchema = z.object({
  attendanceId: idSchema,
  field: z.enum(["clock_in", "clock_out"]),
  newValue: z.iso.datetime({ offset: true }),
  reason,
});

// The admin adds a workday the person couldn't mark (e.g. the tablet broke).
export const addAttendanceSchema = z.object({
  userId: idWithMessage("Elige a la persona"),
  workDate: z.string().regex(DATE_PATTERN, "Elige la fecha"),
  clockIn: hhmm("Escribe la hora de entrada"),
  clockOut: z.preprocess(blankToNull, hhmm("La hora de salida no es válida").nullable()),
  reason,
});

export const scheduleDaySchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: hhmm("Escribe la hora de entrada"),
    endTime: hhmm("Escribe la hora de salida"),
    toleranceMin: z.coerce
      .number("Escribe la tolerancia")
      .int()
      .min(0, "La tolerancia no puede ser negativa")
      .max(120, "La tolerancia máxima es 120 minutos"),
    // "Marcar entrada" opens this many minutes before the entrance.
    earlyMin: z.coerce
      .number("Escribe desde cuántos minutos antes se puede marcar")
      .int()
      .min(0, "Los minutos antes no pueden ser negativos")
      .max(120, "Máximo 120 minutos antes")
      .default(DEFAULT_EARLY_MIN),
  })
  .refine((day) => day.startTime !== day.endTime, {
    message: "La entrada y la salida no pueden ser a la misma hora",
  });

export const saveScheduleSchema = z.object({
  userId: idSchema,
  days: z
    .array(scheduleDaySchema)
    .max(7)
    .refine((days) => new Set(days.map((d) => d.weekday)).size === days.length, {
      message: "Hay un día repetido",
    }),
});

// ---- Calendar (work shifts) ----

const dateKey = (message: string) => z.string().regex(DATE_PATTERN, message);

const toleranceMin = z.coerce
  .number("Escribe la tolerancia")
  .int()
  .min(0, "La tolerancia no puede ser negativa")
  .max(120, "La tolerancia máxima es 120 minutos")
  .default(DEFAULT_TOLERANCE_MIN);

const earlyMin = z.coerce
  .number("Escribe desde cuántos minutos antes se puede marcar")
  .int()
  .min(0, "Los minutos antes no pueden ser negativos")
  .max(120, "Máximo 120 minutos antes")
  .default(DEFAULT_EARLY_MIN);

// A shift without its date (what is copied and pasted).
export const shiftPatternSchema = z
  .object({
    userId: idWithMessage("Elige al trabajador"),
    startTime: hhmm("Escribe la hora de entrada"),
    endTime: hhmm("Escribe la hora de salida"),
    toleranceMin,
    earlyMin,
    color: z.enum(SHIFT_COLORS, "Elige un color"),
    note: z.preprocess(blankToNull, z.string().trim().max(120).nullable()).default(null),
  })
  .refine((s) => s.startTime !== s.endTime, {
    message: "La entrada y la salida no pueden ser a la misma hora",
  });

export const createShiftSchema = z.intersection(
  shiftPatternSchema,
  z.object({ workDate: dateKey("Elige la fecha") }),
);

// Edit, move (drag to another day/hour) or resize.
export const updateShiftSchema = z.intersection(
  shiftPatternSchema,
  z.object({ id: idSchema, workDate: dateKey("Elige la fecha") }),
);

export const shiftRangeSchema = z
  .object({ from: dateKey("Fecha inicial inválida"), to: dateKey("Fecha final inválida") })
  .refine((r) => r.from <= r.to, { message: "El rango de fechas está invertido" });

// Copied shift(s) pasted on one or more dates.
export const pasteShiftsSchema = z.object({
  items: z.array(shiftPatternSchema).min(1, "No hay nada copiado").max(100),
  targetDates: z
    .array(dateKey("Fecha inválida"))
    .min(1, "Elige al menos un día")
    .max(MAX_PASTE_DATES, `Máximo ${MAX_PASTE_DATES} días por vez`),
  overwrite: z.boolean().default(false),
});

// The weekly template laid on a range of dates.
export const applyTemplateSchema = z
  .object({
    from: dateKey("Elige la fecha inicial"),
    to: dateKey("Elige la fecha final"),
    userIds: z.array(idSchema).optional(),
    overwrite: z.boolean().default(false),
  })
  .refine((r) => r.from <= r.to, { message: "El rango de fechas está invertido" });
