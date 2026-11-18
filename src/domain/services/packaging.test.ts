import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeUnits,
  formatLevelNames,
  planPackaging,
  defaultLevelNames,
  formatNetContent,
  packLevels,
  parsePackFormat,
} from "./packaging";

describe("parsePackFormat", () => {
  it("reads the Caritas catalog formats", () => {
    assert.deepEqual(parsePackFormat("16 x 6 x 31.5 g"), {
      counts: [16, 6],
      netContent: 31.5,
      unit: "g",
    });
    assert.deepEqual(parsePackFormat("12 x 30 x 11.8 g"), {
      counts: [12, 30],
      netContent: 11.8,
      unit: "g",
    });
  });

  it("accepts a decimal comma, no spaces and other separators", () => {
    assert.deepEqual(parsePackFormat("16x6x31,5g"), {
      counts: [16, 6],
      netContent: 31.5,
      unit: "g",
    });
    assert.deepEqual(parsePackFormat("24 × 500 ml"), {
      counts: [24],
      netContent: 500,
      unit: "ml",
    });
    assert.deepEqual(parsePackFormat("6 * 1 Lt"), { counts: [6], netContent: 1, unit: "l" });
  });

  it("handles one and three levels", () => {
    assert.deepEqual(parsePackFormat("12 x 1 kg")?.counts, [12]);
    assert.deepEqual(parsePackFormat("4 x 12 x 6 x 25 g")?.counts, [4, 12, 6]);
  });

  it("treats whole numbers without a unit as counts only", () => {
    assert.deepEqual(parsePackFormat("12 x 24"), {
      counts: [12, 24],
      netContent: null,
      unit: null,
    });
  });

  it("rejects what it does not understand", () => {
    assert.equal(parsePackFormat("caja grande"), null);
    assert.equal(parsePackFormat("31.5 g"), null);
    assert.equal(parsePackFormat("16 x 6 x 31.5 libras"), null);
    assert.equal(parsePackFormat("2 x 2 x 2 x 2 x 5 g"), null);
    assert.equal(parsePackFormat("0 x 6 x 31.5 g"), null);
  });
});

describe("packLevels", () => {
  it("computes the units in each level, outermost first", () => {
    assert.deepEqual(packLevels(defaultLevelNames(2), [16, 6]), [
      { name: "Caja", qtyOfParent: 16, unitsTotal: 96, contains: "Paquete" },
      { name: "Paquete", qtyOfParent: 6, unitsTotal: 6, contains: null },
    ]);
  });
});

describe("formatNetContent", () => {
  it("prints the amount with its unit", () => {
    assert.equal(formatNetContent(31.5, "g"), "31.5 g");
    assert.equal(formatNetContent(1, "l"), "1 L");
    assert.equal(formatNetContent(null, "g"), null);
  });
});

describe("formatLevelNames", () => {
  it("names each level with its counts so formats don't collide", () => {
    assert.deepEqual(formatLevelNames([36]), ["Caja x36"]);
    assert.deepEqual(formatLevelNames([6, 6]), ["Caja 6×6", "Paquete x6"]);
    assert.deepEqual(formatLevelNames([8, 12]), ["Caja 8×12", "Paquete x12"]);
    assert.deepEqual(formatLevelNames([4, 6, 10]), ["Caja 4×6×10", "Display 6×10", "Paquete x10"]);
  });
});

describe("planPackaging", () => {
  const caja36 = { supplierCode: "800436", levels: [{ name: "Caja x36", qtyOfParent: 36 }] };
  const caja6x6 = {
    supplierCode: "800186",
    levels: [
      { name: "Caja 6×6", qtyOfParent: 6 },
      { name: "Paquete x6", qtyOfParent: 6 },
    ],
  };

  it("plans both formats of Crackelet 47 g, innermost first, codes on the outer pack", () => {
    assert.deepEqual(planPackaging([caja36, caja6x6]), [
      { name: "Caja x36", qtyOfParent: 36, parent: null, unitsTotal: 36, supplierCode: "800436" },
      { name: "Paquete x6", qtyOfParent: 6, parent: null, unitsTotal: 6, supplierCode: null },
      { name: "Caja 6×6", qtyOfParent: 6, parent: 1, unitsTotal: 36, supplierCode: "800186" },
    ]);
  });

  it("creates a shared inner pack once", () => {
    const caja8x6 = {
      supplierCode: "900",
      levels: [
        { name: "Caja 8×6", qtyOfParent: 8 },
        { name: "Paquete x6 (b)", qtyOfParent: 6 },
      ],
    };
    const plan = planPackaging([caja6x6, caja8x6]);
    assert.deepEqual(
      plan.map((p) => [p.name, p.parent === null ? null : plan[p.parent].name]),
      [
        ["Paquete x6", null],
        ["Caja 6×6", "Paquete x6"],
        ["Caja 8×6", "Paquete x6"],
      ],
    );
  });

  it("refuses two presentations with the same name", () => {
    assert.throws(
      () =>
        planPackaging([
          { supplierCode: null, levels: [{ name: "Caja", qtyOfParent: 36 }] },
          { supplierCode: null, levels: [{ name: "caja", qtyOfParent: 24 }] },
        ]),
      /Dos presentaciones se llaman/,
    );
  });
});

describe("describeUnits", () => {
  const paquete = { name: "Paquete x6", unitsTotal: 6 };
  it("says units in whole packs and the loose rest", () => {
    assert.equal(describeUnits(36, paquete), "6 Paquete x6");
    assert.equal(describeUnits(32, paquete), "5 Paquete x6 + 2 sueltas");
    assert.equal(describeUnits(7, paquete), "1 Paquete x6 + 1 suelta");
  });
  it("keeps plain units without a pack or below one pack", () => {
    assert.equal(describeUnits(32, null), "32 und");
    assert.equal(describeUnits(4, paquete), "4 und");
    assert.equal(describeUnits(0, paquete), "0 und");
  });
});
