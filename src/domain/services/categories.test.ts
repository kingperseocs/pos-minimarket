import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryAndChildren,
  categoryTotals,
  inheritedSuppliers,
  withSubcategories,
  categoryParentError,
  filterCategoryTree,
  groupCategories,
} from "./categories";

const galletas = { id: 1, name: "Galletas", parentId: null };
const saladas = { id: 2, name: "Galletas saladas", parentId: 1 };

describe("categoryParentError", () => {
  it("accepts a main category as parent", () => {
    assert.equal(categoryParentError({ id: 2, parent: galletas, hasSubcategories: false }), null);
    assert.equal(categoryParentError({ id: null, parent: galletas, hasSubcategories: false }), null);
  });

  it("refuses itself, a subcategory as parent, or moving a category with subcategories", () => {
    assert.match(
      categoryParentError({ id: 1, parent: galletas, hasSubcategories: false }) ?? "",
      /sí misma/,
    );
    assert.match(
      categoryParentError({ id: 5, parent: saladas, hasSubcategories: false }) ?? "",
      /ya es una subcategoría/,
    );
    assert.match(
      categoryParentError({ id: 3, parent: galletas, hasSubcategories: true }) ?? "",
      /tiene subcategorías/,
    );
  });
});

describe("groupCategories", () => {
  it("puts each subcategory right after its main category", () => {
    const helados = { id: 3, name: "Helados", parentId: null };
    const dulces = { id: 4, name: "Galletas dulces", parentId: 1 };
    assert.deepEqual(
      groupCategories([saladas, helados, galletas, dulces]).map(
        ({ category, depth }) => [category.name, depth],
      ),
      [
        ["Helados", 0],
        ["Galletas", 0],
        ["Galletas saladas", 1],
        ["Galletas dulces", 1],
      ],
    );
  });

  it("shows a subcategory whose main category is missing as main", () => {
    assert.deepEqual(
      groupCategories([saladas]).map(({ depth }) => depth),
      [0],
    );
  });
});

describe("filterCategoryTree", () => {
  const galletas = { id: 1, parentId: null, name: "Galletas" };
  const saladas = { id: 2, parentId: 1, name: "Galletas saladas" };
  const dulces = { id: 3, parentId: 1, name: "Galletas dulces" };
  const bebidas = { id: 4, parentId: null, name: "Bebidas" };
  const all = [galletas, saladas, dulces, bebidas];

  it("keeps a matching subcategory with its main category as context", () => {
    const { categories, contextIds } = filterCategoryTree(all, (c) => c.name.includes("saladas"));
    assert.deepEqual(categories.map((c) => c.id), [1, 2]);
    assert.deepEqual([...contextIds], [1]);
  });

  it("doesn't mark a main category as context when it matches itself", () => {
    const { categories, contextIds } = filterCategoryTree(all, (c) => c.name.startsWith("Galletas"));
    assert.deepEqual(categories.map((c) => c.id), [1, 2, 3]);
    assert.equal(contextIds.size, 0);
  });

  it("drops what doesn't match", () => {
    assert.deepEqual(
      filterCategoryTree(all, (c) => c.id === 4).categories.map((c) => c.id),
      [4],
    );
  });
});

describe("categoryAndChildren", () => {
  it("includes the subcategories of a main category", () => {
    const all = [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 1 },
      { id: 4, parentId: null },
    ];
    assert.deepEqual([...categoryAndChildren(all, 1)], [1, 2, 3]);
    assert.deepEqual([...categoryAndChildren(all, 2)], [2]);
  });
});

describe("categoryTotals", () => {
  it("adds the subcategories' products to their main category", () => {
    const totals = categoryTotals([
      { id: 18, parentId: null, productCount: 0, activeProductCount: 0 },
      { id: 19, parentId: 18, productCount: 5, activeProductCount: 4 },
      { id: 20, parentId: 18, productCount: 2, activeProductCount: 2 },
    ]);
    assert.deepEqual(totals.get(18), { products: 7, active: 6, fromChildren: 7 });
    assert.deepEqual(totals.get(19), { products: 5, active: 4, fromChildren: 0 });
  });
});

describe("inheritedSuppliers", () => {
  it("gives a subcategory its main category's suppliers it doesn't have", () => {
    const backus = { id: 1, name: "Backus" };
    const aje = { id: 2, name: "AJE" };
    const inherited = inheritedSuppliers([
      { id: 18, parentId: null, suppliers: [backus, aje] },
      { id: 19, parentId: 18, suppliers: [aje] },
      { id: 30, parentId: null, suppliers: [] },
    ]);
    assert.deepEqual(inherited.get(19), [backus]);
    assert.equal(inherited.has(18), false);
    assert.equal(inherited.has(30), false);
  });
});

describe("withSubcategories", () => {
  it("expands a main category to its subcategories", () => {
    const all = [
      { id: 18, parentId: null },
      { id: 19, parentId: 18 },
      { id: 5, parentId: null },
      { id: 6, parentId: 5 },
    ];
    assert.deepEqual(withSubcategories(all, [18]).sort(), [18, 19]);
    assert.deepEqual(withSubcategories(all, [6]), [6]);
  });
});
