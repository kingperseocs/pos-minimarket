import type { SalesGoal } from "../entities/sales-goal";

export interface SalesGoalRepository {
  // The latest goal set for the month, or else the latest of an earlier
  // month (a goal carries over until the owner changes it).
  findEffective(month: string): Promise<SalesGoal | null>;
  listRecent(limit: number): Promise<SalesGoal[]>;
  create(data: { month: string; amount: number }, actorId: number): Promise<SalesGoal>;
}
