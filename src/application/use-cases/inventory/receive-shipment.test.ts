import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditEventInput } from "@/domain/entities/audit";
import type { NewReception } from "@/domain/entities/receiving";
import { receiveShipmentUseCase } from "./receive-shipment";

type Deps = Parameters<typeof receiveShipmentUseCase>[0];

function fakeDeps({ tracksExpiry = false } = {}) {
  const created: NewReception[] = [];
  const events: AuditEventInput[] = [];
  const deps = {
    receiving: {
      async createReception(data: NewReception) {
        created.push(data);
        return { id: 7 };
      },
    },
    products: {
      async findById(id: number) {
        return { id, name: "Crackelet Original 47 g", tracksExpiry };
      },
    },
    // Caja x36.
    presentations: {
      async listAll() {
        return [{ id: 1, productId: 1, unitsTotal: 36, isActive: true }];
      },
    },
    audit: {
      async record(event: AuditEventInput) {
        events.push(event);
      },
    },
  } as unknown as Deps;
  return { deps, created, events };
}

const twoBoxes = {
  supplierId: 2,
  lines: [{ productId: 1, presentationId: 1, quantity: 2, captureSource: "scan" }],
};
const now = new Date("2026-11-16T15:00:00Z");

describe("receiveShipmentUseCase", () => {
  it("counts what arrived into units, without any cost", async () => {
    const { deps, created } = fakeDeps();
    await receiveShipmentUseCase(deps, twoBoxes, 4, now);
    assert.deepEqual(created[0].lines, [
      {
        productId: 1,
        presentationId: 1,
        quantity: 2,
        receivedUnits: 72,
        expiresAt: null,
        captureSource: "scan",
      },
    ]);
    assert.equal(created[0].supplierId, 2);
    assert.equal(created[0].actorId, 4);
  });

  it("refuses prices: the Almacén counts, the admin types the invoice", async () => {
    const { deps, created } = fakeDeps();
    await assert.rejects(
      receiveShipmentUseCase(
        deps,
        { ...twoBoxes, lines: [{ ...twoBoxes.lines[0], lineTotal: "50" }] },
        4,
        now,
      ),
      /cantidades, no precios/,
    );
    await assert.rejects(
      receiveShipmentUseCase(deps, { ...twoBoxes, docNumber: "F016-5981" }, 4, now),
      /cantidades, no precios/,
    );
    assert.equal(created.length, 0);
  });

  it("asks for the supplier", async () => {
    const { deps } = fakeDeps();
    await assert.rejects(
      receiveShipmentUseCase(deps, { ...twoBoxes, supplierId: "" }, 4, now),
      /Elige el proveedor/,
    );
  });

  it("asks for the expiry date of products that expire", async () => {
    const { deps } = fakeDeps({ tracksExpiry: true });
    await assert.rejects(receiveShipmentUseCase(deps, twoBoxes, 4, now), /vence/);
  });

  it("leaves the reception in the audit trail", async () => {
    const { deps, events } = fakeDeps();
    await receiveShipmentUseCase(deps, twoBoxes, 4, now);
    assert.equal(events[0].type, "goods_received");
    assert.equal(events[0].actorId, 4);
    assert.deepEqual(events[0].payload, {
      receiptId: 7,
      supplierId: 2,
      lines: 1,
      units: 72,
      scanned: 1,
      invoicePhoto: false,
    });
  });
});
