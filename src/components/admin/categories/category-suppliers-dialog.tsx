"use client";

import { TruckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignCategorySuppliers } from "@/actions/categories";
import {
  FORM_DIALOG_CONTENT,
  FormDialogBody,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/admin/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  type DialogHandle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { cn } from "@/lib/utils";

export type SupplierChoice = {
  id: number;
  name: string;
  // The categories it delivers today (to warn before leaving it with none).
  categoryIds: number[];
};

// Which suppliers deliver this category, chosen from the category's side
// (the same link as "Categorías que te provee" in the supplier's form).
export function CategorySuppliersDialog({
  handle,
  category,
  suppliers,
}: {
  handle: DialogHandle;
  category: { id: number; name: string; parentId: number | null; supplierIds: number[] };
  suppliers: SupplierChoice[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Suppliers that would end up delivering no category at all.
  const orphaned = suppliers.filter(
    (s) =>
      category.supplierIds.includes(s.id) &&
      !selected.includes(String(s.id)) &&
      s.categoryIds.every((id) => id === category.id),
  );

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await assignCategorySuppliers({
        categoryId: category.id,
        supplierIds: selected.map(Number),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Proveedores de ${category.name} actualizados`);
      handle.close();
    });
  }

  return (
    <Dialog
      handle={handle}
      onOpenChange={(open) => {
        if (open) {
          setSelected(category.supplierIds.map(String));
          setError(null);
        }
      }}
    >
      <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-md")}>
        <FormDialogHeader
          icon={TruckIcon}
          title={`Proveedores de ${category.name}`}
          description="Quién te trae los productos de esta categoría."
        />
        <FormDialogBody className="gap-2">
          <Label htmlFor={`category-suppliers-${category.id}`}>Proveedores</Label>
          <MultiCombobox
            id={`category-suppliers-${category.id}`}
            options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
            value={selected}
            onValueChange={setSelected}
            placeholder="Busca y elige proveedores…"
            emptyText="Ningún proveedor coincide"
          />
          <p className="text-xs text-muted-foreground">
            {category.parentId === null
              ? "También proveen sus subcategorías: no hace falta repetirlos ahí."
              : "Los proveedores de su categoría principal ya la proveen."}{" "}
            También puedes cambiarlo desde cada proveedor, en «Categorías que te provee».
          </p>
          {orphaned.length > 0 && (
            <Alert>
              <AlertDescription>
                {orphaned.map((s) => s.name).join(", ")}{" "}
                {orphaned.length === 1 ? "quedará" : "quedarán"} sin categorías: al editarlo
                {orphaned.length === 1 ? "" : "s"} te pedirá elegir alguna.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FormDialogBody>
        <FormDialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </FormDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
