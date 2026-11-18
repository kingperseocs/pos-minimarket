"use server";

import { revalidatePath } from "next/cache";
import {
  createCategoryUseCase,
  setCategoryActiveUseCase,
  updateCategoryUseCase,
} from "@/application/use-cases/categories/save-category";
import { assignCategorySuppliersUseCase } from "@/application/use-cases/categories/assign-suppliers";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { categoryRepository, supplierRepository } from "@/infrastructure/repositories";
import { runAction } from "./action-result";
import { revalidateCatalogViews } from "./revalidate";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

export async function createCategory(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await createCategoryUseCase(categoryRepository, input);
    revalidateCatalogViews();
  });
}

export async function updateCategory(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await updateCategoryUseCase(categoryRepository, input);
    revalidateCatalogViews();
  });
}

export async function setCategoryActive(id: number, isActive: boolean) {
  return runAction(async () => {
    await requireAdmin();
    await setCategoryActiveUseCase(
      categoryRepository,
      idSchema.parse(id),
      isActive,
    );
    revalidateCatalogViews();
  });
}

// Which suppliers deliver a category, chosen from the category itself.
export async function assignCategorySuppliers(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await assignCategorySuppliersUseCase(
      { categories: categoryRepository, suppliers: supplierRepository },
      input,
    );
    revalidateCatalogViews();
    revalidatePath("/admin/suppliers");
  });
}
