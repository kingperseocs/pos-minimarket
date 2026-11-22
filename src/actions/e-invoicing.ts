"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { drainOutbox, type IssueOutcome } from "@/application/use-cases/e-invoicing/issue-sale-document";
import {
  approveReviewedDocument,
  refreshDocumentStatus,
  reissueRejectedDocument,
  retryDocument,
} from "@/application/use-cases/e-invoicing/manage-document";
import {
  issueCreditNote,
  issueDebitNote,
  refreshDocumentNotes,
  voidDocument,
} from "@/application/use-cases/e-invoicing/notes";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { eInvoicingDeps, eInvoicingNotesDeps } from "@/infrastructure/deps";
import { runDataAction } from "./action-result";

const requireAdmin = () => requirePermission("manage");

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
    await requireAdmin();
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
    const admin = await requireAdmin();
    const batch = await voidDocument(eInvoicingNotesDeps, idSchema.parse(id), z.string().parse(reason), admin.id);
    revalidateDocuments();
    return batch.status;
  });
}

const noteSchema = z.object({ reasonCode: z.string(), detail: z.string() });

export async function creditNoteFor(id: number, input: unknown) {
  return runDataAction(async () => {
    const admin = await requireAdmin();
    const note = await issueCreditNote(eInvoicingNotesDeps, idSchema.parse(id), noteSchema.parse(input), admin.id);
    revalidateDocuments();
    return `${note.number} · ${note.status}`;
  });
}

export async function debitNoteFor(id: number, input: unknown) {
  return runDataAction(async () => {
    const admin = await requireAdmin();
    const parsed = noteSchema.extend({ amount: z.coerce.number() }).parse(input);
    const note = await issueDebitNote(eInvoicingNotesDeps, idSchema.parse(id), parsed, admin.id);
    revalidateDocuments();
    return `${note.number} · ${note.status}`;
  });
}
