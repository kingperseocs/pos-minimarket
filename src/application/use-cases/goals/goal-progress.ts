import type { CashierGoalProgress, GoalProgress } from "@/domain/entities/sales-goal";
import type { SalesAnalyticsRepository } from "@/domain/repositories/sales-analytics-repository";
import type { SalesGoalRepository } from "@/domain/repositories/sales-goal-repository";
import { computeGoalProgress, storeMonthKey } from "@/domain/services/goal-progress";
import { storeMonthStart } from "@/domain/value-objects/store-time";

export interface GoalProgressDeps {
  goals: Pick<SalesGoalRepository, "findEffective">;
  analytics: Pick<SalesAnalyticsRepository, "totals">;
}

// Month-to-date sales (voided ones excluded) against the month's goal.
export async function getGoalProgressUseCase(
  deps: GoalProgressDeps,
  now: Date = new Date(),
): Promise<GoalProgress> {
  const month = storeMonthKey(now);
  const [goal, totals] = await Promise.all([
    deps.goals.findEffective(month),
    deps.analytics.totals(storeMonthStart(now), now),
  ]);
  return computeGoalProgress({
    goal: goal?.amount ?? null,
    inherited: goal ? goal.month !== month : false,
    revenue: totals.revenue,
    now,
  });
}

// The till only gets the percentage: no amounts of the store's sales.
export async function getCashierGoalProgressUseCase(
  deps: GoalProgressDeps,
  now: Date = new Date(),
): Promise<CashierGoalProgress> {
  const progress = await getGoalProgressUseCase(deps, now);
  return {
    month: progress.month,
    percent: progress.percent,
    mood: progress.mood,
    hasGoal: progress.goal !== null,
  };
}
