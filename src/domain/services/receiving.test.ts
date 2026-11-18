import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  costAfterInvoice,
  invoiceGap,
  allowedResolutions,
  checkTransfer,
  daysUntilDue,
  discountedLineTotal,
  receiptDiscrepancy,
  receiptDueDate,
  receiptLineUnitCost,
  receiptLineUnits,
  weightedAverageCost,
} from "./receiving";

describe("receipt lines", () => {
  const twoBoxes = { quantity: 2, unitsPerPresentation: 24, lineTotal: 96, isBonus: false };

  it("2 Cajas of 24 are 48 units at S/ 2.00 each", () => {
    assert.equal(receiptLineUnits(twoBoxes), 48);
    assert.equal(receiptLineUnitCost(twoBoxes), 2);
  });

  it("keeps 4 decimals: a Caja of 144 candies for S/ 12 costs 0.0833 each", () => {
    assert.equal(
      receiptLineUnitCost({ quantity: 1, unitsPerPresentation: 144, lineTotal: 12, isBonus: false }),
      0.0833,
    );
  });

  it("a bonus line costs 0", () => {
    assert.equal(receiptLineUnitCost({ ...twoBoxes, isBonus: true }), 0);
  });

  it("rejects a quantity of 0", () => {
    assert.throws(() => receiptLineUnits({ ...twoBoxes, quantity: 0 }), /mayor a 0/);
  });
});

describe("weightedAverageCost", () => {
  it("averages old stock and the new receipt", () => {
    // 10 units at 2.10 on hand + 48 bought for 96.00 (2.00 each).
    assert.equal(
      weightedAverageCost({ currentUnits: 10, currentCost: 2.1, inUnits: 48, inTotal: 96 }),
      2.0172,
    );
  });

  it("bonus units lower the average", () => {
    // 48 paid 96.00 + 6 free = 54 units for 96.00.
    assert.equal(
      weightedAverageCost({ currentUnits: 0, currentCost: null, inUnits: 54, inTotal: 96 }),
      1.7778,
    );
  });

  it("without stock on hand, the receipt's cost wins", () => {
    assert.equal(
      weightedAverageCost({ currentUnits: -3, currentCost: 2.5, inUnits: 10, inTotal: 20 }),
      2,
    );
  });
});

describe("checkTransfer", () => {
  it("allows moving what is in the warehouse", () => {
    assert.doesNotThrow(() => checkTransfer(54, 24));
  });

  it("refuses more than available", () => {
    assert.throws(() => checkTransfer(10, 24), /Solo hay 10 unidades/);
  });
});

describe("receiptDiscrepancy", () => {
  it("the invoice says 48 and 47 arrived: 1 missing", () => {
    assert.equal(receiptDiscrepancy(48, 47), -1);
  });

  it("no difference when everything arrived", () => {
    assert.equal(receiptDiscrepancy(48, 48), 0);
  });

  it("extra units are positive", () => {
    assert.equal(receiptDiscrepancy(48, 50), 2);
  });

  it("missing and extra units are resolved differently", () => {
    assert.deepEqual(allowedResolutions(-1), ["replenished", "credited", "written_off"]);
    assert.deepEqual(allowedResolutions(2), ["kept", "returned"]);
  });
});

describe("supplier volume discount", () => {
  it("takes the percentage off the invoice amount", () => {
    // 10 paquetes de Fanta a S/ 23 con 8%.
    assert.equal(discountedLineTotal(230, 8), 211.6);
    assert.equal(discountedLineTotal(99.99, 0), 99.99);
  });

  it("rejects a discount out of range", () => {
    assert.throws(() => discountedLineTotal(100, 95));
    assert.throws(() => discountedLineTotal(100, -1));
  });
});

describe("invoice due date", () => {
  it("is due the day it arrives without credit", () => {
    assert.equal(receiptDueDate("2026-11-14", null), "2026-11-14");
    assert.equal(receiptDueDate("2026-11-14", 0), "2026-11-14");
  });

  it("adds the credit days, across months", () => {
    assert.equal(receiptDueDate("2026-11-14", 15), "2026-11-29");
    assert.equal(receiptDueDate("2026-11-20", 30), "2026-12-20");
  });

  it("counts the days left (negative when overdue)", () => {
    assert.equal(daysUntilDue("2026-11-29", "2026-11-16"), 13);
    assert.equal(daysUntilDue("2026-11-16", "2026-11-16"), 0);
    assert.equal(daysUntilDue("2026-11-14", "2026-11-16"), -2);
  });
});

describe("invoiceGap", () => {
  it("is nothing when the invoice matches what arrived", () => {
    assert.equal(invoiceGap({ units: 36, receivedUnits: 36, unitCost: 0.7 }), null);
  });

  it("flags units invoiced that didn't arrive, at the line's cost", () => {
    // 2 Cajas x36 invoiced, 1 arrived.
    assert.deepEqual(invoiceGap({ units: 72, receivedUnits: 36, unitCost: 0.7 }), {
      units: -36,
      amount: 25.2,
    });
  });

  it("flags units that arrived without being invoiced", () => {
    assert.deepEqual(invoiceGap({ units: 0, receivedUnits: 12, unitCost: 0 }), {
      units: 12,
      amount: 0,
    });
  });

  it("flags a line invoiced that never arrived", () => {
    assert.deepEqual(invoiceGap({ units: 96, receivedUnits: 0, unitCost: 0.75 }), {
      units: -96,
      amount: 72,
    });
  });
});

describe("costAfterInvoice", () => {
  it("doesn't count the received units twice (they are already on hand)", () => {
    // 10 on hand at S/ 1.00 before; 36 arrived (already counted in stock) at S/ 0.70.
    assert.equal(
      costAfterInvoice({ currentCost: 1, onHand: 46, receivedUnits: 36, receivedTotal: 25.2 }),
      0.7652,
    );
  });

  it("takes the invoice's cost when there was nothing before", () => {
    assert.equal(
      costAfterInvoice({ currentCost: null, onHand: 36, receivedUnits: 36, receivedTotal: 25.2 }),
      0.7,
    );
  });

  it("still works if part of it was sold before the invoice came", () => {
    // 36 arrived, 6 already sold: 30 on hand.
    assert.equal(
      costAfterInvoice({ currentCost: 1, onHand: 30, receivedUnits: 36, receivedTotal: 25.2 }),
      0.7,
    );
  });
});
