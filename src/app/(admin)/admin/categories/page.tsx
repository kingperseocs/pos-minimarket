import { PlusIcon, SproutIcon } from "lucide-react";
import { Suspense } from "react";
import { listCategoriesWithCountsUseCase } from "@/application/use-cases/categories/list-categories";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { CategoryTable } from "@/components/admin/categories/category-table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import {
  ClearFilters,
  FilterBar,
  SearchFilter,
  SelectFilter,
  StatusFilter,
} from "@/components/admin/table-filters";
import { listSuppliersUseCase } from "@/application/use-cases/suppliers/save-supplier";
import {
  categoryTotals,
  filterCategoryTree,
  inheritedSuppliers,
} from "@/domain/services/categories";
import { categoryRepository, supplierRepository } from "@/infrastructure/repositories";
import {
  matchesQuery,
  matchesStatus,
  paramText,
  parseId,
  parseStatus,
} from "@/lib/table-filters";

type Filters = { q: string; supplierId: number | null; products: string; status: ReturnType<typeof parseStatus> };

async function CategoriesContent({ filters }: { filters: Filters }) {
  const [categories, allSuppliers] = await Promise.all([
    listCategoriesWithCountsUseCase(categoryRepository),
    listSuppliersUseCase(supplierRepository),
  ]);
  const suppliers = allSuppliers
    .filter((s) => s.isActive)
    .map((s) => ({
      id: s.id,
      name: s.tradeName ?? s.businessName,
      categoryIds: s.categories.map((c) => c.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // A main category counts its subcategories' products; a subcategory is
  // delivered by its main category's suppliers too.
  const totals = categoryTotals(categories);
  const inherited = inheritedSuppliers<{ id: number; name: string }, (typeof categories)[number]>(
    categories,
  );
  const deliveredBy = (c: (typeof categories)[number], supplierId: number) =>
    c.suppliers.some((s) => s.id === supplierId) ||
    (inherited.get(c.id) ?? []).some((s) => s.id === supplierId);
  const productsOf = (id: number) => totals.get(id)?.products ?? 0;
  const filtering =
    filters.q !== "" ||
    filters.supplierId !== null ||
    filters.products !== "" ||
    filters.status !== null;
  const tree = filterCategoryTree(
    categories,
    (c) =>
      matchesQuery(filters.q, c.name) &&
      (filters.supplierId === null || deliveredBy(c, filters.supplierId)) &&
      (filters.products === "con"
        ? productsOf(c.id) > 0
        : filters.products === "sin"
          ? productsOf(c.id) === 0
          : true) &&
      matchesStatus(filters.status, c.isActive),
  );
  const nextSortOrder =
    categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
  const mainCategories = categories
    .filter((c) => c.parentId === null)
    .map(({ id, name }) => ({ id, name }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categorías"
        description="Organiza los productos que se muestran en caja."
        action={
          <CategoryForm
            nextSortOrder={nextSortOrder}
            mainCategories={mainCategories}
            trigger={
              <Button>
                <PlusIcon data-icon="inline-start" />
                Nueva categoría
              </Button>
            }
          />
        }
      />
      {categories.length === 0 ? (
        <EmptyState
          icon={SproutIcon}
          title="Tu tienda está lista para empezar"
          description="Crea tu primera categoría, por ejemplo Bebidas o Snacks. Después podrás asignarle proveedores y registrar sus productos."
          action={
            <CategoryForm
              nextSortOrder={nextSortOrder}
              mainCategories={mainCategories}
              trigger={
                <Button>
                  <PlusIcon data-icon="inline-start" />
                  Crear mi primera categoría
                </Button>
              }
            />
          }
        />
      ) : (
        <>
          <FilterBar>
            <SearchFilter placeholder="Buscar categoría" />
            <SelectFilter
              param="proveedor"
              label="Filtrar por proveedor"
              allLabel="Todos los proveedores"
              options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
            />
            <SelectFilter
              param="productos"
              label="Filtrar por productos"
              allLabel="Con y sin productos"
              options={[
                { value: "con", label: "Con productos" },
                { value: "sin", label: "Sin productos" },
              ]}
              className="sm:w-44"
            />
            <StatusFilter />
            <ClearFilters href="/admin/categories" active={filtering} />
          </FilterBar>
          <CategoryTable
            key={JSON.stringify(filters)}
            categories={categories}
            suppliers={suppliers}
            visibleIds={filtering ? tree.categories.map((c) => c.id) : undefined}
            contextIds={[...tree.contextIds]}
            emptyMessage="Ninguna categoría coincide con estos filtros."
          />
        </>
      )}
    </div>
  );
}

export default async function AdminCategoriesPage({
  searchParams,
}: PageProps<"/admin/categories">) {
  const params = await searchParams;
  const products = paramText(params.productos);
  const filters: Filters = {
    q: paramText(params.q),
    supplierId: parseId(params.proveedor),
    products: products === "con" || products === "sin" ? products : "",
    status: parseStatus(params.estado),
  };
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CategoriesContent filters={filters} />
    </Suspense>
  );
}
