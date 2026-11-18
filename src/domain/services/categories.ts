// Subcategories are one level deep (Galletas → Galletas saladas): the
// cashier picks a main category, then filters by its subcategories. Deeper
// trees would slow down the till.

// Why `parent` can't be the main category of category `id` (null when it
// can). `id` is null for a category being created.
export function categoryParentError(input: {
  id: number | null;
  parent: { id: number; name: string; parentId: number | null };
  hasSubcategories: boolean;
}): string | null {
  const { id, parent, hasSubcategories } = input;
  if (id !== null && parent.id === id) {
    return "Una categoría no puede pertenecer a sí misma";
  }
  if (parent.parentId !== null) {
    return `"${parent.name}" ya es una subcategoría: elige una categoría principal`;
  }
  if (hasSubcategories) {
    return "Esta categoría tiene subcategorías: no puede ser subcategoría de otra";
  }
  return null;
}

// Main categories first (in the given order), each followed by its
// subcategories: the order of the admin list and the product form.
export function groupCategories<T extends { id: number; parentId: number | null }>(
  categories: T[],
): { category: T; depth: 0 | 1 }[] {
  const ids = new Set(categories.map((c) => c.id));
  // A subcategory whose main category isn't in the list shows as main.
  const isMain = (c: T) => c.parentId === null || !ids.has(c.parentId);
  return categories.filter(isMain).flatMap((main) => [
    { category: main, depth: 0 as const },
    ...categories
      .filter((c) => !isMain(c) && c.parentId === main.id)
      .map((category) => ({ category, depth: 1 as const })),
  ]);
}

// The categories that pass a filter, plus the main category of each
// matching subcategory (shown only as context, so the tree still reads
// "Galletas › Galletas saladas"). `contextIds` are those added for context.
export function filterCategoryTree<T extends { id: number; parentId: number | null }>(
  categories: T[],
  matches: (category: T) => boolean,
): { categories: T[]; contextIds: Set<number> } {
  const matched = new Set(categories.filter(matches).map((c) => c.id));
  const contextIds = new Set<number>();
  for (const c of categories) {
    if (matched.has(c.id) && c.parentId !== null && !matched.has(c.parentId)) {
      contextIds.add(c.parentId);
    }
  }
  return {
    categories: categories.filter((c) => matched.has(c.id) || contextIds.has(c.id)),
    contextIds,
  };
}

// A category and its subcategories: filtering products by "Galletas" also
// shows Galletas saladas and Galletas dulces.
export function categoryAndChildren<T extends { id: number; parentId: number | null }>(
  categories: T[],
  id: number,
): Set<number> {
  return new Set([id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)]);
}

// Products of a category as the admin reads them: a main category counts
// its subcategories' too (Bebidas = its own + Gaseosas + Aguas…).
export function categoryTotals<
  T extends { id: number; parentId: number | null; productCount: number; activeProductCount: number },
>(categories: T[]): Map<number, { products: number; active: number; fromChildren: number }> {
  const totals = new Map<number, { products: number; active: number; fromChildren: number }>();
  for (const c of categories) {
    totals.set(c.id, { products: c.productCount, active: c.activeProductCount, fromChildren: 0 });
  }
  for (const c of categories) {
    const parent = c.parentId === null ? undefined : totals.get(c.parentId);
    if (!parent) continue;
    parent.products += c.productCount;
    parent.active += c.activeProductCount;
    parent.fromChildren += c.productCount;
  }
  return totals;
}

// A supplier of a main category also delivers its subcategories: for each
// subcategory, the main category's suppliers it doesn't have on its own.
export function inheritedSuppliers<
  S extends { id: number },
  T extends { id: number; parentId: number | null; suppliers: S[] },
>(categories: T[]): Map<number, S[]> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const inherited = new Map<number, S[]>();
  for (const c of categories) {
    const parent = c.parentId === null ? undefined : byId.get(c.parentId);
    if (!parent) continue;
    const own = new Set(c.suppliers.map((s) => s.id));
    const extra = parent.suppliers.filter((s) => !own.has(s.id));
    if (extra.length > 0) inherited.set(c.id, extra);
  }
  return inherited;
}

// The categories a supplier delivers, including the subcategories of the
// main ones it was assigned.
export function withSubcategories<T extends { id: number; parentId: number | null }>(
  categories: T[],
  ids: number[],
): number[] {
  const set = new Set(ids);
  for (const c of categories) if (c.parentId !== null && set.has(c.parentId)) set.add(c.id);
  return [...set];
}
