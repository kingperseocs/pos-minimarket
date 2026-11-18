import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignCategorySuppliersUseCase } from "./assign-suppliers";

type Repos = Parameters<typeof assignCategorySuppliersUseCase>[0];

function fakeRepos() {
  const saved: { categoryId: number; supplierIds: number[] }[] = [];
  const repos = {
    categories: {
      async findById(id: number) {
        return id === 19 ? { id, name: "Gaseosas" } : null;
      },
    },
    suppliers: {
      async findAll() {
        return [
          { id: 1, businessName: "Backus SAA", tradeName: "Backus", isActive: true },
          { id: 2, businessName: "AJE SAC", tradeName: null, isActive: false },
        ];
      },
      async setCategorySuppliers(categoryId: number, supplierIds: number[]) {
        saved.push({ categoryId, supplierIds });
      },
    },
  } as unknown as Repos;
  return { repos, saved };
}

describe("assignCategorySuppliersUseCase", () => {
  it("saves the suppliers of the category", async () => {
    const { repos, saved } = fakeRepos();
    await assignCategorySuppliersUseCase(repos, { categoryId: 19, supplierIds: [1] });
    assert.deepEqual(saved, [{ categoryId: 19, supplierIds: [1] }]);
  });

  it("can leave the category without suppliers", async () => {
    const { repos, saved } = fakeRepos();
    await assignCategorySuppliersUseCase(repos, { categoryId: 19, supplierIds: [] });
    assert.deepEqual(saved, [{ categoryId: 19, supplierIds: [] }]);
  });

  it("refuses an unknown category, a repeated or an inactive supplier", async () => {
    const { repos, saved } = fakeRepos();
    await assert.rejects(
      assignCategorySuppliersUseCase(repos, { categoryId: 99, supplierIds: [1] }),
      /no existe/,
    );
    await assert.rejects(
      assignCategorySuppliersUseCase(repos, { categoryId: 19, supplierIds: [1, 1] }),
      /repetido/,
    );
    await assert.rejects(
      assignCategorySuppliersUseCase(repos, { categoryId: 19, supplierIds: [2] }),
      /desactivado/,
    );
    await assert.rejects(
      assignCategorySuppliersUseCase(repos, { categoryId: 19, supplierIds: [7] }),
      /no existe/,
    );
    assert.equal(saved.length, 0);
  });
});
