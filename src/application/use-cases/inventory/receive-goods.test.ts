import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NewGoodsReceipt } from "@/domain/entities/receiving";
import { receiveGoodsUseCase } from "./receive-goods";

type Deps = Parameters<typeof receiveGoodsUseCase>[0];

function fakeDeps(supplier: { givesCredit: boolean; creditDays: number | null }) {
  const created: NewGoodsReceipt[] = [];
  const events: { type: string; payload: Record<string, unknown> }[] = [];
  const deps = {
    receiving: {
      async documentExists() {
        return false;
      },
      async createReceipt(data: NewGoodsReceipt) {
        created.push(data);
        return { id: 1 };
      },
    },
    products: {
      async findById(id: number) {
        return { id, name: "Fanta", tracksExpiry: false };
      },
    },
    // Paquete de 12.
    presentations: {
      async listAll() {
        return [{ id: 5, productId: 1, unitsTotal: 12, isActive: true }];
      },
    },
    suppliers: {
      async findById(id: number) {
        return { id, ...supplier };
      },
    },
    audit: {
      async record(event: { type: string; payload: Record<string, unknown> }) {
        events.push(event);
      },
    },
  } as unknown as Deps;
  return { deps, created, events };
}

// 10 paquetes de Fanta: S/ 230 en la factura, 8% de descuento.
const fanta = {
  supplierId: 2,
  docType: "factura",
  docNumber: "f001-123",
  lines: [{ productId: 1, presentationId: 5, quantity: 10, lineTotal: "230", discountPercent: "8" }],
};
// 16 Nov 2026, 10:00 in Lima.
const now = new Date("2026-11-16T15:00:00Z");

describe("receiveGoodsUseCase", () => {
  it("costs the line at what was paid after the supplier's discount", async () => {
    const { deps, created } = fakeDeps({ givesCredit: false, creditDays: null });
    await receiveGoodsUseCase(deps, fanta, 1, now);
    const [line] = created[0].lines;
    assert.equal(line.listTotal, 230);
    assert.equal(line.discountPercent, 8);
    assert.equal(line.lineTotal, 211.6);
    assert.equal(line.unitCost, 1.7633);
    assert.equal(created[0].total, 211.6);
  });

  it("leaves the one-step receipt in the audit trail", async () => {
    const { deps, events } = fakeDeps({ givesCredit: false, creditDays: null });
    await receiveGoodsUseCase(deps, fanta, 1, now);
    assert.equal(events[0].type, "goods_received");
    assert.equal(events[0].payload.units, 120);
    assert.equal(events[0].payload.withInvoice, true);
  });

  it("is due on arrival without credit, or after the credit days", async () => {
    const cash = fakeDeps({ givesCredit: false, creditDays: 15 });
    await receiveGoodsUseCase(cash.deps, fanta, 1, now);
    assert.equal(cash.created[0].dueDate, "2026-11-16");

    const credit = fakeDeps({ givesCredit: true, creditDays: 15 });
    await receiveGoodsUseCase(credit.deps, fanta, 1, now);
    assert.equal(credit.created[0].dueDate, "2026-12-01");
  });

  it("ignores the discount on a bonus line", async () => {
    const { deps, created } = fakeDeps({ givesCredit: false, creditDays: null });
    await receiveGoodsUseCase(
      deps,
      { ...fanta, lines: [{ ...fanta.lines[0], lineTotal: "", isBonus: true }] },
      1,
      now,
    );
    assert.equal(created[0].lines[0].discountPercent, 0);
    assert.equal(created[0].lines[0].listTotal, null);
    assert.equal(created[0].total, 0);
  });
});
