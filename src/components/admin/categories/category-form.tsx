"use client";

import { TagsIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCategory, updateCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  type DialogHandle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FORM_DIALOG_CONTENT,
  FormDialogBody,
  FormDialogFooter,
  RequiredLegend,
  FormDialogHeader,
  toastCleared,
} from "../form-dialog";
import { useFormDraft } from "@/hooks/use-form-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CATEGORY_ICON_LABELS,
  CATEGORY_ICONS,
  type CategoryIcon,
} from "@/domain/entities/category";
import { CATEGORY_ICON_COMPONENTS } from "@/components/pos/pos-icons";
import { InfoHint } from "@/components/info-hint";

export type EditableCategory = {
  id: number;
  name: string;
  parentId: number | null;
  icon: CategoryIcon | null;
  sortOrder: number;
  tracksExpiry: boolean;
  expiryWarningDays: number;
};

// Select value for "it is a main category".
const MAIN = "main";

export function CategoryForm({
  category,
  trigger,
  handle,
  nextSortOrder = 0,
  mainCategories = [],
  hasSubcategories = false,
}: {
  category?: EditableCategory;
  trigger?: React.ReactElement;
  // Without a trigger, opened through `handle` (a row's "⋮" menu).
  handle?: DialogHandle;
  // Default position for a new category: after the last existing one.
  nextSortOrder?: number;
  // Main categories it can belong to (Galletas, for Galletas saladas).
  mainCategories?: { id: number; name: string }[];
  // A category with subcategories stays a main category.
  hasSubcategories?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [parent, setParent] = useState(MAIN);
  const [icon, setIcon] = useState<CategoryIcon | null>(null);
  const [sortOrder, setSortOrder] = useState("0");
  const [tracksExpiry, setTracksExpiry] = useState(false);
  const [warningDays, setWarningDays] = useState("30");
  const [error, setError] = useState<string | null>(null);
  // It can't belong to itself.
  const parentOptions = mainCategories.filter((c) => c.id !== category?.id);

  const savedForm = {
    name: category?.name ?? "",
    parent: category?.parentId ? String(category.parentId) : MAIN,
    icon: category?.icon ?? null,
    sortOrder: String(category?.sortOrder ?? nextSortOrder),
    tracksExpiry: category?.tracksExpiry ?? false,
    warningDays: String(category?.expiryWarningDays ?? 30),
  };
  type FormState = typeof savedForm;
  const form: FormState = { name, parent, icon, sortOrder, tracksExpiry, warningDays };
  // Unsaved changes survive closing the dialog by accident.
  const draft = useFormDraft({
    key: `category:${category?.id ?? "new"}`,
    values: form,
    baseline: savedForm,
    enabled: open,
  });

  function applyForm(next: FormState) {
    const merged = { ...savedForm, ...next };
    setName(merged.name);
    setParent(merged.parent);
    setIcon(merged.icon);
    setSortOrder(merged.sortOrder);
    setTracksExpiry(merged.tracksExpiry);
    setWarningDays(merged.warningDays);
  }

  function handleClear() {
    const before = form;
    applyForm(savedForm);
    draft.clear();
    setError(null);
    toastCleared(
      () => applyForm(before),
      category ? "Cambios deshechos" : "Campos limpiados",
    );
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      // What was left unsaved last time, else what is saved.
      applyForm(draft.restore() ?? savedForm);
      setError(null);
    }
    setOpen(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const input = {
        name,
        parentId: parent === MAIN ? null : parent,
        icon,
        sortOrder,
        tracksExpiry,
        expiryWarningDays: warningDays,
      };
      const result = category
        ? await updateCategory({ id: category.id, ...input })
        : await createCategory(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(category ? "Categoría actualizada" : "Categoría creada");
      draft.clear();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      handle={handle}
      disablePointerDismissal
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-lg")}>
        <FormDialogHeader
          icon={TagsIcon}
          title={category ? "Editar categoría" : "Nueva categoría"}
          description="Las categorías agrupan los productos en la caja."
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <RequiredLegend />
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-name" required>Nombre</Label>
              <Input
                id="category-name"
                value={name}
                maxLength={40}
                placeholder="Ej. Lácteos"
                onChange={(event) => setName(event.target.value)}
                aria-invalid={error !== null}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="category-parent" optional>
                Pertenece a
              </Label>
              <Select
                value={parent}
                onValueChange={(value) => value && setParent(value as string)}
                disabled={hasSubcategories}
                items={[
                  { value: MAIN, label: "Ninguna — es categoría principal" },
                  ...parentOptions.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
              >
                <SelectTrigger id="category-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAIN}>Ninguna — es categoría principal</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {hasSubcategories
                  ? "Tiene subcategorías, así que se queda como categoría principal."
                  : "Ej. Galletas saladas pertenece a Galletas. En caja se elige Galletas y luego se filtra por la subcategoría."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label id="category-icon-label">Ícono</Label>
              <ToggleGroup
                aria-labelledby="category-icon-label"
                value={icon ? [icon] : []}
                // Clicking the selected icon again clears it (icon is optional).
                onValueChange={(next) =>
                  setIcon((next[0] as CategoryIcon | undefined) ?? null)
                }
                variant="outline"
                spacing={1}
                className="grid w-full grid-cols-7 sm:grid-cols-9"
              >
                {CATEGORY_ICONS.map((key) => {
                  const Icon = CATEGORY_ICON_COMPONENTS[key];
                  return (
                    <ToggleGroupItem
                      key={key}
                      value={key}
                      aria-label={CATEGORY_ICON_LABELS[key]}
                      title={CATEGORY_ICON_LABELS[key]}
                      className="aspect-square h-auto w-full aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground [&_svg:not([class*='size-'])]:size-5"
                    >
                      <Icon />
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {icon
                  ? `Seleccionado: ${CATEGORY_ICON_LABELS[icon]}`
                  : "Opcional. Sin ícono se muestra una etiqueta genérica."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="category-order">Orden en caja</Label>
                <InfoHint title="¿Qué es el orden en caja?">
                  <p>
                    Es la posición de esta categoría en la barra lateral de la
                    caja, donde el cajero elige la categoría para ver sus
                    productos.
                  </p>
                  <p>
                    El número más bajo va arriba. Ej.: Bebidas = 1, Lácteos = 2,
                    Galletas = 3. Pon números bajos a las categorías que más se
                    venden para que el cajero las encuentre rápido.
                  </p>
                  <p>Si dos categorías tienen el mismo número, se ordenan por nombre.</p>
                </InfoHint>
              </div>
              <Input
                id="category-order"
                type="number"
                min={0}
                max={999}
                step={1}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="w-28"
              />
              <p className="text-xs text-muted-foreground">
                Las categorías con número menor aparecen primero.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label id="category-expiry-label">¿Sus productos vencen?</Label>
              <ToggleGroup
                aria-labelledby="category-expiry-label"
                value={[tracksExpiry ? "yes" : "no"]}
                onValueChange={(next) => {
                  const [choice] = next as string[];
                  if (choice) setTracksExpiry(choice === "yes");
                }}
                variant="outline"
                spacing={1}
                className="grid w-full grid-cols-2"
              >
                <ToggleGroupItem
                  value="no"
                  className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  No vencen
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="yes"
                  className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  Sí, tienen fecha de vencimiento
                </ToggleGroupItem>
              </ToggleGroup>
              {tracksExpiry ? (
                <div className="flex items-center gap-2 text-sm">
                  <span>Avisar</span>
                  <Input
                    id="category-warning-days"
                    aria-label="Días de anticipación"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={warningDays}
                    onChange={(event) => setWarningDays(event.target.value)}
                    className="w-20"
                  />
                  <span>días antes de que venzan.</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ej. adornos o útiles. Puedes cambiarlo en un producto puntual.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

          </FormDialogBody>
          <FormDialogFooter
            onClear={handleClear}
            clearLabel={category ? "Deshacer cambios" : "Limpiar"}
            clearDisabled={isPending}
            draftStatus={draft.status}
          >
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </FormDialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
