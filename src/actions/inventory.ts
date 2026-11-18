"use server";

import { revalidatePath } from "next/cache";
import { countStockUseCase } from "@/application/use-cases/inventory/count-stock";
import {
  reviewCountUseCase,
  submitDailyCountUseCase,
} from "@/application/use-cases/inventory/daily-count";
import { resolveDiscrepancyUseCase } from "@/application/use-cases/inventory/discrepancies";
import {
  markReceiptPaidUseCase,
  markReceiptUnpaidUseCase,
} from "@/application/use-cases/inventory/receipt-payment";
import { receiveGoodsUseCase } from "@/application/use-cases/inventory/receive-goods";
import { receiveShipmentUseCase } from "@/application/use-cases/inventory/receive-shipment";
import { registerInvoiceUseCase } from "@/application/use-cases/inventory/register-invoice";
import { transferStockUseCase } from "@/application/use-cases/inventory/transfer-stock";
import { requirePermission } from "@/infrastructure/auth/guards";
import {
  auditRepository,
  dailyCountRepository,
  inventoryRepository,
  presentationRepository,
  productRepository,
  receivingRepository,
  supplierRepository,
} from "@/infrastructure/repositories";
import { runAction, runDataAction } from "./action-result";

// Counting/adjusting is the admin's; receiving and transfers are open to
// the warehouse keeper too (the admin has every permission).
async function requireAdmin() {
  return (await requirePermission("manage")).id;
}

async function requireStock() {
  return (await requirePermission("stock")).id;
}

export async function countStock(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireAdmin();
    const result = await countStockUseCase(
      { inventory: inventoryRepository, products: productRepository },
      input,
      actorId,
    );

    revalidatePath("/admin", "layout");
    revalidatePath("/pos");
    return result;
  });
}

// Stock moved: inventory, products (stock and average cost), the till's
// catalog and the dashboard steps all change.
function revalidateStockViews() {
  revalidatePath("/admin", "layout");
  revalidatePath("/almacen", "layout");
  revalidatePath("/pos");
}

// The admin's one-step receipt: what arrived and its invoice together.
export async function receiveGoods(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireAdmin();
    const result = await receiveGoodsUseCase(
      {
        receiving: receivingRepository,
        products: productRepository,
        presentations: presentationRepository,
        suppliers: supplierRepository,
        audit: auditRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    revalidatePath("/admin/audit");
    return result;
  });
}

// Step 1, by the Almacén: what arrived, counted, without prices.
export async function receiveShipment(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireStock();
    const result = await receiveShipmentUseCase(
      {
        receiving: receivingRepository,
        products: productRepository,
        presentations: presentationRepository,
        audit: auditRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    return result;
  });
}

// Step 2, by the admin: the supplier's invoice over a reception.
export async function registerInvoice(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireAdmin();
    const result = await registerInvoiceUseCase(
      {
        receiving: receivingRepository,
        products: productRepository,
        presentations: presentationRepository,
        suppliers: supplierRepository,
        audit: auditRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    revalidatePath("/admin/audit");
    return result;
  });
}

export async function transferStock(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireStock();
    const result = await transferStockUseCase(
      {
        receiving: receivingRepository,
        inventory: inventoryRepository,
        presentations: presentationRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    return result;
  });
}

export async function resolveDiscrepancy(input: unknown) {
  return runAction(async () => {
    const actorId = await requireAdmin();
    await resolveDiscrepancyUseCase(receivingRepository, input, actorId);
    revalidateStockViews();
  });
}

export async function submitDailyCount(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireStock();
    const result = await submitDailyCountUseCase(
      {
        counts: dailyCountRepository,
        products: productRepository,
        inventory: inventoryRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    return result;
  });
}

export async function reviewCount(input: unknown) {
  return runAction(async () => {
    const actorId = await requireAdmin();
    await reviewCountUseCase(dailyCountRepository, input, actorId);
    revalidateStockViews();
  });
}

// The supplier's invoice of a receipt was paid / back to unpaid (admin
// only, audited).
export async function markReceiptPaid(input: unknown) {
  return runAction(async () => {
    const actorId = await requireAdmin();
    await markReceiptPaidUseCase(
      { receiving: receivingRepository, audit: auditRepository },
      input,
      actorId,
    );
    revalidatePath("/admin/inventory/ingresos");
    revalidatePath("/admin/audit");
  });
}

export async function markReceiptUnpaid(receiptId: number) {
  return runAction(async () => {
    const actorId = await requireAdmin();
    await markReceiptUnpaidUseCase(
      { receiving: receivingRepository, audit: auditRepository },
      receiptId,
      actorId,
    );
    revalidatePath("/admin/inventory/ingresos");
    revalidatePath("/admin/audit");
  });
}
