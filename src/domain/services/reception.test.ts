import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPresentation, supplierCatalog } from "./reception";

describe("defaultPresentation", () => {
  it("picks the pack with the supplier's code (how it arrives)", () => {
    const paquete = { id: 1, unitsTotal: 4, supplierCode: "800123" };
    const display = { id: 2, unitsTotal: 24, supplierCode: null };
    assert.equal(defaultPresentation([display, paquete]), paquete);
  });

  it("the biggest coded pack when several have a code", () => {
    const caja36 = { id: 1, unitsTotal: 36, supplierCode: "800436" };
    const paquete6 = { id: 2, unitsTotal: 6, supplierCode: null };
    const caja6x6 = { id: 3, unitsTotal: 36, supplierCode: "800186" };
    assert.equal(defaultPresentation([paquete6, caja36, caja6x6]), caja36);
  });

  it("the biggest pack without codes, and the unit without packs", () => {
    const six = { id: 1, unitsTotal: 6, supplierCode: null };
    const twelve = { id: 2, unitsTotal: 12, supplierCode: null };
    assert.equal(defaultPresentation([six, twelve]), twelve);
    assert.equal(defaultPresentation([]), null);
  });
});

describe("supplierCatalog", () => {
  const products = [
    { id: 1, categoryId: 10 }, // gaseosa
    { id: 2, categoryId: 20 }, // galleta
    { id: 3, categoryId: 30 }, // agua, bought from this supplier once
  ];

  it("keeps the supplier's categories and what was already bought from it", () => {
    assert.deepEqual(
      supplierCatalog(products, [10], [3]).map((p) => p.id),
      [1, 3],
    );
  });

  it("is empty for a supplier without categories nor history", () => {
    assert.deepEqual(supplierCatalog(products, [], []), []);
  });
});
