import { PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { listActiveCategoriesUseCase } from "@/application/use-cases/categories/list-categories";
import { listSuppliersUseCase } from "@/application/use-cases/suppliers/save-supplier";
import { PageHeader } from "@/components/admin/page-header";
import { SupplierForm } from "@/components/admin/suppliers/supplier-form";
import { SupplierTable } from "@/components/admin/suppliers/supplier-table";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import {
  ClearFilters,
  FilterBar,
  SearchFilter,
  SelectFilter,
  StatusFilter,
} from "@/components/admin/table-filters";
import {
  categoryRepository,
  supplierRepository,
} from "@/infrastructure/repositories";
import { groupCategories, withSubcategories } from "@/domain/services/categories";
import {
  matchesQuery,
  matchesStatus,
  paramText,
  parseId,
  parseStatus,
} from "@/lib/table-filters";

type Filters = { q: string; categoryId: number | null; status: ReturnType<typeof parseStatus> };

async function SuppliersContent({ filters }: { filters: Filters }) {
  const [suppliers, categories] = await Promise.all([
    listSuppliersUseCase(supplierRepository),
    listActiveCategoriesUseCase(categoryRepository),
  ]);
  const options = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    parentId: c.parentId,
  }));
  const filtering = filters.q !== "" || filters.categoryId !== null || filters.status !== null;
  const visible = suppliers.filter(
    (s) =>
      matchesQuery(filters.q, s.ruc, s.businessName, s.tradeName) &&
      // A supplier of the main category also delivers its subcategories.
      (filters.categoryId === null ||
        withSubcategories(
          options,
          s.categories.map((c) => c.id),
        ).includes(filters.categoryId)) &&
      matchesStatus(filters.status, s.isActive),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proveedores"
        description="Empresas a las que compras y las categorías que te traen."
        action={
          <SupplierForm
            categories={options}
            trigger={
              <Button>
                <PlusIcon data-icon="inline-start" />
                Nuevo proveedor
              </Button>
            }
          />
        }
      />
      {suppliers.length > 0 && (
        <FilterBar>
          <SearchFilter placeholder="Buscar por RUC o nombre" />
          <SelectFilter
            param="categoria"
            label="Filtrar por categoría"
            allLabel="Todas las categorías"
            options={groupCategories(options).map(({ category: c, depth }) => ({
              value: String(c.id),
              label: c.name,
              hint: depth === 1 ? `en ${options.find((p) => p.id === c.parentId)?.name}` : undefined,
              indent: depth === 1,
            }))}
          />
          <StatusFilter />
          <ClearFilters href="/admin/suppliers" active={filtering} />
        </FilterBar>
      )}
      <SupplierTable
        key={JSON.stringify(filters)}
        suppliers={visible}
        categories={options}
        emptyMessage={filtering ? "Ningún proveedor coincide con estos filtros." : undefined}
      />
    </div>
  );
}

export default async function AdminSuppliersPage({
  searchParams,
}: PageProps<"/admin/suppliers">) {
  const params = await searchParams;
  const filters: Filters = {
    q: paramText(params.q),
    categoryId: parseId(params.categoria),
    status: parseStatus(params.estado),
  };
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SuppliersContent filters={filters} />
    </Suspense>
  );
}
