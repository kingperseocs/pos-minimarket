import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWorkerDiscountRule,
  discountedQuantity,
  unitsPerDayOf,
  maxRedeemableSoles,
  maxSaleDiscount,
  priceSale,
  saleLines,
  type WorkerDiscountRule,
} from "./sale-pricing";

const policy = {
  maxDiscountedUnitsPerDay: 3,
  pointsPerSol: 1,
  birthdayGiftMaxAmount: 10,
};

const worker: WorkerDiscountRule = { pointsPerSol: 1, unitsPerSale: 3 };
const birthday: WorkerDiscountRule = { ...worker, giftAllowed: true, giftMaxAmount: 10 };

const pct20 = { id: 1, percent: 20 };

describe("priceSale", () => {
  it("charges a regular customer full price, even if a percentage is passed", () => {
    const result = priceSale([{ unitPrice: 5, quantity: 2 }], null, pct20);
    assert.equal(result.subtotal, 10);
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 10);
    assert.equal(result.promo, null);
    assert.equal(result.pointsEarned, 0);
  });

  it("charges a worker full price until the cashier picks a percentage", () => {
    const result = priceSale([{ unitPrice: 5, quantity: 2 }], worker);
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 10);
    assert.equal(result.pointsEarned, 10);
  });

  it("takes the chosen percentage off each unit for a worker", () => {
    // Gaseosa 5.00 −20% = 4.00 · Papas 3.00 −20% = 2.40
    const result = priceSale(
      [
        { unitPrice: 5, quantity: 1 },
        { unitPrice: 3, quantity: 1 },
      ],
      worker,
      pct20,
    );
    assert.equal(result.subtotal, 8);
    assert.equal(result.discountTotal, 1.6);
    // 6.40 is charged in whole soles.
    assert.equal(result.rounding, -0.4);
    assert.equal(result.total, 6);
    assert.deepEqual(
      result.lines.map((l) => [l.discountUnitAmount, l.discountAmount, l.net]),
      [
        [1, 1, 4],
        [0.6, 0.6, 2.4],
      ],
    );
    assert.deepEqual(result.promo, pct20);
    assert.equal(result.unitsCapped, false);
  });

  it("discounts only the first 3 units of the purchase", () => {
    // 5 gaseosas: 3 × 4.00 + 2 × 5.00
    const result = priceSale([{ unitPrice: 5, quantity: 5 }], worker, pct20);
    assert.equal(result.lines[0].discountedQuantity, 3);
    assert.equal(result.discountTotal, 3);
    assert.equal(result.total, 22);
    assert.equal(result.unitsCapped, true);
  });

  it("spends the 3 units in basket order across products", () => {
    const result = priceSale(
      [
        { unitPrice: 5, quantity: 2 },
        { unitPrice: 4, quantity: 2 },
      ],
      worker,
      pct20,
    );
    assert.deepEqual(
      result.lines.map((l) => l.discountedQuantity),
      [2, 1],
    );
    // 2 × 1.00 + 1 × 0.80
    assert.equal(result.discountTotal, 2.8);
  });

  it("makes the discounted units free at 100%", () => {
    const result = priceSale([{ unitPrice: 2, quantity: 1 }], worker, {
      id: 2,
      percent: 100,
    });
    assert.equal(result.discountTotal, 2);
    assert.equal(result.total, 0);
  });

  it("charges full price but awards points when the discount is not allowed", () => {
    const result = priceSale(
      [{ unitPrice: 5, quantity: 2 }],
      { ...worker, discountAllowed: false },
      pct20,
    );
    assert.equal(result.discountTotal, 0);
    assert.equal(result.promo, null);
    assert.equal(result.total, 10);
    assert.equal(result.pointsEarned, 10);
  });

  it("awards floor(total × pointsPerSol) points", () => {
    const result = priceSale([{ unitPrice: 5.5, quantity: 1 }], {
      ...worker,
      pointsPerSol: 2,
    });
    assert.equal(result.pointsEarned, 11);
  });

  it("gives one unit free on the worker's birthday", () => {
    const result = priceSale(
      [{ unitPrice: 6, quantity: 1, isGift: true }],
      birthday,
      pct20,
    );
    assert.equal(result.giftTotal, 6);
    assert.equal(result.discountTotal, 0);
    assert.equal(result.total, 0);
    assert.equal(result.lines[0].isGift, true);
  });

  it("discounts the other units of the gift line without spending the gift", () => {
    // 3 gaseosas: 1 gratis + 2 × 4.00
    const result = priceSale(
      [{ unitPrice: 5, quantity: 3, isGift: true }],
      birthday,
      pct20,
    );
    assert.equal(result.giftTotal, 5);
    assert.equal(result.lines[0].discountedQuantity, 2);
    assert.equal(result.total, 8);
  });

  it("ignores the gift above the limit, without a birthday or a worker", () => {
    const expensive = [{ unitPrice: 12, quantity: 1, isGift: true }];
    assert.equal(priceSale(expensive, birthday).giftTotal, 0);
    const cheap = [{ unitPrice: 6, quantity: 1, isGift: true }];
    assert.equal(priceSale(cheap, worker).giftTotal, 0);
    assert.equal(priceSale(cheap, null).giftTotal, 0);
  });

  it("gives only one gift per sale", () => {
    const result = priceSale(
      [
        { unitPrice: 4, quantity: 1, isGift: true },
        { unitPrice: 3, quantity: 1, isGift: true },
      ],
      birthday,
    );
    assert.equal(result.giftTotal, 4);
    assert.deepEqual(
      result.lines.map((l) => l.isGift),
      [true, false],
    );
  });
});

