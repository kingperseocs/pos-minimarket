"use server";

import { revalidatePath } from "next/cache";
import { setMonthlyGoalUseCase } from "@/application/use-cases/goals/set-monthly-goal";
import { requirePermission } from "@/infrastructure/auth/guards";
import { goalDeps } from "@/infrastructure/deps";
import { runAction } from "./action-result";

export async function setMonthlyGoal(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await setMonthlyGoalUseCase(goalDeps, input, admin.id);
    // The bar lives in the admin header (every page) and at the till.
    revalidatePath("/admin", "layout");
    revalidatePath("/pos");
  });
}
