import { MotorRejectedError, MotorUnavailableError } from "@/domain/errors";
import type { EInvoicingGateway } from "@/domain/repositories/e-invoicing-gateway";
import type { SaleDocumentRepository } from "@/domain/repositories/sale-document-repository";
import { buildIssueRequest } from "@/domain/services/e-invoice";

export interface IssueDeps {
  documents: SaleDocumentRepository;
  gateway: EInvoicingGateway;
  now?: () => Date;
}

// A worker holds a document this long (longer than the motor's 20 s issue
// timeout); if it dies, another can take it afterwards.
export const ISSUE_LOCK_MS = 60_000;
// After this many failed attempts the document stops retrying on its own;
// the admin sees it under "Con error" and retries it by hand.
export const MAX_ISSUE_ATTEMPTS = 12;
// Wait after the n-th failed attempt: 1, 5, 15 minutes, then every hour.
const RETRY_MINUTES = [1, 5, 15, 60];

export function retryDelayMs(attempts: number): number {
  const minutes = RETRY_MINUTES[Math.min(Math.max(attempts, 1), RETRY_MINUTES.length) - 1];
  return minutes * 60_000;
}

export type IssueOutcome = "issued" | "retry" | "rejected" | "skipped";

// Sends one sale's document to the motor, at most once at a time. The
// Idempotency-Key (the sale uuid) makes a repeated send return the same
// document instead of a second one.
export async function issueSaleDocument(deps: IssueDeps, saleUuid: string): Promise<IssueOutcome> {
  const context = await deps.documents.claim(saleUuid, ISSUE_LOCK_MS, MAX_ISSUE_ATTEMPTS);
  if (!context) return "skipped";
  const { document } = context;

  const request = buildIssueRequest({
    document,
    items: context.items,
    affectations: context.affectations,
    globalOverride: context.globalOverride,
    cashierName: context.cashierName,
  });

  try {
    const issued = await deps.gateway.issue(document.docType, request, document.idempotencyKey);
    await deps.documents.markIssued(document.id, issued);
    return "issued";
  } catch (error) {
    if (error instanceof MotorRejectedError) {
      const details = error.details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message));
      await deps.documents.markRejected(document.id, [error.message, ...details].join(" · "));
      return "rejected";
    }
    const message =
      error instanceof MotorUnavailableError || error instanceof Error ? error.message : String(error);
    const now = (deps.now ?? (() => new Date()))();
    const attempts = document.attempts + 1;
    await deps.documents.markRetry(document.id, message, new Date(now.getTime() + retryDelayMs(attempts)));
    return "retry";
  }
}

// Sends the documents whose turn has come, one by one. Called after each
// sync from any open till, so the queue keeps moving without a cron.
export async function drainOutbox(
  deps: IssueDeps,
  limit = 3,
): Promise<Record<IssueOutcome, number>> {
  const counts: Record<IssueOutcome, number> = { issued: 0, retry: 0, rejected: 0, skipped: 0 };
  const due = await deps.documents.dueForIssue(limit, MAX_ISSUE_ATTEMPTS);
  for (const saleUuid of due) {
    counts[await issueSaleDocument(deps, saleUuid)]++;
  }
  return counts;
}
