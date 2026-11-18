// What the Almacén needs while a supplier's truck is being unloaded.

// The pack a product usually arrives in from its supplier: the one with the
// supplier's catalog code (Paquete x4 · 801234), else the biggest pack, else
// the loose unit (null).
export function defaultPresentation<
  P extends { id: number; unitsTotal: number; supplierCode: string | null },
>(presentations: P[]): P | null {
  const coded = presentations.filter((p) => p.supplierCode);
  const pool = coded.length > 0 ? coded : presentations;
  if (pool.length === 0) return null;
  return pool.reduce((best, p) => (p.unitsTotal > best.unitsTotal ? p : best));
}

// The products a supplier brings: those of the categories it delivers plus
// any already bought from it (a distributor may bring something outside its
// usual categories). Its usual products keep the catalog's order.
export function supplierCatalog<P extends { id: number; categoryId: number }>(
  products: P[],
  supplierCategoryIds: number[],
  boughtProductIds: number[],
): P[] {
  const categories = new Set(supplierCategoryIds);
  const bought = new Set(boughtProductIds);
  return products.filter((p) => categories.has(p.categoryId) || bought.has(p.id));
}
