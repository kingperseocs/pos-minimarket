import type { ReviewReason, SaleDocumentStatus, SaleDocumentType } from "@/domain/entities/sale-document";

// What a document card shows. Plain data and a plain function (no
// "use client"): server pages build the rows, the client list renders them.
export interface DocumentCardRow {
  id: number;
  docType: SaleDocumentType;
  number: string | null;
  status: SaleDocumentStatus;
  motorStatus: string | null;
  customerName: string | null;
  customerDocNumber: string | null;
  total: number;
  soldAt: string;
  lastError: string | null;
  reviewReasons: ReviewReason[];
  cashierName: string | null;
  // Annulled, or cancelled by a credit note: it no longer counts for SUNAT.
  cancelled: boolean;
}

// Server rows → card rows (the same for the till and the admin).
export function toCardRow(d: {
  id: number;
  docType: SaleDocumentType;
  number: string | null;
  status: SaleDocumentStatus;
  motorStatus: string | null;
  customerName: string | null;
  customerDocNumber: string | null;
  saleTotal: number;
  soldAt: Date;
  lastError: string | null;
  reviewReasons: ReviewReason[];
  cashierName: string | null;
  cancelledByNote: boolean;
}): DocumentCardRow {
  return {
    id: d.id,
    docType: d.docType,
    number: d.number,
    status: d.status,
    motorStatus: d.motorStatus,
    customerName: d.customerName,
    customerDocNumber: d.customerDocNumber,
    total: d.saleTotal,
    soldAt: d.soldAt.toISOString(),
    lastError: d.lastError,
    reviewReasons: d.reviewReasons,
    cashierName: d.cashierName,
    cancelled: d.status === "voided" || d.motorStatus === "ANULADO" || d.cancelledByNote,
  };
}
