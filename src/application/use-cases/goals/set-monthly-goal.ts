import { ValidationError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { SalesGoalRepository } from "@/domain/repositories/sales-goal-repository";
import { storeMonthKey } from "@/domain/services/goal-progress";
import { salesGoalSchema } from "@/application/validation/sales-goal";

export interface SetMonthlyGoalDeps {
  goals: Pick<SalesGoalRepository, "findEffective" | "create">;
  audit: Pick<AuditRepository, "record">;
}

// A new goal never edits the previous one: it adds a version, and the change
// is logged. Past months are closed: their goal is part of the history.
export async function setMonthlyGoalUseCase(
  deps: SetMonthlyGoalDeps,
  input: unknown,
  actorId: number,
  now: Date = new Date(),
) {
  const data = salesGoalSchema.parse(input);
  if (data.month < storeMonthKey(now)) {
    throw new ValidationError("No se puede cambiar la meta de un mes que ya pasó");
  }

  const previous = await deps.goals.findEffective(data.month);
  const created = await deps.goals.create(data, actorId);

  await deps.audit.record({
    type: "goal_changed",
    actorId,
    payload: {
      month: data.month,
      from: previous ? { month: previous.month, amount: previous.amount } : null,
      to: data.amount,
      goalId: created.id,
    },
    occurredAt: now,
  });

  return created;
}
