import { ValidationError } from "@/domain/errors";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { planPackaging } from "@/domain/services/packaging";
import type { z } from "zod";
import type { packagingSchema } from "@/application/validation/product";
import { createPresentationUseCase } from "./save-presentation";

type Packaging = z.infer<typeof packagingSchema>;

// Only for a product without presentations: the catalog formats describe
// the whole set, they can't be merged into presentations that exist.
export async function ensureCanAddPackaging(
  presentations: PresentationRepository,
  productId: number,
) {
  if ((await presentations.listByProduct(productId)).length > 0) {
    throw new ValidationError(
      "Este producto ya tiene presentaciones: cámbialas en Presentaciones",
    );
  }
}

// Checked before the product is created, so a bad set of formats doesn't
// leave a product half registered.
export function checkPackaging(packaging: Packaging) {
  planPackaging(packaging.formats);
}

// Turns the formats into presentations (see planPackaging), innermost first
// so each one can point at the level it contains. Each goes through the
// regular presentation use case (units total, duplicate names…).
export async function createPackaging(
  repos: { presentations: PresentationRepository; products: ProductRepository },
  productId: number,
  packaging: Packaging,
) {
  const plan = planPackaging(packaging.formats);
  const ids: number[] = [];
  for (const item of plan) {
    await createPresentationUseCase(repos, {
      productId,
      name: item.name,
      qtyOfParent: item.qtyOfParent,
      parentId: item.parent === null ? null : ids[item.parent],
      barcode: "",
      supplierCode: item.supplierCode ?? "",
    });
    const created = (await repos.presentations.listByProduct(productId)).find(
      (p) => p.name.toLowerCase() === item.name.toLowerCase(),
    );
    if (!created) throw new Error(`Presentation "${item.name}" was not saved`);
    ids.push(created.id);
  }
}
