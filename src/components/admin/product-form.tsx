"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createProduct, updateProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { CoinsIcon, PackageIcon, PackageOpenIcon, TagIcon } from "lucide-react";
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
  FormDialogFooter,
  FormDialogHeader,
  FormSection,
  RequiredLegend,
  toastCleared,
} from "./form-dialog";
import { useFormDraft } from "@/hooks/use-form-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupCategories } from "@/domain/services/categories";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import { ProductImageField } from "./product-image-field";
import {
  EMPTY_PACKAGING,
  PackagingField,
  type PackagingValue,
  packagingInput,
} from "./packaging-field";
import type { NetUnit } from "@/domain/services/packaging";
import { IGV_AFFECTATIONS, IGV_AFFECTATION_LABELS, type IgvAffectation } from "@/domain/entities/sale-document";
import { PriceCostInfo, PriceSaleInfo } from "./price-info";
import { ProfitPreview } from "./profit-preview";

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  description: string | null;
  categoryId: number;
  priceSale: string;
  // Precio de compra; null = not entered yet.
  priceCost: string | null;
  // Expiry control set on the product; null = follow the category.
  tracksExpiry: boolean | null;
  imageUrl: string | null;
  netContent?: string | null;
  netContentUnit?: NetUnit | null;
  igvAffectation?: IgvAffectation;
  // Its presentations: the catalog format only creates them when there are
  // none yet.
  presentations?: { name: string; unitsTotal: number; isActive: boolean }[];
};

export type CategoryOption = {
  id: number;
  name: string;
  // Main category it belongs to (null: a main category).
  parentId: number | null;
  icon: string | null;
  isActive: boolean;
  tracksExpiry: boolean;
};

const EXPIRY_CHOICES = { inherit: null, yes: true, no: false } as const;
type ExpiryChoice = keyof typeof EXPIRY_CHOICES;
const toExpiryChoice = (value: boolean | null | undefined): ExpiryChoice =>
  value === true ? "yes" : value === false ? "no" : "inherit";

// Fire-and-forget: an upload that never made it into a product. keepalive
// lets the request finish even if the page is navigating away.
function discardUpload(url: string) {
  void fetch("/api/uploads/product-image", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    keepalive: true,
  }).catch(() => {});
}

