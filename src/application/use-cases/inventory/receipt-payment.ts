import { z } from "zod";
import { SUPPLIER_PAYMENT_METHODS } from "@/domain/entities/receiving";
import { ValidationError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { ReceivingRepository } from "@/domain/repositories/receiving-repository";
import { idSchema } from "@/application/validation/id";

const markPaidSchema = z.object({
  receiptId: idSchema,
  method: z.enum(SUPPLIER_PAYMENT_METHODS, "Elige cómo se pagó"),
  note: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .transform((value) => value || null)
    .nullable()
    .default(null),
});

type Deps = { receiving: ReceivingRepository; audit: AuditRepository };

// The supplier's invoice was paid (after reviewing it on arrival). Recorded
// in the audit trail: who marked it, how and how much.
export async function markReceiptPaidUseCase(
  deps: Deps,
  input: unknown,
  actorId: number,
  now = new Date(),
) {
  const data = markPaidSchema.parse(input);
  const receipt = await deps.receiving.findReceiptPayment(data.receiptId);
  if (!receipt) throw new ValidationError("El ingreso no existe");
  if (receipt.invoiceStatus === "pending") {
    throw new ValidationError(
      `Registra primero la factura del ingreso #${receipt.id}: aún no se sabe cuánto pagar`,
    );
  }
  if (receipt.paymentStatus === "paid") {
    throw new ValidationError(`El ingreso #${receipt.id} ya figura como pagado`);
  }

  await deps.receiving.setReceiptPayment({
    id: receipt.id,
    paid: true,
    method: data.method,
    note: data.note,
    actorId,
    at: now,
  });
  await deps.audit.record({
    type: "receipt_paid",
    actorId,
    payload: {
      receiptId: receipt.id,
      docNumber: receipt.docNumber,
      total: receipt.total,
      method: data.method,
      note: data.note,
    },
    occurredAt: now,
  });
}

// Undo a payment marked by mistake. It is not erased: the trail keeps both.
export async function markReceiptUnpaidUseCase(
  deps: Deps,
  receiptId: unknown,
  actorId: number,
  now = new Date(),
) {
  const id = idSchema.parse(receiptId);
  const receipt = await deps.receiving.findReceiptPayment(id);
  if (!receipt) throw new ValidationError("El ingreso no existe");
  if (receipt.paymentStatus === "pending") {
    throw new ValidationError(`El ingreso #${receipt.id} ya figura como por pagar`);
  }

  await deps.receiving.setReceiptPayment({ id, paid: false });
  await deps.audit.record({
    type: "receipt_unpaid",
    actorId,
    payload: {
      receiptId: receipt.id,
      docNumber: receipt.docNumber,
      total: receipt.total,
      previousMethod: receipt.paidMethod,
    },
    occurredAt: now,
  });
}
