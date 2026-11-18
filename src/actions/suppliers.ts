"use server";

import { lookupRucUseCase } from "@/application/use-cases/suppliers/lookup-ruc";
import {
  createSupplierUseCase,
  setSupplierActiveUseCase,
  updateSupplierUseCase,
} from "@/application/use-cases/suppliers/save-supplier";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { RUC_LOOKUP_TIMEOUT_MS, rucLookupDeps } from "@/infrastructure/deps";
import {
  categoryRepository,
  supplierRepository,
} from "@/infrastructure/repositories";
import { runAction, runDataAction } from "./action-result";
import { revalidateCatalogViews } from "./revalidate";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

const repos = { suppliers: supplierRepository, categories: categoryRepository };

// Fills the supplier form from SUNAT (server-side: SUNAT has no CORS).
// excludeId: the supplier being edited, so its own RUC is not "registered".
export async function lookupSupplierRuc(ruc: string, excludeId?: number) {
  return runDataAction(async () => {
    await requireAdmin();
    return lookupRucUseCase(
      rucLookupDeps,
      { ruc, excludeId },
      RUC_LOOKUP_TIMEOUT_MS,
    );
  });
}

export async function createSupplier(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await createSupplierUseCase(repos, input);
    revalidateCatalogViews();
  });
}

export async function updateSupplier(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await updateSupplierUseCase(repos, input);
    revalidateCatalogViews();
  });
}

export async function setSupplierActive(id: number, isActive: boolean) {
  return runAction(async () => {
    await requireAdmin();
    await setSupplierActiveUseCase(
      supplierRepository,
      idSchema.parse(id),
      isActive,
    );
    revalidateCatalogViews();
  });
}
