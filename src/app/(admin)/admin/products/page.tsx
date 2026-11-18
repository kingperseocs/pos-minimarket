import { PackageOpenIcon, PlusIcon, TagsIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listCategoriesWithCountsUseCase } from "@/application/use-cases/categories/list-categories";
import { getInventoryUseCase } from "@/application/use-cases/inventory/get-inventory";
import { listAllProductsUseCase } from "@/application/use-cases/products/list-products";
import { listPresentationsUseCase } from "@/application/use-cases/products/save-presentation";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  ClearFilters,
  FilterBar,
  SearchFilter,
  SelectFilter,
  StatusFilter,
} from "@/components/admin/table-filters";
import { categoryAndChildren, groupCategories } from "@/domain/services/categories";
import {
  matchesQuery,
  matchesStatus,
  paramText,
  parseId,
  parseStatus,
} from "@/lib/table-filters";

type Filters = { q: string; categoryId: number | null; status: ReturnType<typeof parseStatus> };
import {
  type CategoryOption,
  ProductForm,
} from "@/components/admin/product-form";
import { ProductTable } from "@/components/admin/product-table";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import {
  categoryRepository,
  inventoryRepository,
  presentationRepository,
  productRepository,
} from "@/infrastructure/repositories";

async function ProductsContent({ filters }: { filters: Filters }) {
  const [products, categories, inventory, presentations] = await Promise.all([
    listAllProductsUseCase(productRepository),
    listCategoriesWithCountsUseCase(categoryRepository),
    getInventoryUseCase(inventoryRepository),
    listPresentationsUseCase(presentationRepository),
  ]);
  // Total units across Almacén + Tienda; null until the first count.
  const stockById = new Map(
    inventory.stock.map((s) => [s.productId, s.trackStock ? s.total : null]),
  );

  const options: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    icon: c.icon,
    isActive: c.isActive,
    tracksExpiry: c.tracksExpiry,
  }));
  // Unknown ids (stale link, deleted row) just show everything. A main
  // category includes its subcategories.
  const selected = options.find((c) => c.id === filters.categoryId) ?? null;
  const inCategory = selected ? categoryAndChildren(options, selected.id) : null;
  const codesOf = (productId: number) =>
    presentations.filter((x) => x.productId === productId).map((x) => x.supplierCode);
  const filtering = filters.q !== "" || selected !== null || filters.status !== null;
  const visible = products.filter(
    (p) =>
      (inCategory === null || inCategory.has(p.categoryId)) &&
      matchesStatus(filters.status, p.isActive) &&
      matchesQuery(filters.q, p.name, p.barcode, p.description, ...codesOf(p.id)),
  );

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Productos" description="Catálogo de tu tienda." />
        <EmptyState
          icon={TagsIcon}
          title="Primero crea una categoría"
          description="Cada producto pertenece a una categoría (Bebidas, Snacks…). Crea al menos una y vuelve aquí para registrar tus productos."
          action={
            <Button
              nativeButton={false}
              render={<Link href="/admin/categories" />}
            >
              Ir a Categorías
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={selected ? `Productos · ${selected.name}` : "Productos"}
        description={
          filtering
            ? `${visible.length} de ${products.length} productos.`
            : "Catálogo de productos disponibles en caja."
        }
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ProductForm
              categories={options}
              defaultCategoryId={selected?.id}
              trigger={
                <Button>
                  <PlusIcon data-icon="inline-start" />
                  Nuevo Producto
                </Button>
              }
            />
          </div>
        }
      />
      {products.length === 0 && (
        <EmptyState
          icon={PackageOpenIcon}
          title="Aún no hay productos"
          description="Registra el primero con su precio de compra y de venta. Aparecerá en caja cuando tenga stock en la Tienda."
          action={
            <ProductForm
              categories={options}
              trigger={
                <Button>
                  <PlusIcon data-icon="inline-start" />
                  Registrar mi primer producto
                </Button>
              }
            />
          }
        />
      )}
      {products.length > 0 && (
        <FilterBar>
          <SearchFilter placeholder="Buscar por nombre o código" />
          <SelectFilter
            param="categoria"
            aliases={["category"]}
            label="Filtrar por categoría"
            allLabel="Todas las categorías"
            options={groupCategories(options).map(({ category: c, depth }) => ({
              value: String(c.id),
              label: c.isActive ? c.name : `${c.name} (inactiva)`,
              hint: depth === 1 ? `en ${options.find((p) => p.id === c.parentId)?.name}` : undefined,
              indent: depth === 1,
            }))}
          />
          <StatusFilter />
          <ClearFilters href="/admin/products" active={filtering} />
        </FilterBar>
      )}
      {products.length > 0 && (
        <ProductTable
          // Remount on filter change so pagination starts again at page 1.
          key={JSON.stringify(filters)}
          emptyMessage={filtering ? "Ningún producto coincide con estos filtros." : undefined}
          categories={options}
          products={visible.map((p) => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            description: p.description,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
            categoryIcon: p.categoryIcon,
            priceSale: p.priceSale.toString(),
            priceCost: p.priceCost === null ? null : p.priceCost.toString(),
            tracksExpiry: p.tracksExpiryOverride,
            stock: stockById.get(p.id) ?? null,
            presentations: presentations.filter((x) => x.productId === p.id),
            imageUrl: p.imageUrl,
            netContent: p.netContent === null ? null : String(p.netContent),
            netContentUnit: p.netContentUnit,
            isActive: p.isActive,
          }))}
        />
      )}
    </div>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  const params = await searchParams;
  const filters: Filters = {
    q: paramText(params.q),
    // ?category= is the old name, kept for links made before.
    categoryId: parseId(params.categoria ?? params.category),
    status: parseStatus(params.estado),
  };

  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductsContent filters={filters} />
    </Suspense>
  );
}
