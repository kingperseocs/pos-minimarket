import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SaleItemInput, SaleRecord } from "../entities/sale";
import type { IgvAffectation } from "../entities/sale-document";
import {
  buildIssueRequest,
  documentCustomerFields,
  documentRequestErrors,
  lineAffectation,
  reviewReasons,
  seriesFor,
  totalsMatch,
} from "./e-invoice";

function item(over: Partial<SaleItemInput> = {}): SaleItemInput {
  return { productId: 1, productName: "Gaseosa 500 ml", unitPrice: 3.5, quantity: 2, lineTotal: 7, ...over };
}

function sale(over: Partial<SaleRecord> = {}): SaleRecord {
  return {
    uuid: "0b6f7a52-3c2e-4b0a-9f4e-1d2c3b4a5f60",
    shiftUuid: null,
    cashierId: 2,
    paymentType: "cash",
    items: [item()],
    clientCreatedAt: "2026-11-22T10:00:00-05:00",
    subtotal: 7,
    discountTotal: 0,
    giftTotal: 0,
    rounding: 0,
    total: 7,
    workerId: null,
    policyId: null,
    workerVerification: "none",
    pointsEarned: 0,
    pointsRedeemed: 0,
    redeemTotal: 0,
    auditFlags: [],
    promoDiscountId: null,
    promoDiscountPercent: 0,
    ...over,
  };
}

describe("reviewReasons", () => {
  it("a plain sale is emitted automatically", () => {
    assert.deepEqual(reviewReasons(sale()), []);
  });

  it("a worker sale that only earns points is still plain", () => {
    assert.deepEqual(reviewReasons(sale({ workerId: 5, pointsEarned: 7 })), []);
  });

  it("discounts, gifts, redeemed points and rounding go to review", () => {
    assert.deepEqual(
      reviewReasons(
        sale({
          discountTotal: 1,
          rounding: -0.32,
          redeemTotal: 2,
          giftTotal: 3.5,
          items: [item(), item({ productId: 2, isGift: true, quantity: 1, lineTotal: 3.5 })],
          total: 2.68,
        }),
      ),
      ["discount", "gift", "redeem", "rounding"],
    );
    assert.deepEqual(reviewReasons(sale({ promoDiscountId: 3 })), ["discount"]);
  });

  it("a total that does not match the lines goes to review", () => {
    assert.deepEqual(reviewReasons(sale({ total: 7.5 })), ["total_mismatch"]);
  });
});

describe("totalsMatch", () => {
  it("tolerates float noise but not a cent", () => {
    const items = [item({ unitPrice: 0.1, quantity: 3, lineTotal: 0.3 })];
    assert.equal(totalsMatch(items, 0.3), true);
    assert.equal(totalsMatch(items, 0.31), false);
  });
});

describe("documentRequestErrors", () => {
  it("an anonymous boleta is fine up to S/ 700", () => {
    assert.deepEqual(documentRequestErrors({ type: "boleta" }, 700), []);
    assert.equal(documentRequestErrors({ type: "boleta" }, 700.01).length, 1);
  });

  it("a factura needs a valid RUC and a name", () => {
    assert.equal(documentRequestErrors({ type: "factura" }, 10).length, 1);
    assert.equal(
      documentRequestErrors(
        { type: "factura", customer: { docType: "1", number: "12345678", name: "JUAN" } },
        10,
      ).length,
      1,
    );
    assert.deepEqual(
      documentRequestErrors(
        { type: "factura", customer: { docType: "6", number: "20100055238", name: "X" } },
        10,
      ),
      ["El RUC no es válido."],
    );
    assert.deepEqual(
      documentRequestErrors(
        { type: "factura", customer: { docType: "6", number: "20100055237", name: "ALICORP S.A.A." } },
        10,
      ),
      [],
    );
  });

  it("a DNI has 8 digits and a name", () => {
    assert.deepEqual(
      documentRequestErrors({ type: "boleta", customer: { docType: "1", number: "1234567", name: " " } }, 5),
      ["El DNI debe tener 8 dígitos.", "Falta el nombre o la razón social del cliente."],
    );
  });
});

describe("documentCustomerFields", () => {
  it("no customer means clientes varios", () => {
    assert.deepEqual(documentCustomerFields({ type: "boleta" }), {
      customerDocType: "0",
      customerDocNumber: null,
      customerName: null,
      customerAddress: null,
    });
  });

  it("trims and upper-cases the name", () => {
    assert.deepEqual(
      documentCustomerFields({
        type: "boleta",
        customer: { docType: "1", number: " 12345678 ", name: "juan pérez", address: "  " },
      }),
      { customerDocType: "1", customerDocNumber: "12345678", customerName: "JUAN PÉREZ", customerAddress: null },
    );
  });
});

describe("seriesFor and lineAffectation", () => {
  it("picks the series by type", () => {
    const settings = { boletaSeries: "B001", facturaSeries: "F001" };
    assert.equal(seriesFor("boleta", settings), "B001");
    assert.equal(seriesFor("factura", settings), "F001");
  });

  it("the global override wins over the product", () => {
    assert.equal(lineAffectation("10", "20"), "20");
    assert.equal(lineAffectation("20", null), "20");
    assert.equal(lineAffectation(undefined, null), "10");
  });
});

describe("buildIssueRequest", () => {
  const affectations = new Map<number, IgvAffectation>([[1, "10"], [2, "20"]]);

  it("sends amounts as strings and the affectation per line", () => {
    const request = buildIssueRequest({
      document: { series: "B001", customerDocType: "0", customerDocNumber: null, customerName: null, customerAddress: null },
      items: [item(), item({ productId: 2, productName: "Pan", unitPrice: 0.2, quantity: 10, lineTotal: 2 })],
      affectations,
      globalOverride: null,
      cashierName: "CAJA 1",
    });
    assert.deepEqual(request, {
      serie: "B001",
      cajero: "CAJA 1",
      items: [
        { codigo: "1", descripcion: "Gaseosa 500 ml", unidad: "NIU", cantidad: "2", precio_unitario: "3.50", afectacion_igv: "10" },
        { codigo: "2", descripcion: "Pan", unidad: "NIU", cantidad: "10", precio_unitario: "0.20", afectacion_igv: "20" },
      ],
    });
  });

  it("includes the customer of a factura and applies the override", () => {
    const request = buildIssueRequest({
      document: {
        series: "F001",
        customerDocType: "6",
        customerDocNumber: "20100055237",
        customerName: "ALICORP S.A.A.",
        customerAddress: "AV. ARGENTINA 4793",
      },
      items: [item()],
      affectations,
      globalOverride: "20",
    });
    assert.deepEqual(request.cliente, {
      tipo_documento: "6",
      numero_documento: "20100055237",
      razon_social: "ALICORP S.A.A.",
      direccion: "AV. ARGENTINA 4793",
    });
    assert.equal(request.items[0].afectacion_igv, "20");
    assert.equal(request.cajero, undefined);
  });
});
