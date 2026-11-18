import { InvalidWorkerCredentialsError, TooManyAttemptsError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { DiscountPolicyRepository } from "@/domain/repositories/discount-policy-repository";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { workerStatementSchema } from "@/application/validation/worker";

export const STATEMENT_MAX_FAILURES = 5;
export const STATEMENT_LOCK_MINUTES = 15;

// Public "Mis puntos" page: the worker checks their balance and purchases.
// This turns every worker into an auditor — a purchase they didn't make is a
// red flag they can report. They prove who they are with DNI + birth date;
// wrong attempts lock the DNI for a while, and errors never reveal whether a
// DNI is registered.
export async function getWorkerStatementUseCase(
  deps: {
    workers: WorkerRepository;
    audit: AuditRepository;
    policies: DiscountPolicyRepository;
  },
  input: unknown,
) {
  const data = workerStatementSchema.parse(input);
  const genericError = new InvalidWorkerCredentialsError();

  const worker = await deps.workers.findByDni(data.dni);
  if (!worker || worker.status === "rejected") throw genericError;

  const now = new Date();
  const since = new Date(now.getTime() - STATEMENT_LOCK_MINUTES * 60_000);
  if (
    (await deps.audit.countStatementFailuresSince(worker.id, since)) >=
    STATEMENT_MAX_FAILURES
  ) {
    throw new TooManyAttemptsError(STATEMENT_LOCK_MINUTES);
  }

  if (worker.birthDate === null || worker.birthDate !== data.birthDate) {
    await deps.audit.record({
      type: "worker_statement_failed",
      actorId: null,
      workerId: worker.id,
      payload: { channel: "mis-puntos" },
      occurredAt: now,
    });
    throw genericError;
  }

  const [policy, history] = await Promise.all([
    deps.policies.getActive(),
    deps.workers.purchaseHistory(worker.id, 20),
  ]);

  return {
    fullName: worker.fullName,
    company: worker.company,
    status: worker.status,
    // Negative only after an overdraft (two tills redeeming offline);
    // shown as 0, it recovers with the next purchases.
    pointsBalance: Math.max(0, worker.pointsBalance),
    // How points are earned and redeemed (the "i" next to the balance).
    pointsRules: policy && {
      pointsPerSol: policy.pointsPerSol,
      redeemPointsPerSol: policy.redeemPointsPerSol,
      minRedeemPoints: policy.minRedeemPoints,
    },
    purchases: history.map((p) => ({
      saleId: p.saleId,
      clientCreatedAt: p.clientCreatedAt.toISOString(),
      subtotal: p.subtotal,
      discountTotal: p.discountTotal,
      giftTotal: p.giftTotal,
      total: p.total,
      pointsEarned: p.pointsEarned,
      pointsRedeemed: p.pointsRedeemed,
      redeemTotal: p.redeemTotal,
    })),
  };
}

export type WorkerStatement = Awaited<ReturnType<typeof getWorkerStatementUseCase>>;
