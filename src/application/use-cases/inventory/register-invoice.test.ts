import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditEventInput } from "@/domain/entities/audit";
import type { ReceiptForInvoice, ReceiptInvoice } from "@/domain/entities/receiving";
import { registerInvoiceUseCase } from "./register-invoice";

type Deps = Parameters<typeof registerInvoiceUseCase>[0];

// The Almacén counted 1 Caja x36 of Crackelet (item 10).
function reception(overrides: Partial<ReceiptForInvoice> = {}): ReceiptForInvoice {
  return {
    id: 7,
    supplierId: 2,
    supplierName: "Costa",
    // 16 Nov 2026, 10:00 in Lima.
    receivedAt: new Date("2026-11-16T15:00:00Z"),
    createdByName: "Almacenero",
    note: null,
    invoiceStatus: "pending",
    invoicePhotoUrl: null,
    lines: [
      {
        itemId: 10,
        productId: 1,
        productName: "Crackelet Original 47 g",
        presentationId: 1,
        presentationName: "Caja x36",
        supplierCode: "800436",
        unitsPerPresentation: 36,
        quantity: 1,
        receivedUnits: 36,
        expiresAt: null,
        priceSale: 1,
      },
    ],
    ...overrides,
  };
}

function fakeDeps({
  receipt = reception(),
  supplier = { givesCredit: false, creditDays: null as number | null },
  documentExists = false,
} = {}) {
  const applied: ReceiptInvoice[] = [];
  const events: AuditEventInput[] = [];
  const deps = {
    receiving: {
      async findReceiptForInvoice(id: number) {
        return id === receipt.id ? receipt : null;
      },
      async documentExists() {
        return documentExists;
      },
      async applyInvoice(data: ReceiptInvoice) {
        applied.push(data);
        return { gaps: data.lines.filter((l) => l.units !== l.receivedUnits).length };
      },
    },
    products: {
      async findById(id: number) {
        return { id, name: id === 3 ? "Doritos 21 g" : "Crackelet Original 47 g" };
      },
    },
    presentations: {
      async listAll() {
        return [
          { id: 1, productId: 1, unitsTotal: 36, isActive: true },
          { id: 9, productId: 3, unitsTotal: 144, isActive: true },
        ];
      },
    },
    suppliers: {
      async findById(id: number) {
        return { id, ...supplier };
      },
    },
    audit: {
      async record(event: AuditEventInput) {
        events.push(event);
      },
    },
  } as unknown as Deps;
  return { deps, applied, events };
}

const invoice = (lines: Record<string, unknown>[]) => ({
  receiptId: 7,
  docType: "factura",
  docNumber: "f016-5981",
  lines,
});
const crackelet = { itemId: 10, productId: 1, presentationId: 1, quantity: 1, lineTotal: "25.20" };
const now = new Date("2026-11-17T15:00:00Z");

describe("registerInvoiceUseCase", () => {
  it("costs what arrived from the invoice and leaves no gap when both match", async () => {
    const { deps, applied } = fakeDeps();
    const result = await registerInvoiceUseCase(deps, invoice([crackelet]), 1, now);
    const [line] = applied[0].lines;
    assert.equal(line.units, 36);
    assert.equal(line.receivedUnits, 36);
    assert.equal(line.lineTotal, 25.2);
    assert.equal(line.unitCost, 0.7);
    assert.equal(applied[0].docNumber, "F016-5981");
    assert.equal(applied[0].total, 25.2);
    assert.deepEqual(result, { id: 7, gaps: 0, total: 25.2 });
  });

  it("applies the supplier's discount to the line", async () => {
    const { deps, applied } = fakeDeps();
    await registerInvoiceUseCase(
      deps,
      invoice([{ ...crackelet, lineTotal: "30", discountPercent: "10" }]),
      1,
      now,
    );
    const [line] = applied[0].lines;
    assert.equal(line.listTotal, 30);
    assert.equal(line.lineTotal, 27);
    assert.equal(line.unitCost, 0.75);
  });

  it("records invoiced units that didn't arrive, and a line that never arrived", async () => {
    const { deps, applied, events } = fakeDeps();
    await registerInvoiceUseCase(
      deps,
      invoice([
        // 2 Cajas invoiced, 1 arrived.
        { ...crackelet, quantity: 2, lineTotal: "50.40" },
        // Doritos invoiced, nothing arrived.
        { itemId: null, productId: 3, presentationId: 9, quantity: 1, lineTotal: "108" },
      ]),
      1,
      now,
    );
    const [box, doritos] = applied[0].lines;
    assert.equal(box.units, 72);
    assert.equal(box.receivedUnits, 36);
    assert.equal(doritos.units, 144);
    assert.equal(doritos.receivedUnits, 0);
    assert.equal(doritos.unitCost, 0.75);
    assert.equal(applied[0].total, 158.4);
    assert.deepEqual(events[0].payload?.gaps, [
      { productId: 1, units: -36, amount: 25.2 },
      { productId: 3, units: -144, amount: 108 },
    ]);
  });

  it("is due on arrival, or after the supplier's credit days from arrival", async () => {
    const cash = fakeDeps();
    await registerInvoiceUseCase(cash.deps, invoice([crackelet]), 1, now);
    assert.equal(cash.applied[0].dueDate, "2026-11-16");

    const credit = fakeDeps({ supplier: { givesCredit: true, creditDays: 15 } });
    await registerInvoiceUseCase(credit.deps, invoice([crackelet]), 1, now);
    assert.equal(credit.applied[0].dueDate, "2026-12-01");
  });

  it("leaves the invoice in the audit trail", async () => {
    const { deps, events } = fakeDeps();
    await registerInvoiceUseCase(deps, invoice([crackelet]), 5, now);
    assert.equal(events[0].type, "receipt_invoiced");
    assert.equal(events[0].actorId, 5);
    assert.deepEqual(events[0].payload, {
      receiptId: 7,
      docType: "factura",
      docNumber: "F016-5981",
      total: 25.2,
      dueDate: "2026-11-16",
      gaps: [],
    });
  });

  it("refuses an invoice already registered, or entered in another receipt", async () => {
    const twice = fakeDeps({ receipt: reception({ invoiceStatus: "registered" }) });
    await assert.rejects(
      registerInvoiceUseCase(twice.deps, invoice([crackelet]), 1, now),
      /ya fue registrada/,
    );
    const duplicate = fakeDeps({ documentExists: true });
    await assert.rejects(
      registerInvoiceUseCase(duplicate.deps, invoice([crackelet]), 1, now),
      /ya fue registrado/,
    );
    assert.equal(twice.applied.length + duplicate.applied.length, 0);
  });

  it("can't drop a received line or invoice it twice", async () => {
    const { deps, applied } = fakeDeps();
    await assert.rejects(
      registerInvoiceUseCase(
        deps,
        invoice([{ itemId: null, productId: 3, presentationId: 9, quantity: 1, lineTotal: "108" }]),
        1,
        now,
      ),
      /Falta facturar/,
    );
    await assert.rejects(
      registerInvoiceUseCase(deps, invoice([crackelet, crackelet]), 1, now),
      /no coinciden/,
    );
    assert.equal(applied.length, 0);
  });

  it("asks for the total of a paid line", async () => {
    const { deps } = fakeDeps();
    await assert.rejects(
      registerInvoiceUseCase(deps, invoice([{ ...crackelet, lineTotal: "" }]), 1, now),
      /escribe el total/,
    );
  });
});