describe("priceSale rounding to whole soles", () => {
  // Gaseosa 5.00 × 2, Papas 3.00 × 2, Galleta 2.70 × 1 = 18.70;
  // 20% off the first 3 units (5, 5, 3) = 2.60 → 16.10.
  const basket = [
    { unitPrice: 5, quantity: 2 },
    { unitPrice: 3, quantity: 2 },
    { unitPrice: 2.7, quantity: 1 },
  ];

  it("rounds down below half a sol when there is a discount", () => {
    const result = priceSale(basket, worker, pct20);
    assert.equal(result.discountTotal, 2.6);
    assert.equal(result.rounding, -0.1);
    assert.equal(result.total, 16);
  });

  it("rounds up from half a sol", () => {
    // 4.50 − 20% = 3.60 → 4.00.
    const result = priceSale([{ unitPrice: 4.5, quantity: 1 }], worker, pct20);
    assert.equal(result.rounding, 0.4);
    assert.equal(result.total, 4);
  });

  it("sends exactly .50 up", () => {
    // 5.625 − 20% (1.13) = 4.50 → 5.00.
    const result = priceSale([{ unitPrice: 5.625, quantity: 1 }], worker, pct20);
    assert.equal(result.lines[0].net, 4.5);
    assert.equal(result.total, 5);
  });

  it("charges a sale without discount exactly", () => {
    const result = priceSale([{ unitPrice: 20.32, quantity: 1 }], null);
    assert.equal(result.rounding, 0);
    assert.equal(result.total, 20.32);
    // A worker without a chosen percentage pays exact too.
    assert.equal(priceSale([{ unitPrice: 20.32, quantity: 1 }], worker).total, 20.32);
  });

  it("counts the points on the rounded total", () => {
    const result = priceSale(basket, worker, pct20);
    assert.equal(result.pointsEarned, 16);
  });
});

describe("saleLines", () => {
  it("splits the gift unit into its own free line", () => {
    const basket = [
      { unitPrice: 5, quantity: 3, isGift: true },
      { unitPrice: 2, quantity: 1 },
    ];
    const lines = saleLines(basket, priceSale(basket, birthday, pct20));
    assert.deepEqual(
      lines.map((l) => [l.index, l.quantity, l.lineTotal, l.discountAmount, l.isGift]),
      [
        [0, 2, 10, 2, false],
        [0, 1, 5, 0, true],
        [1, 1, 2, 0.4, false],
      ],
    );
  });
});

describe("maxSaleDiscount", () => {
  it("takes the best unit discounts up to the limit, in any order", () => {
    const max = maxSaleDiscount(
      [
        { quantity: 2, isGift: false, unitDiscount: 0.5 },
        { quantity: 2, isGift: false, unitDiscount: 1 },
        { quantity: 1, isGift: true, unitDiscount: 2 },
      ],
      3,
    );
    assert.equal(max, 2.5);
  });
});

describe("buildWorkerDiscountRule", () => {
  it("gives the whole daily allowance on the first purchase", () => {
    const { rule, limitReached, unitsLeft } = buildWorkerDiscountRule(
      policy,
      { discountedUnitsToday: 0 },
      false,
    );
    assert.equal(limitReached, null);
    assert.equal(rule.discountAllowed, true);
    assert.equal(rule.unitsPerSale, 3);
    assert.equal(unitsLeft, 3);
    assert.equal(rule.giftAllowed, false);
  });

  it("needs 3 products: with 2 there is no discount", () => {
    const { rule } = buildWorkerDiscountRule(policy, { discountedUnitsToday: 0 }, false);
    const two = priceSale([{ unitPrice: 7, quantity: 2 }], rule, { id: 1, percent: 30 });
    assert.equal(two.discountTotal, 0);
    assert.equal(two.promo, null);
    assert.deepEqual(two.belowMinimum, { have: 2, need: 3 });
  });

  it("discounts the first 3: 3 products all, 4 products 3 of them", () => {
    const { rule } = buildWorkerDiscountRule(policy, { discountedUnitsToday: 0 }, false);
    const three = priceSale([{ unitPrice: 5, quantity: 3 }], rule, { id: 1, percent: 20 });
    assert.equal(three.lines[0].discountedQuantity, 3);
    assert.equal(three.belowMinimum, null);
    const four = priceSale([{ unitPrice: 5, quantity: 4 }], rule, { id: 1, percent: 20 });
    assert.equal(four.lines[0].discountedQuantity, 3);
    assert.equal(four.unitsCapped, true);
  });

  it("counts different products toward the 3 (2 + 1)", () => {
    const { rule } = buildWorkerDiscountRule(policy, { discountedUnitsToday: 0 }, false);
    const priced = priceSale(
      [
        { unitPrice: 5, quantity: 2 },
        { unitPrice: 8, quantity: 1 },
      ],
      rule,
      { id: 1, percent: 20 },
    );
    assert.deepEqual(
      priced.lines.map((l) => l.discountedQuantity),
      [2, 1],
    );
  });

  it("gives one discounted purchase a day", () => {
    const { rule, limitReached } = buildWorkerDiscountRule(
      policy,
      { discountedUnitsToday: 3 },
      false,
    );
    assert.equal(limitReached, "daily");
    const priced = priceSale([{ unitPrice: 5, quantity: 3 }], rule, { id: 1, percent: 20 });
    assert.equal(priced.discountTotal, 0);
  });

  it("blocks the discount once the day's units are used", () => {
    const { rule, limitReached } = buildWorkerDiscountRule(
      policy,
      { discountedUnitsToday: 3 },
      true,
    );
    assert.equal(limitReached, "daily");
    assert.equal(rule.discountAllowed, false);
    // The birthday gift does not depend on the daily cap.
    assert.equal(rule.giftAllowed, true);
  });
});

