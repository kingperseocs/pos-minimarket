"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { drainOutbox, type IssueOutcome } from "@/application/use-cases/e-invoicing/issue-sale-document";
import {
  approveReviewedDocument,
  canApprove,
  canReissue,
  refreshDocumentStatus,
  reissueRejectedDocument,
  retryDocument,
} from "@/application/use-cases/e-invoicing/manage-document";
import {
  type Actor,
  canActOn,
  canVoid,
  issueCreditNote,
  issueDebitNote,
  refreshDocumentNotes,
  voidDocument,
} from "@/application/use-cases/e-invoicing/notes";
import { idSchema } from "@/application/validation/id";
import { can } from "@/domain/entities/user";
import { ValidationError } from "@/domain/errors";
import { requirePermission } from "@/infrastructure/auth/guards";
import { eInvoicingDeps, eInvoicingNotesDeps } from "@/infrastructure/deps";
import { runDataAction } from "./action-result";

const requireAdmin = () => requirePermission("manage");

// Cashier or admin: a cashier only acts on the sales they charged (checked
// in each use case with the actor).
async function requireActor(): Promise<Actor> {
  const user = await requirePermission("sell");
  return { id: user.id, isAdmin: can(user.role, "manage") };
}

async function ownedDocument(id: number, actor: Actor) {
  const doc = await eInvoicingNotesDeps.documents.findById(idSchema.parse(id));
  if (!doc || !canActOn(doc, actor)) throw new ValidationError("El comprobante no existe.");
  return doc;
}

function revalidateDocuments() {
  revalidatePath("/admin/comprobantes", "layout");
  revalidatePath("/pos/comprobantes");
}

const customerSchema = z
  .object({
    docType: z.enum(["1", "6"]),
    number: z.string().trim().max(15),
    name: z.string().trim().max(200),
    address: z.string().trim().max(300).nullable().optional(),
  })
  .nullable();

export async function refreshDocument(id: number) {
  return runDataAction(async () => {
    const actor = await requireActor();
    await ownedDocument(id, actor);
    const doc = await refreshDocumentStatus(eInvoicingDeps, idSchema.parse(id));
    await refreshDocumentNotes(eInvoicingNotesDeps, doc.id);
    revalidateDocuments();
    return doc.motorStatus;
  });
}

export async function retryDocumentNow(id: number) {
  return runDataAction<IssueOutcome>(async () => {
    await requireAdmin();
    const outcome = await retryDocument(eInvoicingDeps, idSchema.parse(id));
    revalidateDocuments();
    return outcome;
  });
}

export async function approveDocument(id: number, customer: unknown) {
  return runDataAction<IssueOutcome>(async () => {
    await requireAdmin();
    const outcome = await approveReviewedDocument(eInvoicingDeps, idSchema.parse(id), customerSchema.parse(customer));
    revalidateDocuments();
    return outcome;
  });
}

export async function reissueDocument(id: number) {
  return runDataAction<IssueOutcome>(async () => {
    await requireAdmin();
    const outcome = await reissueRejectedDocument(eInvoicingDeps, idSchema.parse(id));
    revalidateDocuments();
    return outcome;
  });
}

export async function retryPendingDocuments() {
  return runDataAction(async () => {
    await requireAdmin();
    const counts = await drainOutbox(eInvoicingDeps, 10);
    revalidateDocuments();
    return counts;
  });
}

export async function voidDocumentNow(id: number, reason: string) {
  return runDataAction(async () => {
    const actor = await requireActor();
    const batch = await voidDocument(eInvoicingNotesDeps, idSchema.parse(id), z.string().parse(reason), actor);
    revalidateDocuments();
    return batch.status;
  });
}

const noteSchema = z.object({ reasonCode: z.string(), detail: z.string() });

export async function creditNoteFor(id: number, input: unknown) {
  return runDataAction(async () => {
    const actor = await requireActor();
    const note = await issueCreditNote(eInvoicingNotesDeps, idSchema.parse(id), noteSchema.parse(input), actor);
    revalidateDocuments();
    return `${note.number} · ${note.status}`;
  });
}

export async function debitNoteFor(id: number, input: unknown) {
  return runDataAction(async () => {
    const actor = await requireActor();
    const parsed = noteSchema.extend({ amount: z.coerce.number() }).parse(input);
    const note = await issueDebitNote(eInvoicingNotesDeps, idSchema.parse(id), parsed, actor);
    revalidateDocuments();
    return `${note.number} · ${note.status}`;
  });
}

export interface DocumentDetail {
  id: number;
  docType: "boleta" | "factura";
  number: string | null;
  status: string;
  motorStatus: string | null;
  sunatDescription: string | null;
  customerDocType: string;
  customerDocNumber: string | null;
  customerName: string | null;
  saleTotal: number;
  soldAt: string;
  cashierName: string | null;
  hasMotorDocument: boolean;
  // SUNAT holds it as valid: annul and notes are possible.
  valid: boolean;
  // Annulled, or cancelled by a credit note: shown with the ANULADO stamp.
  cancelled: boolean;
  // An annulment was sent and SUNAT has not confirmed it yet.
  voidPending: boolean;
  canVoid: boolean;
  // Admin only: what can be done about a document that is not issued well.
  admin: {
    canRetry: boolean;
    canApprove: boolean;
    canReissue: boolean;
    reviewReasons: string[];
    lastError: string | null;
    customerAddress: string | null;
  } | null;
  notes: { id: number; kind: string; number: string | null; reasonText: string; motorStatus: string | null }[];
}

// What the document modal shows (the cashier's own sales, or any for the
// admin).
export async function getDocumentDetail(id: number) {
  return runDataAction<DocumentDetail>(async () => {
    const actor = await requireActor();
    const doc = await ownedDocument(id, actor);
    const notes = await eInvoicingNotesDeps.notes.listByDocument(doc.id);
    const cancelled = doc.status === "voided" || doc.motorStatus === "ANULADO" || doc.cancelledByNote;
    const voidPending = !cancelled && notes.some((n) => n.kind === "void" && n.motorStatus !== "RECHAZADO");
    const valid =
      !cancelled && doc.status === "issued" && (doc.motorStatus === "ACEPTADO" || doc.motorStatus === "OBSERVADO");
    return {
      id: doc.id,
      docType: doc.docType,
      number: doc.number,
      status: doc.status,
      motorStatus: doc.motorStatus,
      sunatDescription: doc.sunatDescription,
      customerDocType: doc.customerDocType,
      customerDocNumber: doc.customerDocNumber,
      customerName: doc.customerName,
      saleTotal: doc.saleTotal,
      soldAt: doc.soldAt.toISOString(),
      cashierName: doc.cashierName,
      hasMotorDocument: doc.motorId !== null,
      valid,
      cancelled,
      voidPending,
      canVoid: valid && !voidPending && canVoid(doc, new Date()),
      admin: actor.isAdmin
        ? {
            canRetry: doc.status === "failed" || doc.status === "queued",
            canApprove: canApprove(doc),
            canReissue: canReissue(doc),
            reviewReasons: doc.reviewReasons,
            lastError: doc.lastError,
            customerAddress: doc.customerAddress,
          }
        : null,
      notes: notes.map((n) => ({
        id: n.id,
        kind: n.kind,
        number: n.number,
        reasonText: n.reasonText,
        motorStatus: n.motorStatus,
      })),
    };
  });
}
