import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { productCreateSchema } from "@/application/validation/product";
import { checkPackaging, createPackaging } from "./create-packaging";
import { ensureBarcodeFree } from "./ensure-barcode";
import { ensureAssignableCategory } from "./ensure-category";

export async function createProductUseCase(
  repos: {
    products: ProductRepository;
    categories: CategoryRepository;
    presentations: PresentationRepository;
  },
  input: unknown,
) {
  const data = productCreateSchema.parse(input);
  await ensureAssignableCategory(repos.categories, data.categoryId);
  await ensureBarcodeFree(repos, data.barcode, {});
  const { packaging, ...product } = data;
  if (packaging) checkPackaging(packaging);
  const id = await repos.products.create(product);
  // Everything was validated above, so creating the presentations from the
  // catalog format right after can't fail on the user's input.
  if (packaging) await createPackaging(repos, id, packaging);
  return id;
}