describe("priceSale lines as stored", () => {
  it("stores the same per-line amounts it charged", () => {
    const items = [
      { unitPrice: 4, quantity: 1 },
      { unitPrice: 6, quantity: 2 },
    ];
    const pricing = priceSale(items, worker, { id: 3, percent: 30 });
    const lines = saleLines(items, pricing);
    assert.deepEqual(
      lines.map((l) => l.discountAmount),
      [1.2, 3.6],
    );
  });
});

describe("redeeming points", () => {
  // 100 points = S/ 1, from 200 points.
  const redeemer: WorkerDiscountRule = { ...worker, redeemPointsPerSol: 100, minRedeemPoints: 200 };

  it("offers as many whole soles as the balance covers, up to the sale", () => {
    assert.equal(maxRedeemableSoles(550, redeemer, 20), 5);
    assert.equal(maxRedeemableSoles(5000, redeemer, 7.8), 7);
  });

  it("offers nothing under the minimum, without a rule or with redemption off", () => {
    assert.equal(maxRedeemableSoles(150, redeemer, 20), 0);
    assert.equal(maxRedeemableSoles(550, null, 20), 0);
    assert.equal(maxRedeemableSoles(550, worker, 20), 0);
    assert.equal(maxRedeemableSoles(-100, redeemer, 20), 0);
  });

  it("takes the soles off the total and earns points on what is paid", () => {
    const result = priceSale([{ unitPrice: 5, quantity: 2 }], redeemer, null, 3);
    assert.equal(result.redeemTotal, 3);
    assert.equal(result.pointsRedeemed, 300);
    assert.equal(result.total, 7);
    assert.equal(result.pointsEarned, 7);
  });

  it("redeems after the discount and the rounding, never below zero", () => {
    // 6.40 → 6.00 rounded, then −6 with points.
    const result = priceSale(
      [
        { unitPrice: 5, quantity: 1 },
        { unitPrice: 3, quantity: 1 },
      ],
      redeemer,
      pct20,
      50,
    );
    assert.equal(result.rounding, -0.4);
    assert.equal(result.redeemTotal, 6);
    assert.equal(result.pointsRedeemed, 600);
    assert.equal(result.total, 0);
    assert.equal(result.pointsEarned, 0);
  });

  it("ignores redemption for a regular customer", () => {
    const result = priceSale([{ unitPrice: 5, quantity: 2 }], null, null, 3);
    assert.equal(result.redeemTotal, 0);
    assert.equal(result.total, 10);
  });

  it("carries the redemption settings from the policy", () => {
    const { rule } = buildWorkerDiscountRule(
      { ...policy, redeemPointsPerSol: 100, minRedeemPoints: 200 },
      { discountedUnitsToday: 0 },
      false,
    );
    assert.equal(rule.redeemPointsPerSol, 100);
    assert.equal(rule.minRedeemPoints, 200);
  });
});

describe("discountedQuantity", () => {
  it("counts the discounted units of a stored line", () => {
    assert.equal(discountedQuantity({ discountAmount: 3, discountUnitAmount: 1 }), 3);
    assert.equal(discountedQuantity({ discountAmount: 0.9, discountUnitAmount: 0.3 }), 3);
    assert.equal(discountedQuantity({ discountAmount: 0, discountUnitAmount: 0 }), 0);
  });
});

describe("unitsPerDayOf", () => {
  it("reads the daily allowance, or the old per-sale field of a cached policy", () => {
    assert.equal(unitsPerDayOf({ maxDiscountedUnitsPerDay: 4 }), 4);
    assert.equal(unitsPerDayOf({ maxDiscountedUnitsPerSale: 3 }), 3);
    assert.equal(unitsPerDayOf({}), 3);
  });
});
