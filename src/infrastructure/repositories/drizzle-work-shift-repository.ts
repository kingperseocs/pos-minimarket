import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { SHIFT_COLORS, type ShiftColor, type WorkShift } from "@/domain/entities/attendance";
import { ValidationError } from "@/domain/errors";
import type { WorkShiftRepository } from "@/domain/repositories/work-shift-repository";
import type { DatedShift } from "@/domain/services/work-shifts";
import { db } from "@/infrastructure/db/client";
import { workShifts } from "@/infrastructure/db/schema";

// Postgres returns time columns as "07:00:00".
const hhmm = (value: string) => value.slice(0, 5);

const asColor = (value: string): ShiftColor =>
  (SHIFT_COLORS as readonly string[]).includes(value) ? (value as ShiftColor) : SHIFT_COLORS[2];

function toShift(row: typeof workShifts.$inferSelect): WorkShift {
  return {
    id: row.id,
    uuid: row.uuid,
    userId: row.userId,
    workDate: row.workDate,
    startTime: hhmm(row.startTime),
    endTime: hhmm(row.endTime),
    toleranceMin: row.toleranceMin,
    earlyMin: row.earlyMin,
    color: asColor(row.color),
    note: row.note,
  };
}

const values = (shift: DatedShift) => ({
  userId: shift.userId,
  workDate: shift.workDate,
  startTime: shift.startTime,
  endTime: shift.endTime,
  toleranceMin: shift.toleranceMin,
  earlyMin: shift.earlyMin,
  color: shift.color,
  note: shift.note,
});

// Postgres unique_violation: the person already has a shift that date.
function isDuplicate(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

export class DrizzleWorkShiftRepository implements WorkShiftRepository {
  async listBetween(from: string, to: string, userId?: number) {
    const rows = await db
      .select()
      .from(workShifts)
      .where(
        and(
          gte(workShifts.workDate, from),
          lte(workShifts.workDate, to),
          userId === undefined ? undefined : eq(workShifts.userId, userId),
        ),
      )
      .orderBy(asc(workShifts.workDate), asc(workShifts.startTime));
    return rows.map(toShift);
  }

  async findById(id: number) {
    const [row] = await db.select().from(workShifts).where(eq(workShifts.id, id));
    return row ? toShift(row) : null;
  }

  async upsertMany(shifts: DatedShift[], actorId: number) {
    if (shifts.length === 0) return;
    const now = new Date();
    await db
      .insert(workShifts)
      .values(
        shifts.map((s) => ({ ...values(s), createdBy: actorId, updatedBy: actorId, updatedAt: now })),
      )
      .onConflictDoUpdate({
        target: [workShifts.userId, workShifts.workDate],
        set: {
          startTime: sql`excluded.start_time`,
          endTime: sql`excluded.end_time`,
          toleranceMin: sql`excluded.tolerance_min`,
          earlyMin: sql`excluded.early_min`,
          color: sql`excluded.color`,
          note: sql`excluded.note`,
          updatedBy: actorId,
          updatedAt: now,
        },
      });
  }

  async update(id: number, shift: DatedShift, actorId: number) {
    try {
      const [row] = await db
        .update(workShifts)
        .set({ ...values(shift), updatedBy: actorId, updatedAt: new Date() })
        .where(eq(workShifts.id, id))
        .returning();
      if (!row) throw new ValidationError("El turno ya no existe");
      return toShift(row);
    } catch (error) {
      if (isDuplicate(error)) {
        throw new ValidationError("Esa persona ya tiene un turno ese día");
      }
      throw error;
    }
  }

  async delete(id: number) {
    await db.delete(workShifts).where(eq(workShifts.id, id));
  }
}
