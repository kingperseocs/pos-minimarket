import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditEventInput } from "@/domain/entities/audit";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type {
  ReceiptPaymentUpdate,
  ReceivingRepository,
} from "@/domain/repositories/receiving-repository";
import { markReceiptPaidUseCase, markReceiptUnpaidUseCase } from "./receipt-payment";

function fakeDeps(status: "pending" | "paid", invoiceStatus: "pending" | "registered" = "registered") {
  const updates: ReceiptPaymentUpdate[] = [];
  const events: AuditEventInput[] = [];
  const receiving = {
    async findReceiptPayment(id: number) {
      return id === 12
        ? {
            id,
            total: 211.6,
            docNumber: "F001-123",
            invoiceStatus,
            paymentStatus: status,
            paidMethod: status === "paid" ? "yape" : null,
          }
        : null;
    },
    async setReceiptPayment(data: ReceiptPaymentUpdate) {
      updates.push(data);
    },
  } as unknown as ReceivingRepository;
  const audit = {
    async record(event: AuditEventInput) {
      events.push(event);
    },
  } as unknown as AuditRepository;
  return { deps: { receiving, audit }, updates, events };
}

const now = new Date("2026-11-16T15:00:00Z");

describe("markReceiptPaidUseCase", () => {
  it("refuses to pay a reception whose invoice isn't registered yet", async () => {
    const { deps, updates } = fakeDeps("pending", "pending");
    await assert.rejects(
      markReceiptPaidUseCase(deps, { receiptId: 12, method: "cash" }, 3, now),
      /Registra primero la factura/,
    );
    assert.equal(updates.length, 0);
  });

  it("marks the invoice paid and leaves it in the audit trail", async () => {
    const { deps, updates, events } = fakeDeps("pending");
    await markReceiptPaidUseCase(deps, { receiptId: 12, method: "yape", note: " Op. 55 " }, 3, now);
    assert.deepEqual(updates, [
      { id: 12, paid: true, method: "yape", note: "Op. 55", actorId: 3, at: now },
    ]);
    assert.equal(events[0].type, "receipt_paid");
    assert.equal(events[0].actorId, 3);
    assert.deepEqual(events[0].payload, {
      receiptId: 12,
      docNumber: "F001-123",
      total: 211.6,
      method: "yape",
      note: "Op. 55",
    });
  });

  it("asks how it was paid and refuses to pay twice", async () => {
    const pending = fakeDeps("pending");
    await assert.rejects(markReceiptPaidUseCase(pending.deps, { receiptId: 12 }, 3, now));
    const paid = fakeDeps("paid");
    await assert.rejects(
      markReceiptPaidUseCase(paid.deps, { receiptId: 12, method: "cash" }, 3, now),
      /ya figura como pagado/,
    );
    assert.equal(paid.updates.length, 0);
  });
});

describe("markReceiptUnpaidUseCase", () => {
  it("undoes the payment and audits it too", async () => {
    const { deps, updates, events } = fakeDeps("paid");
    await markReceiptUnpaidUseCase(deps, 12, 3, now);
    assert.deepEqual(updates, [{ id: 12, paid: false }]);
    assert.equal(events[0].type, "receipt_unpaid");
    assert.equal(events[0].payload?.previousMethod, "yape");
  });
});
