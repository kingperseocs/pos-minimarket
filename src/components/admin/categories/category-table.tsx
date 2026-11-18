"use client";

import { PencilIcon, RotateCcwIcon, Trash2Icon, TruckIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setCategoryActive } from "@/actions/categories";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  createAlertDialogHandle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { createDialogHandle } from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { CategoryWithCounts } from "@/domain/entities/category";
import {
  categoryTotals,
  groupCategories,
  inheritedSuppliers,
} from "@/domain/services/categories";
import { cn } from "@/lib/utils";
import { usePagination } from "@/hooks/use-pagination";
import { DataTable, ID_COLUMN, IdCell } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";
import { RowActions } from "../row-actions";
import { StatusBadge } from "../status-badge";
import { CategoryForm } from "./category-form";
import { CategorySuppliersDialog, type SupplierChoice } from "./category-suppliers-dialog";

const COLUMNS = [
  ID_COLUMN,
  { label: "Orden", className: "w-16 text-right" },
  { label: "Categoría" },
  { label: "Productos" },
  { label: "Proveedores" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

export function CategoryTable({
  categories,
  suppliers,
  visibleIds,
  contextIds = [],
  emptyMessage = "Aún no hay categorías. Crea la primera para empezar a agregar productos.",
}: {
  // All of them: the edit form needs every main category.
  categories: CategoryWithCounts[];
  // Active suppliers, to assign them from a category.
  suppliers: SupplierChoice[];
  // What the filters leave (all when undefined).
  visibleIds?: number[];
  // Main categories shown only so a matching subcategory keeps its context.
  contextIds?: number[];
  emptyMessage?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const visible = visibleIds
    ? categories.filter((c) => visibleIds.includes(c.id))
    : categories;
  // Each subcategory right below its main category.
  const grouped = groupCategories(visible);
  const pagination = usePagination(grouped);
  const mainCategories = categories
    .filter((c) => c.parentId === null)
    .map(({ id, name }) => ({ id, name }));
  const parentIds = new Set(categories.map((c) => c.parentId));
  // A main category counts its subcategories' products, and its suppliers
  // also deliver them.
  const totals = categoryTotals(categories);
  const inherited = inheritedSuppliers<{ id: number; name: string }, CategoryWithCounts>(
    categories,
  );
  const parentName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "";

  function toggle(category: CategoryWithCounts) {
    startTransition(async () => {
      const result = await setCategoryActive(category.id, !category.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        category.isActive
          ? `${category.name} desactivada`
          : `${category.name} activada`,
      );
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={visible.length === 0}
      emptyMessage={emptyMessage}
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="categorías"
        />
      }
    >
      {pagination.rows.map(({ category, depth }) => (
        <CategoryRow
          key={category.id}
          category={category}
          depth={depth}
          total={totals.get(category.id) ?? { products: 0, active: 0, fromChildren: 0 }}
          inherited={inherited.get(category.id) ?? []}
          parentName={parentName(category.parentId)}
          isContext={contextIds.includes(category.id)}
          suppliers={suppliers}
          mainCategories={mainCategories}
          hasSubcategories={parentIds.has(category.id)}
          disabled={isPending}
          onToggle={() => toggle(category)}
        />
      ))}
    </DataTable>
  );
}

function CategoryRow({
  category,
  depth,
  total,
  inherited,
  parentName,
  isContext,
  suppliers,
  mainCategories,
  hasSubcategories,
  disabled,
  onToggle,
}: {
  category: CategoryWithCounts;
  depth: 0 | 1;
  total: { products: number; active: number; fromChildren: number };
  inherited: { id: number; name: string }[];
  parentName: string;
  isContext: boolean;
  suppliers: SupplierChoice[];
  mainCategories: { id: number; name: string }[];
  hasSubcategories: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [editDialog] = useState(createDialogHandle);
  const [suppliersDialog] = useState(createDialogHandle);
  const [confirmDialog] = useState(createAlertDialogHandle);
  const noSuppliers = category.suppliers.length === 0 && inherited.length === 0;

  return (
    <TableRow className={cn(isContext && "opacity-55")}>
      <IdCell id={category.id} />
      <TableCell className="text-right text-muted-foreground tabular-nums">
        {category.sortOrder}
      </TableCell>
      <TableCell>
        <div className={cn("flex items-center gap-3", depth === 1 && "pl-8")}>
          {depth === 1 && (
            <span aria-hidden className="-ml-5 text-muted-foreground">
              └
            </span>
          )}
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CategoryGlyph icon={category.icon} className="size-5" />
          </span>
          <div className="leading-tight">
            <div className="font-medium">{category.name}</div>
            {category.tracksExpiry && (
              <div className="text-xs text-muted-foreground">
                Vence · avisa {category.expiryWarningDays} días antes
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {total.products === 0 ? (
          <span className="text-muted-foreground">Sin productos</span>
        ) : (
          <Link
            href={`/admin/products?categoria=${category.id}`}
            className="group inline-flex flex-col leading-tight"
          >
            <span className="font-medium tabular-nums group-hover:underline">
              {total.products} {total.products === 1 ? "producto" : "productos"}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {total.fromChildren > 0
                ? total.fromChildren === total.products
                  ? "en subcategorías"
                  : `${total.fromChildren} en subcategorías`
                : `${total.active} ${total.active === 1 ? "activo" : "activos"}`}{" "}
              · Ver productos
            </span>
          </Link>
        )}
      </TableCell>
      <TableCell className="max-w-56">
        {noSuppliers ? (
          <button
            type="button"
            onClick={() => suppliersDialog.open(null)}
            className="text-xs text-primary hover:underline"
          >
            Sin proveedor · Asignar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => suppliersDialog.open(null)}
            title="Cambiar proveedores"
            className="flex flex-wrap gap-1 rounded-md text-left hover:opacity-80"
          >
            {category.suppliers.map((supplier) => (
              <Badge key={supplier.id} variant="outline">
                {supplier.name}
              </Badge>
            ))}
            {inherited.map((supplier) => (
              <Badge
                key={`inherited-${supplier.id}`}
                variant="outline"
                className="border-dashed font-normal text-muted-foreground"
              >
                {supplier.name} · por {parentName}
              </Badge>
            ))}
          </button>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge active={category.isActive} />
      </TableCell>
      <TableCell>
        <RowActions label={category.name} disabled={disabled}>
          <DropdownMenuItem onClick={() => editDialog.open(null)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => suppliersDialog.open(null)}>
            <TruckIcon />
            Proveedores
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {!category.isActive ? (
            <DropdownMenuItem onClick={onToggle}>
              <RotateCcwIcon />
              Activar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              // Deactivating hides its products (and its subcategories') from
              // the POS: confirm first.
              onClick={total.active === 0 ? onToggle : () => confirmDialog.open(null)}
            >
              <Trash2Icon />
              Desactivar
            </DropdownMenuItem>
          )}
        </RowActions>
        <CategoryForm
          category={category}
          mainCategories={mainCategories}
          hasSubcategories={hasSubcategories}
          handle={editDialog}
        />
        <CategorySuppliersDialog
          handle={suppliersDialog}
          category={{
            id: category.id,
            name: category.name,
            parentId: category.parentId,
            supplierIds: category.suppliers.map((s) => s.id),
          }}
          suppliers={suppliers}
        />
        <AlertDialog handle={confirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desactivar {category.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {total.active === 1
                  ? "1 producto activo dejará"
                  : `${total.active} productos activos dejarán`}{" "}
                de aparecer en caja hasta que vuelvas a activar la categoría. No
                se borra nada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={onToggle}
              >
                Desactivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
