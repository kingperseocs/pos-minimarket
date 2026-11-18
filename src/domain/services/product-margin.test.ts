import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productMargin } from "./product-margin";

describe("productMargin", () => {
  it("bought at 4, sold at 6: earns 2 (50% over cost, 33% of the price)", () => {
    assert.deepEqual(productMargin(6, 4), {
      profit: 2,
      markupPercent: 50,
      marginPercent: 33,
    });
  });

  it("is negative when sold below cost", () => {
    assert.equal(productMargin(3.5, 4)?.profit, -0.5);
  });

  it("is unknown without a purchase price", () => {
    assert.equal(productMargin(6, null), null);
  });
});
