import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SaleRecord } from "@/domain/entities/sale";
import type { NewSaleDocument } from "@/domain/entities/sale-document";
import { type CreateSaleDeps, checkRedemption, createSaleUseCase } from "./create-sale";

// Just enough of the repositories to price and store a sale.
function fakeDeps() {
  const stored: SaleRecord[] = [];
  const documents: (NewSaleDocument | undefined)[] = [];
  const deps = {
    users: {
      async findById(id: number) {
        return { id, isActive: true, role: "cashier", name: "Caja" };
      },
    },
    sales: {
      async existsByUuid() {
        return false;
      },
      async insertWithItems(record: SaleRecord, document?: NewSaleDocument) {
        stored.push(record);
        documents.push(document);
        return { id: 1, uuid: record.uuid, total: record.total, inserted: true };
      },
    },
    products: {
      async findCatalogByIds() {
        return new Map();
      },
    },
    workers: { async findById() { return null; } },
    policies: { async findById() { return null; }, async getActive() { return null; } },
    promos: { async findById() { return null; } },
  } as unknown as CreateSaleDeps;
  return { deps, stored, documents };
}

// Gaseosa 5.00 and Papas 3.00 with 20% off: 6.40.
const discountedSale = {
  uuid: "6f1c2b8e-3a4d-4c5e-9f60-7a8b9c0d1e2f",
  paymentType: "cash",
  items: [
    { productId: 1, productName: "Gaseosa", unitPrice: 5, quantity: 1, lineTotal: 5, discountUnitAmount: 1, discountAmount: 1 },
    { productId: 2, productName: "Papas", unitPrice: 3, quantity: 1, lineTotal: 3, discountUnitAmount: 0.6, discountAmount: 0.6 },
  ],
  total: 6,
  discountTotal: 1.6,
  clientCreatedAt: "2026-11-16T15:00:00.000Z",
};

describe("createSaleUseCase rounding", () => {
  it("rounds a discounted sale to whole soles, recomputing the amount", async () => {
    const { deps, stored } = fakeDeps();
    // The amount sent is ignored: only its presence counts.
    await createSaleUseCase(deps, { ...discountedSale, roundingAmount: -5 }, 1);
    assert.equal(stored[0].rounding, -0.4);
    assert.equal(stored[0].total, 6);
  });

  it("does not round a sale queued before rounding existed", async () => {
    const { deps, stored } = fakeDeps();
    await createSaleUseCase(deps, { ...discountedSale, total: 6.4 }, 1);
    assert.equal(stored[0].rounding, 0);
    assert.equal(stored[0].total, 6.4);
  });
});

describe("checkRedemption", () => {
  const policy = { redeemPointsPerSol: 100, minRedeemPoints: 200 };

  it("works out the soles from the server's rate", () => {
    assert.deepEqual(
      checkRedemption({ pointsRedeemed: 500, payable: 20, balance: 800, policy }),
      { points: 500, soles: 5, flags: [] },
    );
  });

  it("applies but flags a redemption over the balance (offline tills)", () => {
    assert.deepEqual(
      checkRedemption({ pointsRedeemed: 500, payable: 20, balance: 300, policy }),
      { points: 500, soles: 5, flags: ["POINTS_OVERDRAWN"] },
    );
  });

  it("rejects points that don't buy whole soles, or more than the sale", () => {
    for (const input of [
      { pointsRedeemed: 550, payable: 20, balance: 800, policy },
      { pointsRedeemed: 800, payable: 6.4, balance: 800, policy },
    ]) {
      assert.deepEqual(checkRedemption(input), {
        points: 0,
        soles: 0,
        flags: ["REDEEM_MISMATCH"],
      });
    }
  });

  it("rejects redemption without a worker or with redemption off", () => {
    assert.deepEqual(
      checkRedemption({ pointsRedeemed: 500, payable: 20, balance: null, policy }).flags,
      ["REDEEM_MISMATCH"],
    );
    assert.deepEqual(
      checkRedemption({
        pointsRedeemed: 500,
        payable: 20,
        balance: 800,
        policy: { redeemPointsPerSol: 0, minRedeemPoints: 0 },
      }).flags,
      ["REDEEM_MISMATCH"],
    );
  });

  it("does nothing when no points were redeemed", () => {
    assert.deepEqual(
      checkRedemption({ pointsRedeemed: 0, payable: 20, balance: null, policy: null }),
      { points: 0, soles: 0, flags: [] },
    );
  });
});

describe("createSaleUseCase redemption", () => {
  it("does not take points off a sale without a worker, and flags it", async () => {
    const { deps, stored } = fakeDeps();
    await createSaleUseCase(deps, { ...discountedSale, total: 6.4, pointsRedeemed: 300 }, 1);
    assert.equal(stored[0].redeemTotal, 0);
    assert.equal(stored[0].pointsRedeemed, 0);
    assert.equal(stored[0].total, 6.4);
    assert.ok(stored[0].auditFlags.includes("REDEEM_MISMATCH"));
  });
});

// Gaseosa 3.50 × 2, no discounts: 7.00.
const plainSale = {
  uuid: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  paymentType: "cash",
  items: [{ productId: 1, productName: "Gaseosa", unitPrice: 3.5, quantity: 2, lineTotal: 7 }],
  total: 7,
  clientCreatedAt: "2026-11-22T15:00:00.000Z",
};

describe("createSaleUseCase electronic document", () => {
  it("a sale queued before invoicing becomes an anonymous boleta, queued", async () => {
    const { deps, documents } = fakeDeps();
    await createSaleUseCase(deps, plainSale, 1);
    assert.deepEqual(documents[0], {
      docType: "boleta",
      customerDocType: "0",
      customerDocNumber: null,
      customerName: null,
      customerAddress: null,
      status: "queued",
      reviewReasons: [],
      idempotencyKey: plainSale.uuid,
    });
  });

  it("keeps the factura customer the cashier entered", async () => {
    const { deps, documents } = fakeDeps();
    await createSaleUseCase(
      deps,
      {
        ...plainSale,
        document: {
          type: "factura",
          customer: { docType: "6", number: "20100055237", name: "Alicorp S.A.A.", address: "Av. Argentina 4793" },
        },
      },
      1,
    );
    assert.equal(documents[0]?.docType, "factura");
    assert.equal(documents[0]?.customerName, "ALICORP S.A.A.");
    assert.equal(documents[0]?.status, "queued");
  });

  it("a factura without a valid RUC is saved but waits in review", async () => {
    const { deps, stored, documents } = fakeDeps();
    await createSaleUseCase(
      deps,
      { ...plainSale, document: { type: "factura", customer: { docType: "6", number: "123", name: "X" } } },
      1,
    );
    assert.equal(stored.length, 1, "the sale itself is never rejected");
    assert.equal(documents[0]?.status, "review");
    assert.deepEqual(documents[0]?.reviewReasons, ["invalid_customer"]);
    assert.equal(documents[0]?.customerDocType, "0");
  });

  it("a discounted sale waits in review", async () => {
    const { deps, documents } = fakeDeps();
    await createSaleUseCase(deps, { ...discountedSale, roundingAmount: 0 }, 1);
    assert.equal(documents[0]?.status, "review");
    assert.deepEqual(documents[0]?.reviewReasons, ["discount", "rounding"]);
  });
});
