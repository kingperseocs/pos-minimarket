import type { WorkShift } from "../entities/attendance";
import type { DatedShift } from "../services/work-shifts";

export interface WorkShiftRepository {
  // Shifts whose workDate is in [from, to] (inclusive), by date.
  listBetween(from: string, to: string, userId?: number): Promise<WorkShift[]>;
  findById(id: number): Promise<WorkShift | null>;
  // Inserts the new ones and replaces (same person and date) the others, in
  // one transaction.
  upsertMany(shifts: DatedShift[], actorId: number): Promise<void>;
  update(id: number, shift: DatedShift, actorId: number): Promise<WorkShift>;
  delete(id: number): Promise<void>;
}
