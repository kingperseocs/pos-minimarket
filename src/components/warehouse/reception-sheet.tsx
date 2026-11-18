"use client";

import {
  CheckCircle2Icon,
  PackageCheckIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { receiveShipment } from "@/actions/inventory";
import { InvoicePhotoField } from "@/components/admin/inventory/invoice-photo-field";
import { ProductImagePlaceholder } from "@/components/pos/product-image-placeholder";
import { QuantityStepper } from "@/components/scanner/quantity-stepper";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaperNote } from "@/components/ui/paper-note";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withSubcategories } from "@/domain/services/categories";
import { defaultPresentation, supplierCatalog } from "@/domain/services/reception";
import { matchesQuery } from "@/lib/table-filters";
import { cn } from "@/lib/utils";
import {
  newLineKey,
  type OpenReception,
  type ReceptionCatalog,
  type ReceptionLine,
} from "./reception-types";

const UNIT = "unit";
// Products drawn per block in the catalog.
const PAGE = 24;

// A steady color per supplier, so the truck on screen is unmistakable.
const TONES = [
  { band: "bg-sky-600 text-white", tab: "border-sky-600 bg-sky-600 text-white", avatar: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200" },
  { band: "bg-rose-600 text-white", tab: "border-rose-600 bg-rose-600 text-white", avatar: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200" },
  { band: "bg-emerald-600 text-white", tab: "border-emerald-600 bg-emerald-600 text-white", avatar: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" },
  { band: "bg-violet-600 text-white", tab: "border-violet-600 bg-violet-600 text-white", avatar: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200" },
  { band: "bg-amber-600 text-white", tab: "border-amber-600 bg-amber-600 text-white", avatar: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" },
];
export function supplierTone(supplierId: number) {
  return TONES[supplierId % TONES.length];
}

// Step 2 for one truck: what arrived (scanned or picked from the supplier's
// catalog), the invoice photo, and "Terminar recepción".
export function ReceptionSheet({
  reception,
  catalog,
  scannedKey,
  onChange,
  onDone,
}: {
  reception: OpenReception;
  catalog: ReceptionCatalog;
  scannedKey: string | null;
  onChange: (update: (r: OpenReception) => OpenReception) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFinish] = useState(createAlertDialogHandle);

  const { products, presentations, suppliers, supplierProductIds } = catalog;
  const supplier = suppliers.find((s) => s.id === reception.supplierId);

  const productOf = (line: ReceptionLine) => products.find((p) => p.id === line.productId);
  const packOf = (line: ReceptionLine) =>
    line.presentationId === null
      ? null
      : (presentations.find((p) => p.id === line.presentationId) ?? null);
  const unitsOf = (line: ReceptionLine) => line.counted * (packOf(line)?.unitsTotal ?? 1);

  function updateLine(key: string, patch: Partial<ReceptionLine>) {
    onChange((r) => ({
      ...r,
      lines: r.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  }

  // From the catalog: one more of it (in the supplier's usual pack).
  function addProduct(productId: number) {
    const own = presentations.filter((p) => p.productId === productId);
    const pack = defaultPresentation(own);
    const existing = reception.lines.find(
      (l) => l.productId === productId && l.presentationId === (pack?.id ?? null),
    );
    if (existing) {
      updateLine(existing.key, { counted: existing.counted + 1, captureSource: "manual" });
      return;
    }
    onChange((r) => ({
      ...r,
      lines: [
        ...r.lines,
        {
          key: newLineKey(),
          productId,
          presentationId: pack?.id ?? null,
          counted: 1,
          expiresAt: "",
          captureSource: "manual",
        },
      ],
    }));
  }

  const counted = reception.lines.filter((l) => l.counted > 0);
  const packs = counted.reduce((sum, l) => sum + l.counted, 0);
  const units = counted.reduce((sum, l) => sum + unitsOf(l), 0);
  const notCounted = reception.lines.filter((l) => l.counted === 0);

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await receiveShipment({
        supplierId: reception.supplierId,
        note: reception.note,
        invoicePhotoUrl: reception.invoicePhotoUrl,
        lines: counted.map((line) => ({
          productId: line.productId,
          presentationId: line.presentationId,
          quantity: line.counted,
          expiresAt: productOf(line)?.tracksExpiry ? line.expiresAt : null,
          captureSource: line.captureSource,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Recepción de ${supplier?.name ?? "proveedor"} registrada`, {
        description: `${units} unidades entraron al Almacén. El administrador registrará la factura.`,
      });
      onDone();
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (counted.length === 0) {
      setError("Cuenta al menos un producto antes de terminar.");
      return;
    }
    if (notCounted.length > 0) confirmFinish.open(null);
    else finish();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-24">
      <InvoicePhotoField
        value={reception.invoicePhotoUrl}
        onChange={(url) => onChange((r) => ({ ...r, invoicePhotoUrl: url }))}
        onUploadingChange={setUploadingPhoto}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading font-semibold">
          Lo que llegó
        </h2>
        {reception.lines.length === 0 && (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Escanea un paquete o elige los productos de la lista de abajo.
          </p>
        )}
        {reception.lines.map((line) => (
          <LineRow
            key={line.key}
            line={line}
            catalog={catalog}
            highlighted={line.key === scannedKey}
            onChange={(patch) => updateLine(line.key, patch)}
            onRemove={() =>
              onChange((r) => ({ ...r, lines: r.lines.filter((l) => l.key !== line.key) }))
            }
          />
        ))}
      </section>

      <CatalogPicker
        products={supplierCatalog(
          products,
          withSubcategories(catalog.categories, supplier?.categoryIds ?? []),
          supplierProductIds[reception.supplierId] ?? [],
        )}
        allProducts={products}
        supplierName={supplier?.name ?? "el proveedor"}
        onAdd={addProduct}
      />

      <PaperNote
        id={`note-${reception.id}`}
        placeholder="Ej. Una caja llegó golpeada, el chofer firmó la guía…"
        value={reception.note}
        onChange={(note) => onChange((r) => ({ ...r, note }))}
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur md:sticky md:-mx-0 md:rounded-xl md:border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <div className="mr-auto text-sm leading-tight">
            <div>
              <strong className="tabular-nums">{packs}</strong> {packs === 1 ? "bulto" : "bultos"} ={" "}
              <strong className="tabular-nums">{units}</strong> und
            </div>
            <div className="text-xs text-muted-foreground">
              {notCounted.length > 0 ? `${notCounted.length} sin contar` : "Todo contado"}
            </div>
          </div>
          <Button type="submit" size="lg" disabled={isPending || uploadingPhoto}>
            <PackageCheckIcon data-icon="inline-start" />
            {isPending ? "Guardando..." : "Terminar recepción"}
          </Button>
        </div>
      </div>

      <AlertDialog handle={confirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿No llegó esto?</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>
              <ul className="list-disc pl-5">
                {notCounted.map((l) => (
                  <li key={l.key}>
                    {productOf(l)?.name ?? "Producto"}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Se registra como que no llegó. El administrador lo verá al registrar la factura.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir contando</AlertDialogCancel>
            <AlertDialogAction onClick={finish}>Sí, terminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </form>
  );
}

function LineRow({
  line,
  catalog,
  highlighted,
  onChange,
  onRemove,
}: {
  line: ReceptionLine;
  catalog: ReceptionCatalog;
  highlighted: boolean;
  onChange: (patch: Partial<ReceptionLine>) => void;
  onRemove?: () => void;
}) {
  const product = catalog.products.find((p) => p.id === line.productId);
  const own = catalog.presentations.filter((p) => p.productId === line.productId);
  const pack = own.find((p) => p.id === line.presentationId) ?? null;
  const packName = pack?.name ?? "Unidades";

  return (
    <div
      id={`line-${line.key}`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-3 transition-colors",
        line.counted > 0 && "border-emerald-500/50 bg-emerald-500/5",
        highlighted && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-3">
        <ProductImagePlaceholder
          src={product?.imageUrl}
          alt={product?.name ?? ""}
          className="w-14 shrink-0 [&_svg]:size-5"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-medium">{product?.name ?? "Producto"}</div>
          <div className="text-xs text-muted-foreground">
            {packName}
            {pack && ` · ${pack.unitsTotal} und`}
            {pack?.supplierCode && <span className="font-mono"> · Cód. {pack.supplierCode}</span>}
          </div>
        </div>
        {line.counted > 0 ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2Icon className="size-4" />
            Listo
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">Sin contar</span>
        )}
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Quitar ${product?.name ?? "producto"}`}
            onClick={onRemove}
          >
            <XIcon />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`count-${line.key}`}>Llegaron</Label>
          <QuantityStepper
            id={`count-${line.key}`}
            value={String(line.counted)}
            onChange={(value) =>
              onChange({ counted: Math.max(0, Number(value) || 0), captureSource: "manual" })
            }
          />
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
            <Label htmlFor={`pack-${line.key}`}>Viene en</Label>
            <Select
              value={line.presentationId === null ? UNIT : String(line.presentationId)}
              onValueChange={(value) =>
                value && onChange({ presentationId: value === UNIT ? null : Number(value) })
              }
              items={[
                { value: UNIT, label: "Unidades" },
                ...own.map((p) => ({ value: String(p.id), label: `${p.name} (${p.unitsTotal} und)` })),
              ]}
            >
              <SelectTrigger id={`pack-${line.key}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNIT}>Unidades</SelectItem>
                {own.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.unitsTotal} und)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        {product?.tracksExpiry && line.counted > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`expires-${line.key}`} required>
              Vence el
            </Label>
            <Input
              id={`expires-${line.key}`}
              type="date"
              value={line.expiresAt}
              onChange={(e) => onChange({ expiresAt: e.target.value })}
              required
            />
          </div>
        )}
      </div>
    </div>
  );
}

// The supplier's products to add by hand (with "Ver todos" for anything
// outside its usual catalog).
function CatalogPicker({
  products,
  allProducts,
  supplierName,
  onAdd,
}: {
  products: ReceptionCatalog["products"];
  allProducts: ReceptionCatalog["products"];
  supplierName: string;
  onAdd: (productId: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  // Drawn in blocks: the list is already on the phone (works offline), but
  // hundreds of cards at once would make it sluggish.
  const [limit, setLimit] = useState(PAGE);
  const pool = showAll || products.length === 0 ? allProducts : products;
  const matching = pool.filter((p) => matchesQuery(query, p.name, p.barcode));
  const visible = matching.slice(0, limit);

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {showAll || products.length === 0
            ? "Todos los productos"
            : `Productos de ${supplierName}`}
        </h2>
        {products.length > 0 && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              setShowAll((v) => !v);
              setLimit(PAGE);
            }}
          >
            {showAll ? `Solo los de ${supplierName}` : "Ver todos los productos"}
          </Button>
        )}
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Buscar producto o código"
          className="pl-8"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onAdd(p.id)}
            className="flex items-center gap-2 rounded-lg border bg-card p-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
          >
            <ProductImagePlaceholder
              src={p.imageUrl}
              alt=""
              className="w-10 shrink-0 [&_svg]:size-4"
            />
            <span className="line-clamp-2 leading-tight">{p.name}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">Ningún producto coincide.</p>
      )}
      {matching.length > visible.length && (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-center"
          onClick={() => setLimit((n) => n + PAGE)}
        >
          Ver más productos ({matching.length - visible.length} restantes)
        </Button>
      )}
    </section>
  );
}
