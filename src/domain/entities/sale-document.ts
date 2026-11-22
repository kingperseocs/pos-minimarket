// The electronic document (boleta / factura) issued for a sale through the
// billing engine ("motor"), which sends it to SUNAT.

export type SaleDocumentType = "boleta" | "factura";

export const SALE_DOCUMENT_TYPE_LABELS: Record<SaleDocumentType, string> = {
  boleta: "Boleta",
  factura: "Factura",
};

// POS-side lifecycle (see sale_documents.status). SUNAT's verdict is
// motorStatus: an "issued" document may still be PENDIENTE at SUNAT.
export type SaleDocumentStatus =
  | "queued"
  | "review"
  | "sending"
  | "issued"
  | "failed"
  | "voided";

export const SALE_DOCUMENT_STATUS_LABELS: Record<SaleDocumentStatus, string> = {
  queued: "Por emitir",
  review: "En revisión",
  sending: "Enviando",
  issued: "Emitido",
  failed: "Con error",
  voided: "Anulado",
};

// SUNAT catalog 06: 0 none ("clientes varios"), 1 DNI, 6 RUC.
export type CustomerDocType = "0" | "1" | "6";

export interface DocumentCustomer {
  docType: "1" | "6";
  number: string;
  name: string;
  address?: string | null;
}

// What the cashier chose at checkout. Without a customer, a boleta goes to
// "clientes varios" (only up to S/ 700).
export interface SaleDocumentRequest {
  type: SaleDocumentType;
  customer?: DocumentCustomer | null;
}

// Why a sale is not emitted automatically (decision of 2026-11-22: these
// wait for the accountant, D-19 to D-22, and for motor support).
export type ReviewReason =
  | "discount"
  | "gift"
  | "redeem"
  | "rounding"
  | "total_mismatch"
  | "invalid_customer";

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  discount: "Tiene descuento",
  gift: "Tiene regalo",
  redeem: "Canjeó puntos",
  rounding: "Tiene redondeo",
  total_mismatch: "El total no cuadra con los productos",
  invalid_customer: "Faltan o son inválidos los datos del cliente",
};

// The document a newly synced sale gets (inserted with the sale, in the same
// transaction). The series is taken from the settings at insert time.
export interface NewSaleDocument {
  docType: SaleDocumentType;
  customerDocType: CustomerDocType;
  customerDocNumber: string | null;
  customerName: string | null;
  customerAddress: string | null;
  status: "queued" | "review";
  reviewReasons: ReviewReason[];
  idempotencyKey: string;
}

// SUNAT catalog 07.
export type IgvAffectation = "10" | "20" | "30";

export const IGV_AFFECTATION_LABELS: Record<IgvAffectation, string> = {
  "10": "Gravado (IGV 18 %)",
  "20": "Exonerado",
  "30": "Inafecto",
};

export const IGV_AFFECTATIONS: IgvAffectation[] = ["10", "20", "30"];

export interface EInvoicingSettings {
  boletaSeries: string;
  facturaSeries: string;
  creditNoteBoletaSeries: string;
  creditNoteFacturaSeries: string;
  debitNoteBoletaSeries: string;
  debitNoteFacturaSeries: string;
  globalIgvOverride: IgvAffectation | null;
  autoEmitEnabled: boolean;
}

export interface SaleDocument {
  id: number;
  saleId: number;
  saleUuid: string;
  docType: SaleDocumentType;
  series: string;
  customerDocType: CustomerDocType;
  customerDocNumber: string | null;
  customerName: string | null;
  customerAddress: string | null;
  status: SaleDocumentStatus;
  reviewReasons: ReviewReason[];
  motorId: string | null;
  number: string | null;
  motorStatus: string | null;
  sunatCode: number | null;
  sunatDescription: string | null;
  idempotencyKey: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
  issuedAt: Date | null;
  createdAt: Date;
}

// A document in a list (cashier's "Comprobantes de hoy", admin's screen),
// with what the till charged.
export interface SaleDocumentListItem extends SaleDocument {
  saleTotal: number;
  soldAt: Date;
  cashierName: string | null;
}

export interface SaleDocumentFilters {
  from: Date;
  to: Date;
  cashierId?: number;
  status?: SaleDocumentStatus;
  docType?: SaleDocumentType;
}

// Notes and annulments issued on a sale's document.
export type SaleDocumentNoteKind = "credit_note" | "debit_note" | "void";

export const SALE_DOCUMENT_NOTE_KIND_LABELS: Record<SaleDocumentNoteKind, string> = {
  credit_note: "Nota de crédito",
  debit_note: "Nota de débito",
  void: "Anulación",
};

export interface SaleDocumentNote {
  id: number;
  saleDocumentId: number;
  kind: SaleDocumentNoteKind;
  motorId: string | null;
  number: string | null;
  reasonCode: string | null;
  reasonText: string;
  motorStatus: string | null;
  createdBy: number;
  createdByName: string | null;
  createdAt: Date;
}

// The credit-note reasons offered at the store (SUNAT catalog 09): the ones
// that cancel the whole sale, so no lines need to be picked. Partial returns
// (07) and discounts come later with the accountant's answer.
export const CREDIT_NOTE_REASONS: Record<string, string> = {
  "01": "Anulación de la operación",
  "02": "Anulación por error en el RUC",
  "06": "Devolución total",
};

// Debit-note reasons (SUNAT catalog 10).
export const DEBIT_NOTE_REASONS: Record<string, string> = {
  "01": "Intereses por mora",
  "02": "Aumento en el valor",
  "03": "Penalidades / otros conceptos",
};

// Annulment (baja / resumen diario) is only allowed this many days after
// issue (REGLAS-2026, error 2957; the motor enforces it too).
export const VOID_MAX_DAYS = 7;
