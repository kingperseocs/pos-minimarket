import { desc, lte } from "drizzle-orm";
import type { SalesGoal } from "@/domain/entities/sales-goal";
import type { SalesGoalRepository } from "@/domain/repositories/sales-goal-repository";
import { db } from "@/infrastructure/db/client";
import { salesGoals } from "@/infrastructure/db/schema";

type GoalRow = typeof salesGoals.$inferSelect;

function toGoal(row: GoalRow): SalesGoal {
  return {
    id: row.id,
    month: row.month,
    amount: Number(row.amount),
    createdById: row.createdBy,
    createdAt: row.createdAt,
  };
}

export class DrizzleSalesGoalRepository implements SalesGoalRepository {
  async findEffective(month: string) {
    // YYYY-MM sorts as text, so "≤ month, newest first" is the month's own
    // goal or the one it inherits.
    const [row] = await db
      .select()
      .from(salesGoals)
      .where(lte(salesGoals.month, month))
      .orderBy(desc(salesGoals.month), desc(salesGoals.createdAt))
      .limit(1);
    return row ? toGoal(row) : null;
  }

  async listRecent(limit: number) {
    const rows = await db
      .select()
      .from(salesGoals)
      .orderBy(desc(salesGoals.createdAt))
      .limit(limit);
    return rows.map(toGoal);
  }

  async create(data: { month: string; amount: number }, actorId: number) {
    const [row] = await db
      .insert(salesGoals)
      .values({ month: data.month, amount: data.amount.toFixed(2), createdBy: actorId })
      .returning();
    return toGoal(row);
  }
}
