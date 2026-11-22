import type { SaleItemInput } from "../entities/sale";
import type {
  CustomerDocType,
  IgvAffectation,
  SaleDocument,
  SaleDocumentFilters,
  SaleDocumentListItem,
} from "../entities/sale-document";
import type { MotorDocument } from "./e-invoicing-gateway";

// Everything needed to send one document to the motor, read when it is
// claimed: the sale lines, each product's IGV affectation, the global
// override and who charged it.
export interface IssueContext {
  document: SaleDocument;
  items: SaleItemInput[];
  affectations: Map<number, IgvAffectation>;
  globalOverride: IgvAffectation | null;
  cashierName: string | null;
}

export interface RequeuePatch {
  customer?: {
    customerDocType: CustomerDocType;
    customerDocNumber: string | null;
    customerName: string | null;
    customerAddress: string | null;
  };
  clearReview?: boolean;
  idempotencyKey?: string;
  resetMotor?: boolean;
}

export interface SaleDocumentRepository {
  // Locks the document for `lockMs` and marks it "sending", only if it is
  // due (queued or failed, its turn has come, below the attempt limit, not
  // locked by another worker, and automatic emission is on). null when it
  // is not: another till is sending it, it is in review, already issued…
  claim(saleUuid: string, lockMs: number, maxAttempts: number): Promise<IssueContext | null>;
  // Sale uuids of the documents whose turn has come, oldest first.
  dueForIssue(limit: number, maxAttempts: number): Promise<string[]>;
  markIssued(id: number, doc: MotorDocument): Promise<void>;
  // The motor was unreachable: try again at nextAttemptAt.
  markRetry(id: number, error: string, nextAttemptAt: Date): Promise<void>;
  // The motor refused it: no automatic retry until someone fixes it.
  markRejected(id: number, error: string): Promise<void>;
  findBySaleUuid(saleUuid: string): Promise<SaleDocument | null>;
  findById(id: number): Promise<SaleDocumentListItem | null>;
  // SUNAT's latest verdict, as the motor reports it.
  updateMotorStatus(id: number, doc: MotorDocument): Promise<void>;
  // Back to the queue, due now. Optionally with corrected customer data
  // (clearing the review), a new idempotency key, or forgetting the motor
  // document (after SUNAT rejected it).
  requeue(id: number, patch: RequeuePatch): Promise<void>;
  // Documents of the sales charged in [from, to], newest first.
  list(filters: SaleDocumentFilters): Promise<SaleDocumentListItem[]>;
}
