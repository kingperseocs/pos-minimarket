import { redirect } from "next/navigation";
import { listActiveCategoriesUseCase } from "@/application/use-cases/categories/list-categories";
import { getExpiringLotsUseCase } from "@/application/use-cases/inventory/get-inventory";
import { listSellableProductsUseCase } from "@/application/use-cases/products/list-products";
import { listPresentationsUseCase } from "@/application/use-cases/products/save-presentation";
import { listActivePromoDiscountsUseCase } from "@/application/use-cases/promo-discounts/manage-promo-discounts";
import { PosScreen } from "@/components/pos/pos-screen";
import { auth } from "@/infrastructure/auth";
import {
  categoryRepository,
  inventoryRepository,
  presentationRepository,
  productRepository,
  promoDiscountRepository,
} from "@/infrastructure/repositories";

export default async function PosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [products, categories, expiring, presentations, promoDiscounts] = await Promise.all([
    listSellableProductsUseCase(productRepository),
    listActiveCategoriesUseCase(categoryRepository),
    getExpiringLotsUseCase(inventoryRepository),
    listPresentationsUseCase(presentationRepository),
    listActivePromoDiscountsUseCase(promoDiscountRepository),
  ]);
  // What the cashier can act on: lots on the shop floor.
  const shelfExpiry = expiring.lots
    .filter((lot) => lot.locationKind === "store")
    .map((lot) => ({
      productId: lot.productId,
      productName: lot.productName,
      quantity: lot.quantity,
      expiresAt: lot.expiresAt,
      warningDays: lot.warningDays,
    }));

  return (
    <PosScreen
      cashierId={session.user.id}
      shelfExpiry={shelfExpiry}
      // Boxes and displays: scanned by mistake at the till, they are
      // recognized and the cashier is told to charge the unit instead.
      boxCodes={presentations
        .filter((p) => p.isActive && p.barcode)
        .map((p) => ({ id: p.id, productId: p.productId, barcode: p.barcode, name: p.name }))}
      catalogAt={new Date().toISOString()}
      // Every active category, in the admin's order — even the ones with
      // nothing on the shop floor yet.
      categories={categories.map((c) => ({
        value: c.id,
        label: c.name,
        icon: c.icon,
        parentId: c.parentId,
      }))}
      promoDiscounts={promoDiscounts.map((d) => ({
        id: d.id,
        name: d.name,
        percent: d.percent,
      }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        categoryIcon: p.categoryIcon,
        priceSale: p.priceSale,
        imageUrl: p.imageUrl,
      }))}
    />
  );
}
