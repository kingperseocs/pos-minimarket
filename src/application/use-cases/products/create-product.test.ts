import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Presentation, PresentationData } from "@/domain/entities/presentation";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type {
  CreateProductData,
  ProductRepository,
} from "@/domain/repositories/product-repository";
import { createProductUseCase } from "./create-product";

// In-memory repositories: just enough for creating a product and its
// presentations.
function fakeRepos() {
  const created: CreateProductData[] = [];
  const presentations: Presentation[] = [];

  const products = {
    async create(data: CreateProductData) {
      created.push(data);
      return 7;
    },
    async findById(id: number) {
      return id === 7 ? ({ id } as never) : null;
    },
    async existsByBarcode() {
      return false;
    },
  } as unknown as ProductRepository;

  const presentationRepo = {
    async listByProduct(productId: number) {
      return presentations.filter((p) => p.productId === productId);
    },
    async existsByBarcode() {
      return false;
    },
    async save(_id: number | null, data: PresentationData, totals: Map<number, number>) {
      const id = presentations.length + 100;
      const parent = presentations.find((p) => p.id === data.parentId);
      presentations.push({
        ...data,
        id,
        parentName: parent?.name ?? null,
        unitsTotal: totals.get(-1) ?? 0,
        isActive: true,
      });
    },
  } as unknown as PresentationRepository;

  const categories = {
    async findById(id: number) {
      return { id, name: "Galletas", isActive: true };
    },
  } as unknown as CategoryRepository;

  return {
    created,
    presentations,
    repos: { products, presentations: presentationRepo, categories },
  };
}

const caritas = {
  name: "Caritas",
  barcode: "",
  categoryId: 1,
  priceSale: "0.80",
  priceCost: "",
  netContent: "31.5",
  netContentUnit: "g",
};

describe("createProductUseCase", () => {
  it("saves the content, then the catalog packaging with its code", async () => {
    const { created, presentations, repos } = fakeRepos();
    await createProductUseCase(repos, {
      ...caritas,
      packaging: {
        formats: [
          {
            supplierCode: " 801162 ",
            levels: [
              { name: "Caja", qtyOfParent: 16 },
              { name: "Paquete", qtyOfParent: 6 },
            ],
          },
        ],
      },
    });

    assert.equal(created[0].netContent, 31.5);
    assert.equal(created[0].netContentUnit, "g");
    assert.equal("packaging" in created[0], false);

    assert.deepEqual(
      presentations.map((p) => [p.name, p.parentName, p.qtyOfParent, p.unitsTotal, p.supplierCode]),
      [
        ["Paquete", null, 6, 6, null],
        ["Caja", "Paquete", 16, 96, "801162"],
      ],
    );
  });

  it("creates every format of the product, sharing the inner pack", async () => {
    // Crackelet Original 47 g: 36 x 47 g (800436) and 6 x 6 x 47 g (800186).
    const { presentations, repos } = fakeRepos();
    await createProductUseCase(repos, {
      ...caritas,
      name: "Crackelet Original 47 g",
      netContent: "47",
      packaging: {
        formats: [
          { supplierCode: "800436", levels: [{ name: "Caja x36", qtyOfParent: 36 }] },
          {
            supplierCode: "800186",
            levels: [
              { name: "Caja 6×6", qtyOfParent: 6 },
              { name: "Paquete x6", qtyOfParent: 6 },
            ],
          },
        ],
      },
    });
    assert.deepEqual(
      presentations.map((p) => [p.name, p.parentName, p.unitsTotal, p.supplierCode]),
      [
        ["Caja x36", null, 36, "800436"],
        ["Paquete x6", null, 6, null],
        ["Caja 6×6", "Paquete x6", 36, "800186"],
      ],
    );
  });

  it("creates no presentations without packaging", async () => {
    const { presentations, repos } = fakeRepos();
    await createProductUseCase(repos, caritas);
    assert.equal(presentations.length, 0);
  });

  it("rejects a packaging level named like the unit, before creating anything", async () => {
    const { created, repos } = fakeRepos();
    await assert.rejects(
      createProductUseCase(repos, {
        ...caritas,
        packaging: { formats: [{ supplierCode: "", levels: [{ name: "Unidad", qtyOfParent: 6 }] }] },
      }),
    );
    assert.equal(created.length, 0);
  });

  it("rejects repeated level names and a level of one", async () => {
    const { repos } = fakeRepos();
    await assert.rejects(
      createProductUseCase(repos, {
        ...caritas,
        packaging: {
          formats: [
            {
              supplierCode: "",
              levels: [
                { name: "Caja", qtyOfParent: 16 },
                { name: "caja", qtyOfParent: 6 },
              ],
            },
          ],
        },
      }),
    );
    await assert.rejects(
      createProductUseCase(repos, {
        ...caritas,
        packaging: { formats: [{ supplierCode: "", levels: [{ name: "Caja", qtyOfParent: 1 }] }] },
      }),
    );
  });

  it("refuses two formats whose packs share a name, before creating the product", async () => {
    const { created, repos } = fakeRepos();
    await assert.rejects(
      createProductUseCase(repos, {
        ...caritas,
        packaging: {
          formats: [
            { supplierCode: "1", levels: [{ name: "Caja", qtyOfParent: 36 }] },
            { supplierCode: "2", levels: [{ name: "Caja", qtyOfParent: 24 }] },
          ],
        },
      }),
      /Dos presentaciones se llaman/,
    );
    assert.equal(created.length, 0);
  });

  it("asks for the unit of the net content", async () => {
    const { repos } = fakeRepos();
    await assert.rejects(
      createProductUseCase(repos, { ...caritas, netContentUnit: "" }),
      /unidad del contenido neto/,
    );
  });
});
