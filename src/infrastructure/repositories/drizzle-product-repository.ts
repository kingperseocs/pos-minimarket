import { and, asc, eq, exists, gt, inArray, ne } from "drizzle-orm";
import type { IgvAffectation } from "@/domain/entities/sale-document";
import type { CategoryIcon } from "@/domain/entities/category";
import type { Product, ProductCatalogEntry } from "@/domain/entities/product";
import { tracksExpiry } from "@/domain/services/expiry";
import type { NetUnit } from "@/domain/services/packaging";
import type {
  CreateProductData,
  ProductRepository,
  UpdateProductData,
} from "@/domain/repositories/product-repository";
import { db } from "@/infrastructure/db/client";
import {
  categories,
  locations,
  products,
  stockLevels,
} from "@/infrastructure/db/schema";

type ProductRow = {
  product: typeof products.$inferSelect;
  category: typeof categories.$inferSelect;
};

function toProduct({ product: row, category }: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: category.name,
    categoryIcon: category.icon as CategoryIcon | null,
    priceSale: Number(row.priceSale),
    priceCost: row.priceCost === null ? null : Number(row.priceCost),
    stockQuantity: row.stockQuantity,
    trackStock: row.trackStock,
    tracksExpiryOverride: row.tracksExpiry,
    tracksExpiry: tracksExpiry(row.tracksExpiry, category.tracksExpiry),
    expiryWarningDays: category.expiryWarningDays,
    imageUrl: row.imageUrl,
    netContent: row.netContent === null ? null : Number(row.netContent),
    netContentUnit: row.netContentUnit as NetUnit | null,
    igvAffectation: row.igvAffectation as IgvAffectation,
    isActive: row.isActive,
  };
}

// Every read joins the category: products are always shown with its name,
// and ordered the same way the POS sidebar is.
function selectProducts() {
  return db
    .select({ product: products, category: categories })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id));
}

const order = [
  asc(categories.sortOrder),
  asc(categories.name),
  asc(products.name),
];

export class DrizzleProductRepository implements ProductRepository {
  async findSellable(): Promise<Product[]> {
    const onShopFloor = db
      .select({ productId: stockLevels.productId })
      .from(stockLevels)
      .innerJoin(locations, eq(locations.id, stockLevels.locationId))
      .where(
        and(
          eq(stockLevels.productId, products.id),
          eq(locations.kind, "store"),
          gt(stockLevels.quantity, 0),
        ),
      );
    const rows = await selectProducts()
      .where(
        and(
          eq(products.isActive, true),
          eq(categories.isActive, true),
          exists(onShopFloor),
        ),
      )
      .orderBy(...order);

    return rows.map(toProduct);
  }

  async findAll(): Promise<Product[]> {
    const rows = await selectProducts().orderBy(...order);

    return rows.map(toProduct);
  }

  async findById(id: number): Promise<Product | null> {
    const [row] = await selectProducts()
      .where(eq(products.id, id))
      .limit(1);

    return row ? toProduct(row) : null;
  }

  async create(data: CreateProductData): Promise<number> {
    const [row] = await db.insert(products).values({
      name: data.name,
      barcode: data.barcode,
      description: data.description,
      categoryId: data.categoryId,
      priceSale: data.priceSale.toString(),
      priceCost: data.priceCost?.toString() ?? null,
      tracksExpiry: data.tracksExpiry,
      imageUrl: data.imageUrl ?? null,
      netContent: data.netContent?.toString() ?? null,
      netContentUnit: data.netContentUnit,
      igvAffectation: data.igvAffectation,
    }).returning({ id: products.id });
    return row.id;
  }

  async update(data: UpdateProductData): Promise<void> {
    await db
      .update(products)
      .set({
        name: data.name,
        barcode: data.barcode,
        description: data.description,
        categoryId: data.categoryId,
        priceSale: data.priceSale.toString(),
        priceCost: data.priceCost?.toString() ?? null,
        tracksExpiry: data.tracksExpiry,
        imageUrl: data.imageUrl,
        netContent: data.netContent?.toString() ?? null,
        netContentUnit: data.netContentUnit,
        igvAffectation: data.igvAffectation,
        updatedAt: new Date(),
      })
      .where(eq(products.id, data.id));
  }

  async setActive(id: number, isActive: boolean): Promise<void> {
    await db
      .update(products)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(products.id, id));
  }

  async existsByBarcode(barcode: string, excludeId?: number) {
    const sameCode = eq(products.barcode, barcode);
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(excludeId ? and(sameCode, ne(products.id, excludeId)) : sameCode)
      .limit(1);
    return row !== undefined;
  }

  async isImageInUse(imageUrl: string): Promise<boolean> {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.imageUrl, imageUrl))
      .limit(1);

    return row !== undefined;
  }

  async findCatalogByIds(ids: number[]): Promise<Map<number, ProductCatalogEntry>> {
    if (ids.length === 0) return new Map();

    const rows = await db
      .select({
        id: products.id,
        priceSale: products.priceSale,
      })
      .from(products)
      .where(inArray(products.id, ids));

    return new Map(rows.map((row) => [row.id, { price: Number(row.priceSale) }]));
  }
}
