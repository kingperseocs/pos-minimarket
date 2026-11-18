"use server";

import { revalidatePath } from "next/cache";
import {
  createPromoDiscountUseCase,
  renamePromoDiscountUseCase,
  setPromoDiscountActiveUseCase,
} from "@/application/use-cases/promo-discounts/manage-promo-discounts";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { promoDiscountDeps } from "@/infrastructure/deps";
import { runAction } from "./action-result";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

// The admin list, the audit log and the cashier's discount picker.
function revalidatePromoViews() {
  revalidatePath("/admin", "layout");
  revalidatePath("/pos");
}

export async function createPromoDiscount(input: unknown) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await createPromoDiscountUseCase(promoDiscountDeps, input, admin.id);
    revalidatePromoViews();
  });
}

export async function renamePromoDiscount(input: unknown) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await renamePromoDiscountUseCase(promoDiscountDeps, input, admin.id);
    revalidatePromoViews();
  });
}

export async function setPromoDiscountActive(id: number, isActive: boolean) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await setPromoDiscountActiveUseCase(
      promoDiscountDeps,
      idSchema.parse(id),
      isActive,
      admin.id,
    );
    revalidatePromoViews();
  });
}
