import type { DocumentCustomer, SaleDocumentListItem } from "@/domain/entities/sale-document";
import { ValidationError } from "@/domain/errors";
import { documentCustomerFields, documentRequestErrors } from "@/domain/services/e-invoice";
import { type IssueDeps, type IssueOutcome, issueSaleDocument } from "./issue-sale-document";

// Admin actions on one electronic document. Each one leaves it queued and
// tries to issue it right away; if the motor is down, the outbox retries.

async function load(deps: IssueDeps, id: number): Promise<SaleDocumentListItem> {
  const doc = await deps.documents.findById(id);
  if (!doc) throw new ValidationError("El comprobante no existe.");
  return doc;
}

// A document in review can be approved only when its sole problem was the
// customer data. Discounts, gifts, points and rounding wait for the
// accountant and for the motor to express them (D-19 to D-22): issuing them
// as they are would state a total the customer did not pay.
export function canApprove(doc: Pick<SaleDocumentListItem, "status" | "reviewReasons">): boolean {
  return (
    doc.status === "review" &&
    doc.reviewReasons.length > 0 &&
    doc.reviewReasons.every((reason) => reason === "invalid_customer")
  );
}

// SUNAT rejected the issued document: it does not exist for SUNAT, so a new
// one (new number, new idempotency key) can be issued for the same sale.
export function canReissue(doc: Pick<SaleDocumentListItem, "status" | "motorStatus">): boolean {
  return doc.status === "issued" && doc.motorStatus === "RECHAZADO";
}

// Asks the motor for SUNAT's current verdict (a PENDIENTE that got accepted,
// an annulment that went through…).
export async function refreshDocumentStatus(deps: IssueDeps, id: number): Promise<SaleDocumentListItem> {
  const doc = await load(deps, id);
  if (!doc.motorId) throw new ValidationError("El comprobante todavía no se emitió.");
  const current = await deps.gateway.get(doc.motorId);
  await deps.documents.updateMotorStatus(doc.id, current);
  return load(deps, id);
}

// A failed document (motor down too long, or refused and since fixed, e.g.
// a missing series) goes back to the queue now.
export async function retryDocument(deps: IssueDeps, id: number): Promise<IssueOutcome> {
  const doc = await load(deps, id);
  if (doc.status !== "failed" && doc.status !== "queued") {
    throw new ValidationError("Solo se reintentan los comprobantes por emitir o con error.");
  }
  await deps.documents.requeue(doc.id, {});
  return issueSaleDocument(deps, doc.saleUuid);
}

// The admin fixes the customer of a document that was in review for it.
export async function approveReviewedDocument(
  deps: IssueDeps,
  id: number,
  customer: DocumentCustomer | null,
): Promise<IssueOutcome> {
  const doc = await load(deps, id);
  if (!canApprove(doc)) {
    throw new ValidationError(
      "Este comprobante espera la respuesta del contador (descuentos, regalos, puntos o redondeo).",
    );
  }
  const request = { type: doc.docType, customer };
  const errors = documentRequestErrors(request, doc.saleTotal);
  if (errors.length > 0) throw new ValidationError(errors[0]);
  await deps.documents.requeue(doc.id, { customer: documentCustomerFields(request), clearReview: true });
  return issueSaleDocument(deps, doc.saleUuid);
}

// Issues a new document for a sale whose document SUNAT rejected. The key
// changes (uuid:r1, uuid:r2…) so the motor creates a new one instead of
// returning the rejected document.
export async function reissueRejectedDocument(deps: IssueDeps, id: number): Promise<IssueOutcome> {
  const doc = await load(deps, id);
  if (!canReissue(doc)) {
    throw new ValidationError("Solo se reemiten comprobantes rechazados por SUNAT.");
  }
  const previous = doc.idempotencyKey.match(/:r(\d+)$/);
  const next = previous ? Number(previous[1]) + 1 : 1;
  await deps.documents.requeue(doc.id, {
    idempotencyKey: `${doc.saleUuid}:r${next}`,
    resetMotor: true,
  });
  return issueSaleDocument(deps, doc.saleUuid);
}