export function ProductForm({
  product,
  categories,
  defaultCategoryId,
  trigger,
  handle,
}: {
  product?: Product;
  categories: CategoryOption[];
  // Preselected for new products (e.g. when the list is filtered by one).
  defaultCategoryId?: number;
  trigger?: React.ReactNode;
  // Without a trigger, opened through `handle` (a row's "⋮" menu).
  handle?: DialogHandle;
}) {
  const savedImageUrl = product?.imageUrl ?? null;

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  // Active categories, plus the product's current one if it was deactivated
  // meanwhile, so editing other fields doesn't force a recategorization.
  const options = categories.filter(
    (c) => c.isActive || c.id === product?.categoryId,
  );
  const initialCategoryId =
    product?.categoryId ??
    options.find((c) => c.id === defaultCategoryId)?.id ??
    options[0]?.id ??
    null;
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId);
  const [error, setError] = useState<string | null>(null);
  const [priceSale, setPriceSale] = useState(product?.priceSale ?? "");
  const [priceCost, setPriceCost] = useState(product?.priceCost ?? "");
  const [expiry, setExpiry] = useState<ExpiryChoice>(
    toExpiryChoice(product?.tracksExpiry),
  );
  const [imageUrl, setImageUrl] = useState(savedImageUrl);
  const [igvAffectation, setIgvAffectation] = useState<IgvAffectation>(product?.igvAffectation ?? "10");
  const [uploading, setUploading] = useState(false);

  const savedPackaging: PackagingValue = {
    ...EMPTY_PACKAGING,
    netContent: product?.netContent ?? "",
    netUnit: product?.netContentUnit ?? "",
  };
  const [packaging, setPackaging] = useState<PackagingValue>(savedPackaging);
  const existingPresentations = (product?.presentations ?? []).filter(
    (p) => p.isActive,
  );

  const savedForm = {
    packaging: savedPackaging,
    name: product?.name ?? "",
    barcode: product?.barcode ?? "",
    description: product?.description ?? "",
    categoryId: initialCategoryId as number | null,
    priceSale: product?.priceSale ?? "",
    priceCost: product?.priceCost ?? "",
    expiry: toExpiryChoice(product?.tracksExpiry),
    imageUrl: savedImageUrl,
  };
  type FormState = typeof savedForm;
  const form: FormState = {
    packaging,
    name,
    barcode,
    description,
    categoryId,
    priceSale,
    priceCost,
    expiry,
    imageUrl,
  };
  // Unsaved changes — including a photo already uploaded — survive closing
  // the dialog by accident.
  const draft = useFormDraft({
    key: `product:${product?.id ?? "new"}`,
    values: form,
    baseline: savedForm,
    enabled: open,
  });

  function applyForm(next: FormState) {
    const merged = { ...savedForm, ...next };
    // A draft from before multiple formats has no `formats` list.
    setPackaging({
      ...EMPTY_PACKAGING,
      ...merged.packaging,
      formats: Array.isArray(merged.packaging?.formats) ? merged.packaging.formats : [],
    });
    setName(merged.name);
    setBarcode(merged.barcode);
    setDescription(merged.description);
    // The category may have been deactivated or deleted since.
    setCategoryId(
      options.some((c) => c.id === merged.categoryId)
        ? merged.categoryId
        : initialCategoryId,
    );
    setPriceSale(merged.priceSale);
    setPriceCost(merged.priceCost);
    setExpiry(merged.expiry);
    setImageUrl(merged.imageUrl);
  }

  // The current photo is an unsaved upload (not the product's stored one).
  const hasUnsavedUpload = imageUrl !== null && imageUrl !== savedImageUrl;

  function handleImageChange(next: string | null) {
    // Replacing/removing a photo uploaded in this session: nothing references
    // it yet, so delete it now. The product's saved photo is only deleted by
    // the server once the new one is actually saved.
    if (hasUnsavedUpload) discardUpload(imageUrl);
    setImageUrl(next);
  }

  function handleOpenChange(next: boolean) {
    // Closing mid-upload would orphan the file that is still arriving.
    if (!next && uploading) return;
    if (next) {
      // What was left unsaved last time (photo included), else what is saved.
      applyForm(draft.restore() ?? savedForm);
      setError(null);
    }
    setOpen(next);
  }

  function handleClear() {
    // Nothing references an unsaved upload: delete it now. No undo for the
    // photo, so it is only restored without it.
    if (hasUnsavedUpload) discardUpload(imageUrl);
    const before = { ...form, imageUrl: savedImageUrl };
    applyForm(savedForm);
    draft.clear();
    setError(null);
    toastCleared(
      () => applyForm(before),
      product ? "Cambios deshechos" : "Campos limpiados",
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);

    startTransition(async () => {
      const input = {
        name,
        barcode,
        description,
        categoryId,
        priceSale,
        priceCost,
        tracksExpiry: EXPIRY_CHOICES[expiry],
        imageUrl,
        netContent: packaging.netContent,
        netContentUnit: packaging.netUnit,
        igvAffectation,
        // Presentations from the catalog formats, only while there are none.
        packaging: existingPresentations.length === 0 ? packagingInput(packaging) : null,
      };
      try {
        const result = product
          ? await updateProduct({ id: product.id, ...input })
          : await createProduct(input);

        if (!result.ok) {
          // Business-rule message from the server (e.g. inactive category).
          setError(result.error);
          return;
        }
        toast.success(product ? "Producto actualizado" : "Producto creado");
        draft.clear();
        // Closed directly (not via handleOpenChange): the photo is saved now.
        setOpen(false);
      } catch {
        toast.error("No se pudo guardar el producto");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      handle={handle}
      // A stray tap on the backdrop must not throw away a half-filled form:
      // close only with X, Cancelar or Esc.
      disablePointerDismissal
    >
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      {/* Never taller than the screen: header and footer stay put, only the
          fields scroll — so X, Cancelar and Guardar are always visible. */}
      <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-2xl lg:max-w-5xl")}>
        <FormDialogHeader
          icon={PackageIcon}
          title={product ? "Editar producto" : "Nuevo producto"}
          description="Lo que se vende en la caja: foto, precio y vencimiento."
        />
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
            <RequiredLegend />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-5">
                <FormSection icon={TagIcon} title="Datos del producto">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:grid-cols-1">
                    <ProductImageField
                      value={imageUrl}
                      onChange={handleImageChange}
                      onUploadingChange={setUploading}
                    />
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="name" required>Nombre</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="h-10"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="barcode">Código de barras de la unidad</Label>
                        <Input
                          id="barcode"
                          inputMode="numeric"
                          placeholder="Toca aquí y dispara el lector"
                          value={barcode}
                          onChange={(e) => setBarcode(e.target.value)}
                          // The reader ends every code with Enter: it fills the field,
                          // it must not save the half-filled form.
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                          }}
                          className="h-10 font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          El de la botella o el paquete suelto. El de la caja o display va en
                          Presentaciones.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Input
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="category" required>Categoría</Label>
                      {options.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No hay categorías activas. Crea una en{" "}
                          <Link href="/admin/categories" className="underline">
                            Categorías
                          </Link>{" "}
                          antes de agregar productos.
                        </p>
                      ) : (
                        <Select
                          value={categoryId}
                          // Lets the trigger show the name instead of the raw id.
                          // Just the subcategory's name; the list shows where it belongs.
                          items={options.map((c) => ({ value: c.id, label: c.name }))}
                          onValueChange={(value) => value && setCategoryId(value as number)}
                        >
                          <SelectTrigger id="category" className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {groupCategories(options).map(({ category: c, depth }) => (
                              <SelectItem
                                key={c.id}
                                value={c.id}
                                className={depth === 1 ? "pl-8" : undefined}
                              >
                                <CategoryGlyph icon={c.icon} />
                                {c.name}
                                {!c.isActive && " (inactiva)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </FormSection>

                <FormSection icon={CoinsIcon} title="Precio y vencimiento">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="priceCost">Precio de compra (S/)</Label>
                        <PriceCostInfo
                          priceCost={priceCost === "" ? null : Number(priceCost) || null}
                        />
                      </div>
                      <Input
                        id="priceCost"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="De 1 unidad"
                        value={priceCost}
                        onChange={(e) => setPriceCost(e.target.value)}
                        className="h-10 tabular-nums"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="priceSale" required>Precio de venta (S/)</Label>
                        <PriceSaleInfo
                          priceSale={Number(priceSale) || 0}
                          priceCost={priceCost === "" ? null : Number(priceCost)}
                        />
                      </div>
                      <Input
                        id="priceSale"
                        type="number"
                        inputMode="decimal"
                        step="0.10"
                        min="0"
                        value={priceSale}
                        onChange={(e) => setPriceSale(e.target.value)}
                        required
                        className="h-10 tabular-nums"
                      />
                    </div>
                  </div>
                  <ProfitPreview
                    priceSale={Number(priceSale) || 0}
                    priceCost={priceCost === "" ? null : Number(priceCost)}
                  />
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="product-igv">IGV en la boleta / factura</Label>
                    <Select
                      items={IGV_AFFECTATIONS.map((a) => ({ value: a, label: IGV_AFFECTATION_LABELS[a] }))}
                      value={igvAffectation}
                      onValueChange={(next) => next && setIgvAffectation(next as IgvAffectation)}
                    >
                      <SelectTrigger id="product-igv" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IGV_AFFECTATIONS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {IGV_AFFECTATION_LABELS[a]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Gravado por defecto. Cámbialo solo si tu contador lo indica; el ajuste global de
                      Comprobantes → Configuración tiene prioridad.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label id="product-expiry-label">Fecha de vencimiento</Label>
                    <ToggleGroup
                      aria-labelledby="product-expiry-label"
                      value={[expiry]}
                      onValueChange={(next) => {
                        const [choice] = next as ExpiryChoice[];
                        if (choice) setExpiry(choice);
                      }}
                      variant="outline"
                      spacing={1}
                      className="grid w-full grid-cols-3"
                    >
                      {(
                        [
                          [
                            "inherit",
                            `Como la categoría (${
                              categories.find((c) => c.id === categoryId)?.tracksExpiry
                                ? "vence"
                                : "no vence"
                            })`,
                          ],
                          ["yes", "Sí vence"],
                          ["no", "No vence"],
                        ] as const
                      ).map(([value, label]) => (
                        <ToggleGroupItem
                          key={value}
                          value={value}
                          className="h-auto min-h-10 w-full min-w-0 py-1.5 text-xs whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                        >
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </FormSection>
              </div>

              <div className="flex min-w-0 flex-col gap-5">
                <FormSection
                  icon={PackageOpenIcon}
                  title="Empaque del proveedor"
                  description="cómo te lo venden"
                >
                  <PackagingField
                    value={packaging}
                    onChange={setPackaging}
                    existing={existingPresentations}
                  />
                </FormSection>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <FormDialogFooter
            onClear={handleClear}
            clearLabel={product ? "Deshacer cambios" : "Limpiar"}
            clearDisabled={isPending || uploading}
            draftStatus={draft.status}
          >
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending || uploading}
            >
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              disabled={isPending || uploading || options.length === 0}
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </FormDialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
