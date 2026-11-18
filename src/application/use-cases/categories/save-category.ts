import { ValidationError } from "@/domain/errors";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import { categoryParentError } from "@/domain/services/categories";
import {
  categorySchema,
  categoryUpdateSchema,
} from "@/application/validation/category";

export async function createCategoryUseCase(
  repo: CategoryRepository,
  input: unknown,
) {
  const data = categorySchema.parse(input);
  if (await repo.existsByName(data.name)) {
    throw new ValidationError(`Ya existe la categoría "${data.name}"`);
  }
  await ensureValidParent(repo, null, data.parentId);
  await repo.create(data);
}

export async function updateCategoryUseCase(
  repo: CategoryRepository,
  input: unknown,
) {
  const { id, ...data } = categoryUpdateSchema.parse(input);
  if (!(await repo.findById(id))) {
    throw new ValidationError("La categoría no existe");
  }
  if (await repo.existsByName(data.name, id)) {
    throw new ValidationError(`Ya existe la categoría "${data.name}"`);
  }
  await ensureValidParent(repo, id, data.parentId);
  await repo.update(id, data);
}

// Subcategories go one level deep only (Galletas → Galletas saladas).
async function ensureValidParent(
  repo: CategoryRepository,
  id: number | null,
  parentId: number | null,
) {
  if (parentId === null) return;
  const parent = await repo.findById(parentId);
  if (!parent) throw new ValidationError("La categoría principal no existe");
  const error = categoryParentError({
    id,
    parent,
    hasSubcategories: id !== null && (await repo.hasSubcategories(id)),
  });
  if (error) throw new ValidationError(error);
}

// Categories are never hard-deleted: products and past sales still point at
// them. Deactivating hides the category and its products from the POS.
export async function setCategoryActiveUseCase(
  repo: CategoryRepository,
  id: number,
  isActive: boolean,
) {
  if (!(await repo.findById(id))) {
    throw new ValidationError("La categoría no existe");
  }
  await repo.setActive(id, isActive);
}
