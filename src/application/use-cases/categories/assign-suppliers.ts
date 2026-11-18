import { z } from "zod";
import { ValidationError } from "@/domain/errors";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { idSchema } from "@/application/validation/id";

const schema = z.object({
  categoryId: idSchema,
  supplierIds: z.array(idSchema).max(50, "Máximo 50 proveedores"),
});

// From the category's side: these are the suppliers that deliver it. A
// supplier of a main category also delivers its subcategories, so there is
// no need to repeat it there.
export async function assignCategorySuppliersUseCase(
  repos: { categories: CategoryRepository; suppliers: SupplierRepository },
  input: unknown,
) {
  const data = schema.parse(input);
  if (new Set(data.supplierIds).size !== data.supplierIds.length) {
    throw new ValidationError("Un proveedor está repetido");
  }
  const category = await repos.categories.findById(data.categoryId);
  if (!category) throw new ValidationError("La categoría no existe");

  if (data.supplierIds.length > 0) {
    const suppliers = await repos.suppliers.findAll();
    for (const id of data.supplierIds) {
      const supplier = suppliers.find((s) => s.id === id);
      if (!supplier) throw new ValidationError("Uno de los proveedores no existe");
      if (!supplier.isActive) {
        throw new ValidationError(
          `${supplier.tradeName ?? supplier.businessName} está desactivado: actívalo primero`,
        );
      }
    }
  }

  await repos.suppliers.setCategorySuppliers(category.id, data.supplierIds);
}
