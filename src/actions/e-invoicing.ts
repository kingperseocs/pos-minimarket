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
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { eInvoicingDeps } from "@/infrastructure/deps";
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
