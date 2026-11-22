import type { MotorIssueRequest } from "../services/e-invoice";
import type { SaleDocumentType } from "../entities/sale-document";

// A document as the motor reports it. estado is SUNAT's verdict:
// PENDIENTE | ACEPTADO | OBSERVADO | RECHAZADO | EXCEPCION | ANULADO.
export interface MotorDocument {
  id: string;
  number: string;
  status: string;
  sunatCode: number | null;
  sunatDescription: string | null;
}

// A batch (RA / RC) the motor sends to annul documents.
export interface MotorBatch {
  id: string;
  identifier: string;
  status: string;
}

export type MotorFileKind = "pdf" | "xml" | "cdr";
export type MotorPdfFormat = "ticket" | "a4" | "a5";

// A file streamed from the motor, to pass on to the browser untouched.
export interface MotorFile {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentDisposition: string | null;
}

export interface MotorNoteRequest {
  serie: string;
  documento_afectado_id: string;
  motivo: string;
  sustento?: string;
  cajero?: string;
  items?: MotorIssueRequest["items"];
}

// Port to the billing engine. Implemented over HTTP in
// infrastructure/e-invoicing/motor-client.ts; its credentials never leave
// the server. Throws MotorUnavailableError (retry later) or
// MotorRejectedError (fix the data).
export interface EInvoicingGateway {
  // idempotencyKey makes a retry return the same document instead of a new one.
  issue(type: SaleDocumentType, request: MotorIssueRequest, idempotencyKey: string): Promise<MotorDocument>;
  get(motorId: string): Promise<MotorDocument>;
  file(motorId: string, kind: MotorFileKind, format?: MotorPdfFormat): Promise<MotorFile>;
  void(motorId: string, reason: string): Promise<MotorBatch>;
  creditNote(request: MotorNoteRequest, idempotencyKey: string): Promise<MotorDocument>;
  debitNote(request: MotorNoteRequest, idempotencyKey: string): Promise<MotorDocument>;
  dailyReport(date: string): Promise<unknown>;
}
