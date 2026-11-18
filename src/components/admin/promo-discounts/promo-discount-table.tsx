"use client";

import { PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPromoDiscountActive } from "@/actions/promo-discounts";
import { Badge } from "@/components/ui/badge";
import { createDialogHandle } from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import type { PromoDiscount } from "@/domain/entities/promo-discount";
import { usePagination } from "@/hooks/use-pagination";
import { DataTable, ID_COLUMN, IdCell } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";
import { RowActions } from "../row-actions";
import { StatusBadge } from "../status-badge";
import { PromoDiscountForm } from "./promo-discount-form";

const COLUMNS = [
  ID_COLUMN,
  { label: "Descuento" },
  { label: "Porcentaje", className: "w-28" },
  { label: "Creado por" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeZone: "America/Lima",
});

export function PromoDiscountTable({ discounts }: { discounts: PromoDiscount[] }) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(discounts);

  function toggle(discount: PromoDiscount) {
    startTransition(async () => {
      const result = await setPromoDiscountActive(discount.id, !discount.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        discount.isActive
          ? `${discount.name} ya no aparece en caja`
          : `${discount.name} disponible en caja`,
      );
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={discounts.length === 0}
      emptyMessage="Aún no hay descuentos."
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="descuentos"
        />
      }
    >
      {pagination.rows.map((discount) => (
        <TableRow key={discount.id}>
          <IdCell id={discount.id} />
          <TableCell className="font-medium">{discount.name}</TableCell>
          <TableCell>
            <Badge variant="secondary" className="tabular-nums">
              {discount.percent}%
            </Badge>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {discount.createdByName ?? "—"} · {dateFormat.format(discount.createdAt)}
          </TableCell>
          <TableCell>
            <StatusBadge active={discount.isActive} />
          </TableCell>
          <TableCell>
            <PromoDiscountActions
              discount={discount}
              disabled={isPending}
              onToggle={() => toggle(discount)}
            />
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  );
}

function PromoDiscountActions({
  discount,
  disabled,
  onToggle,
}: {
  discount: PromoDiscount;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [editDialog] = useState(createDialogHandle);
  return (
    <>
      <RowActions label={discount.name} disabled={disabled}>
        <DropdownMenuItem onClick={() => editDialog.open(null)}>
          <PencilIcon />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {discount.isActive ? (
          <DropdownMenuItem variant="destructive" onClick={onToggle}>
            <Trash2Icon />
            Desactivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onToggle}>
            <RotateCcwIcon />
            Activar
          </DropdownMenuItem>
        )}
      </RowActions>
      <PromoDiscountForm discount={discount} handle={editDialog} />
    </>
  );
}
