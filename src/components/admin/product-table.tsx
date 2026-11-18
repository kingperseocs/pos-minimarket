"use client";

import { BoxesIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deactivateProduct, reactivateProduct } from "@/actions/products";
import { Badge } from "@/components/ui/badge";
import { createDialogHandle } from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import { ProductImagePlaceholder } from "@/components/pos/product-image-placeholder";
import type { Presentation } from "@/domain/entities/presentation";
import { productMargin } from "@/domain/services/product-margin";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DataTable, ID_COLUMN, IdCell } from "./data-table";
import { DataTablePagination } from "./data-table-pagination";
import { PresentationsDialog } from "./presentations-dialog";
import { type CategoryOption, ProductForm } from "./product-form";
import { RowActions } from "./row-actions";
import { StatusBadge } from "./status-badge";
import { formatNetContent, type NetUnit } from "@/domain/services/packaging";

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  description: string | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  priceSale: string;
  priceCost: string | null;
  tracksExpiry: boolean | null;
  // Units across all locations; null = stock not tracked yet (no count).
  stock: number | null;
  presentations: Presentation[];
  imageUrl: string | null;
  netContent: string | null;
  netContentUnit: NetUnit | null;
  isActive: boolean;
};

// The supplier's codes of its active packs (800436, 800186).
function supplierCodes(product: { presentations: Presentation[] }) {
  return product.presentations
    .filter((p) => p.isActive && p.supplierCode)
    .map((p) => p.supplierCode as string);
}

const COLUMNS = [
  ID_COLUMN,
  { label: "Producto" },
  { label: "Categoría" },
  { label: "P. compra", className: "text-right" },
  { label: "P. venta", className: "text-right" },
  { label: "Utilidad", className: "text-right" },
  { label: "Stock", className: "text-right" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

export function ProductTable({
  products,
  categories,
  emptyMessage = "No hay productos en esta vista.",
}: {
  products: Product[];
  categories: CategoryOption[];
  emptyMessage?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(products);

  function handleToggleActive(product: Product) {
    startTransition(async () => {
      try {
        if (product.isActive) {
          await deactivateProduct(product.id);
          toast.success(`${product.name} desactivado`);
        } else {
          await reactivateProduct(product.id);
          toast.success(`${product.name} reactivado`);
        }
      } catch {
        toast.error("No se pudo actualizar el producto");
      }
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={products.length === 0}
      emptyMessage={emptyMessage}
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="productos"
        />
      }
    >
      {pagination.rows.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          categories={categories}
          isPending={isPending}
          onToggleActive={() => handleToggleActive(product)}
        />
      ))}
    </DataTable>
  );
}

function ProductRow({
  product,
  categories,
  isPending,
  onToggleActive,
}: {
  product: Product;
  categories: CategoryOption[];
  isPending: boolean;
  onToggleActive: () => void;
}) {
  const [editDialog] = useState(createDialogHandle);
  const [presentationsDialog] = useState(createDialogHandle);
  return (
    <TableRow key={product.id}>
      <IdCell id={product.id} />
      <TableCell className="max-w-80">
        <div className="flex items-center gap-3">
          <ProductImagePlaceholder
            src={product.imageUrl}
            alt={product.name}
            className="w-14 shrink-0 [&_svg]:size-5"
          />
          <div className="min-w-0">
            <div className="truncate font-medium">{product.name}</div>
            {(product.netContent || supplierCodes(product).length > 0) && (
              <div className="truncate text-xs text-muted-foreground">
                {[
                  formatNetContent(
                    product.netContent === null ? null : Number(product.netContent),
                    product.netContentUnit,
                  ),
                  supplierCodes(product).length > 0 &&
                    `Cód. ${supplierCodes(product).join(", ")}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {product.description && (
              <div className="truncate text-xs text-muted-foreground">
                {product.description}
              </div>
            )}
            {product.presentations.some((p) => p.isActive) && (
              <div className="truncate text-xs text-muted-foreground">
                {product.presentations
                  .filter((p) => p.isActive)
                  .map((p) => `${p.name} ×${p.unitsTotal}`)
                  .join(" · ")}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          <CategoryGlyph icon={product.categoryIcon} />
          {product.categoryName}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {product.priceCost === null ? "—" : formatSoles(product.priceCost)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="font-medium">{formatSoles(product.priceSale)}</div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <ProfitCell priceSale={product.priceSale} priceCost={product.priceCost} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {product.stock === null ? (
          <span className="text-xs text-muted-foreground">Sin conteo</span>
        ) : (
          <span
            className={cn(
              "font-medium",
              product.stock <= 0 && "text-destructive",
            )}
          >
            {product.stock}
          </span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge active={product.isActive} />
      </TableCell>
      <TableCell>
        <RowActions label={product.name} disabled={isPending}>
          <DropdownMenuItem onClick={() => editDialog.open(null)}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => presentationsDialog.open(null)}>
            <BoxesIcon />
            Presentaciones
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {product.isActive ? (
            <DropdownMenuItem variant="destructive" onClick={onToggleActive}>
              <Trash2Icon />
              Desactivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onToggleActive}>
              <RotateCcwIcon />
              Reactivar
            </DropdownMenuItem>
          )}
        </RowActions>
        <ProductForm product={product} categories={categories} handle={editDialog} />
        <PresentationsDialog
          productId={product.id}
          productName={product.name}
          presentations={product.presentations}
          handle={presentationsDialog}
        />
      </TableCell>
    </TableRow>
  );
}

function ProfitCell({
  priceSale,
  priceCost,
}: {
  priceSale: string;
  priceCost: string | null;
}) {
  const margin = productMargin(
    Number(priceSale),
    priceCost === null ? null : Number(priceCost),
  );
  if (!margin) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <div
        className={cn(
          "font-medium",
          margin.profit < 0
            ? "text-destructive"
            : "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {formatSoles(margin.profit)}
      </div>
      <div className="text-xs text-muted-foreground">
        {margin.markupPercent}% sobre costo
      </div>
    </>
  );
}
