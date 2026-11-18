import type { NetUnit } from "../services/packaging";
import type { CategoryIcon } from "./category";

// priceCost/stockQuantity/trackStock exist for a future inventory phase and
// are unused by any phase-1 use case.
export interface Product {
  id: number;
  sku: string | null;
  // Printed on the unit; boxes/displays carry theirs in presentations.
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: CategoryIcon | null;
  priceSale: number;
  priceCost: number | null;
  stockQuantity: number | null;
  trackStock: boolean;
  // Set on the product itself; null = follow the category.
  tracksExpiryOverride: boolean | null;
  // Effective: the override, or else the category's setting.
  tracksExpiry: boolean;
  expiryWarningDays: number;
  imageUrl: string | null;
  // One unit's content, as in the catalog ("31.5 g"); null = not entered.
  netContent: number | null;
  netContentUnit: NetUnit | null;
  isActive: boolean;
}

// What the server re-prices a sale against: today's catalog price.
export interface ProductCatalogEntry {
  price: number;
}
