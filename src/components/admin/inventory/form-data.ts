import { listActiveCategoriesUseCase } from "@/application/use-cases/categories/list-categories";
import { getInventoryUseCase } from "@/application/use-cases/inventory/get-inventory";
import { listAllProductsUseCase } from "@/application/use-cases/products/list-products";
import { listPresentationsUseCase } from "@/application/use-cases/products/save-presentation";
import { listSuppliersUseCase } from "@/application/use-cases/suppliers/save-supplier";
import {
  categoryRepository,
  inventoryRepository,
  presentationRepository,
  productRepository,
  receivingRepository,
  supplierRepository,
} from "@/infrastructure/repositories";
import type {
  ReceiptPresentationOption,
  ReceiptProductOption,
  ReceiptSupplierOption,
} from "./receipt-form";
import type { TransferProductOption } from "./transfer-form";


// The Almacén's reception screen: the shared data without prices, plus what
// was already bought from each supplier.
export async function loadReceptionData() {
  const [data, supplierProductIds, categories] = await Promise.all([
    loadReceiptFormData({ withPrices: false }),
    receivingRepository.productIdsBySupplier(),
    listActiveCategoriesUseCase(categoryRepository),
  ]);
  return {
    ...data,
    supplierProductIds,
    categories: categories.map((c) => ({ id: c.id, parentId: c.parentId })),
  };
}

// Shared by the admin and the warehouse screens. The Almacén only counts
// what arrives: it gets no prices.
export async function loadReceiptFormData(
  { withPrices = true }: { withPrices?: boolean } = {},
): Promise<{
  products: ReceiptProductOption[];
  presentations: ReceiptPresentationOption[];
  suppliers: ReceiptSupplierOption[];
}> {
  const [products, presentations, suppliers] = await Promise.all([
    listAllProductsUseCase(productRepository),
    listPresentationsUseCase(presentationRepository),
    listSuppliersUseCase(supplierRepository),
  ]);
  return {
    products: products
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        tracksExpiry: p.tracksExpiry,
        barcode: p.barcode,
        imageUrl: p.imageUrl,
        ...(withPrices ? { priceSale: p.priceSale } : {}),
      })),
    presentations: presentations
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        productId: p.productId,
        name: p.name,
        unitsTotal: p.unitsTotal,
        barcode: p.barcode,
        supplierCode: p.supplierCode,
      })),
    suppliers: suppliers
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        name: s.tradeName ?? s.businessName,
        categoryIds: s.categories.map((c) => c.id),
      })),
  };
}

// Only what is physically in the Almacén can be moved.
export async function loadTransferFormData(): Promise<TransferProductOption[]> {
  const [{ locations, stock }, presentations, products] = await Promise.all([
    getInventoryUseCase(inventoryRepository),
    listPresentationsUseCase(presentationRepository),
    listAllProductsUseCase(productRepository),
  ]);
  const unitCodes = new Map(products.map((p) => [p.id, p.barcode]));
  const warehouseId = locations.find((l) => l.kind === "warehouse")?.id;
  if (warehouseId === undefined) return [];
  const storeId = locations.find((l) => l.kind === "store")?.id;
  return stock
    .filter((s) => s.isActive && (s.byLocation[warehouseId] ?? 0) > 0)
    .map((s) => ({
      id: s.productId,
      name: s.productName,
      available: s.byLocation[warehouseId],
      inStore: storeId === undefined ? 0 : (s.byLocation[storeId] ?? 0),
      barcode: unitCodes.get(s.productId) ?? null,
      presentations: presentations
        .filter((p) => p.productId === s.productId && p.isActive)
        .map((p) => ({
          id: p.id,
          name: p.name,
          unitsTotal: p.unitsTotal,
          barcode: p.barcode,
        })),
    }));
}
