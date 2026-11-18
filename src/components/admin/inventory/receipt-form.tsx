"use client";

import { GiftIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { receiveGoods, receiveShipment } from "@/actions/inventory";
import { DraftControls, toastCleared } from "@/components/admin/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  RECEIPT_DOC_TYPE_LABELS,
  RECEIPT_DOC_TYPES,
  type ReceiptDocType,
} from "@/domain/entities/receiving";
import { round2 } from "@/domain/value-objects/money";
import { productMargin } from "@/domain/services/product-margin";
import {
  MAX_RECEIPT_DISCOUNT_PERCENT,
  discountedLineTotal,
} from "@/domain/services/receiving";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "@/components/scanner/quantity-stepper";
import { ScanHint, useScanFlash } from "@/components/scanner/scanner-status";
import { buildBarcodeIndex } from "@/domain/services/barcode-scan";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useScanner } from "@/hooks/use-scanner";
import { InvoicePhotoField } from "./invoice-photo-field";

export type ReceiptProductOption = {
  id: number;
  name: string;
  categoryId: number;
  tracksExpiry: boolean;
  barcode: string | null;
  imageUrl?: string | null;
  // Price at the till, to show the profit per unit while receiving. Not
  // sent to the Almacén, which doesn't handle money.
  priceSale?: number;
};
export type ReceiptPresentationOption = {
  id: number;
  productId: number;
  name: string;
  unitsTotal: number;
  barcode: string | null;
  // The supplier's code for this pack (800436), to tell it on the invoice.
  supplierCode: string | null;
};
export type ReceiptSupplierOption = {
  id: number;
  name: string;
  categoryIds: number[];
};

// Select values are strings; these stand for "no supplier" / "by the unit".
const NONE = "none";
const UNIT = "unit";

type Line = {
  key: string;
  productId: string;
  presentation: string;
  quantity: string;
  lineTotal: string;
  // Supplier's volume discount (%); with it, lineTotal is before discount.
  discountPercent: string;
  isBonus: boolean;
  expiresAt: string;
  // Unticked when something is missing (or extra): then `received` says
  // how many units actually arrived.
  complete: boolean;
  received: string;
  // Fired with the reader, or picked from the list.
  captureSource: CaptureSource;
};

const newLine = (): Line => ({
  key: crypto.randomUUID(),
  productId: "",
  presentation: UNIT,
  quantity: "",
  lineTotal: "",
  discountPercent: "",
  isBonus: false,
  expiresAt: "",
  complete: true,
  received: "",
  captureSource: "manual",
});

// The discount typed on a line, kept within what the server accepts.
function discountOf(line: Line) {
  const percent = Number(line.discountPercent) || 0;
  return line.isBonus || percent <= 0
    ? 0
    : Math.min(percent, MAX_RECEIPT_DISCOUNT_PERCENT);
}

// What is paid for a line: the typed amount, less the supplier's discount.
function paidFor(line: Line) {
  if (line.isBonus) return 0;
  const typed = Number(line.lineTotal) || 0;
  const discount = discountOf(line);
  return discount > 0 ? discountedLineTotal(typed, discount) : typed;
}

// Merchandise arriving at the Almacén: supplier and document, then one line
// per product (and per expiry date / bonus).
// - "full" (admin): what arrived and its invoice at once.
// - "reception" (Almacén): only what arrived, counted, plus a photo of the
//   invoice; no prices. The admin registers the invoice afterwards.
export function ReceiptForm({
  products,
  presentations,
  suppliers,
  doneHref,
  mode = "full",
}: {
  products: ReceiptProductOption[];
  presentations: ReceiptPresentationOption[];
  suppliers: ReceiptSupplierOption[];
  // Where to go once saved (admin history or the warehouse home).
  doneHref: string;
  mode?: "full" | "reception";
}) {
  const reception = mode === "reception";
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [supplier, setSupplier] = useState(NONE);
  const [docType, setDocType] = useState<ReceiptDocType>("factura");
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);

  const [error, setError] = useState<string | null>(null);

  // The chosen supplier's products first (by the categories it delivers).
  const supplierCategories =
    suppliers.find((s) => String(s.id) === supplier)?.categoryIds ?? [];
  const orderedProducts = [...products].sort(
    (a, b) =>
      Number(supplierCategories.includes(b.categoryId)) -
      Number(supplierCategories.includes(a.categoryId)),
  );

  const productOf = (line: Line) =>
    products.find((p) => String(p.id) === line.productId);
  const unitsPer = (line: Line) =>
    line.presentation === UNIT
      ? 1
      : (presentations.find((p) => String(p.id) === line.presentation)
          ?.unitsTotal ?? 1);

  const total = round2(lines.reduce((sum, line) => sum + paidFor(line), 0));

  // What the page starts with.
  const blankForm = {
    supplier: NONE,
    docType: "factura" as ReceiptDocType,
    docNumber: "",
    note: "",
    lines: [newLine()],
  };
  type FormState = typeof blankForm;
  // A delivery half-registered survives leaving the page or reloading it.
  const draft = useFormDraft<FormState>({
    key: `${reception ? "reception" : "receipt"}:new`,
    values: { supplier, docType, docNumber, note, lines },
    baseline: blankForm,
    enabled: true,
    onRestore: applyForm,
  });

  function applyForm(next: FormState) {
    // Drop what no longer exists: a removed supplier, product or
    // presentation.
    setSupplier(
      suppliers.some((s) => String(s.id) === next.supplier) ? next.supplier : NONE,
    );
    setDocType(RECEIPT_DOC_TYPES.includes(next.docType) ? next.docType : "factura");
    setDocNumber(next.docNumber ?? "");
    setNote(next.note ?? "");
    const restored = (next.lines ?? []).map((line) => ({
      ...newLine(),
      ...line,
      productId: products.some((p) => String(p.id) === line.productId)
        ? line.productId
        : "",
      presentation: presentations.some((p) => String(p.id) === line.presentation)
        ? line.presentation
        : UNIT,
    }));
    setLines(restored.length > 0 ? restored : [newLine()]);
  }

  function handleClear() {
    const before = { supplier, docType, docNumber, note, lines };
    applyForm(blankForm);
    draft.clear();
    setError(null);
    toastCleared(() => applyForm(before));
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  const barcodes = useMemo(
    () =>
      buildBarcodeIndex({
        units: products.map((p) => ({ productId: p.id, barcode: p.barcode })),
        presentations,
      }),
    [products, presentations],
  );
  const feedback = useScanFlash();
  // The line the last scan went to, highlighted so the count can be checked.
  const [scannedKey, setScannedKey] = useState<string | null>(null);

  // Each trigger on a box adds 1 Caja; on a loose unit, 1 unit.
  const { lastScanAt } = useScanner((code, source) => {
    const target = barcodes.get(code);
    const product = target && products.find((p) => p.id === target.productId);
    if (!target || !product) {
      feedback.fail();
      toast.error("Código no registrado", {
        id: "scan-unknown",
        description: `${code}. Elige el producto de la lista y pide al administrador que registre el código.`,
      });
      return;
    }
    const presentation =
      target.kind === "presentation" ? String(target.presentationId) : UNIT;
    const existing = lines.find(
      (l) => l.productId === String(product.id) && l.presentation === presentation,
    );
    const blank = lines.find((l) => l.productId === "");
    let key: string;
    if (existing) {
      key = existing.key;
      update(key, {
        quantity: String((Number(existing.quantity) || 0) + 1),
        captureSource: existing.captureSource === "scan" ? source : "manual",
      });
    } else {
      const line = {
        ...(blank ?? newLine()),
        productId: String(product.id),
        presentation,
        quantity: "1",
        captureSource: source,
      };
      key = line.key;
      setLines((prev) =>
        blank ? prev.map((l) => (l.key === blank.key ? line : l)) : [...prev, line],
      );
    }
    setScannedKey(key);
    feedback.ok();
    requestAnimationFrame(() =>
      document.getElementById(`line-${key}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      if (reception) {
        const result = await receiveShipment({
          supplierId: supplier === NONE ? null : Number(supplier),
          note,
          invoicePhotoUrl: photoUrl,
          lines: lines.map((line) => ({
            productId: line.productId,
            presentationId: line.presentation === UNIT ? null : line.presentation,
            quantity: line.quantity,
            expiresAt: productOf(line)?.tracksExpiry ? line.expiresAt : null,
            captureSource: line.captureSource,
          })),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success(`Recepción #${result.data.id} registrada`, {
          description: "Ya está en el Almacén. El administrador registrará la factura.",
        });
        draft.clear();
        setPhotoUrl(null);
        router.push(doneHref);
        return;
      }
      const result = await receiveGoods({
        supplierId: supplier === NONE ? null : Number(supplier),
        docType,
        docNumber: docType === "ninguno" ? null : docNumber,
        note,
        lines: lines.map((line) => ({
          productId: line.productId,
          presentationId: line.presentation === UNIT ? null : line.presentation,
          quantity: line.quantity,
          lineTotal: line.isBonus ? null : line.lineTotal,
          discountPercent: line.isBonus ? 0 : line.discountPercent,
          isBonus: line.isBonus,
          receivedUnits: line.complete ? null : line.received,
          expiresAt: productOf(line)?.tracksExpiry ? line.expiresAt : null,
          captureSource: line.captureSource,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Ingreso #${result.data.id} registrado en el Almacén`);
      draft.clear();
      router.push(doneHref);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-supplier" required={reception}>Proveedor</Label>
            <Select
              value={supplier}
              onValueChange={(value) => value && setSupplier(value as string)}
              items={[
                { value: NONE, label: reception ? "Elige el proveedor" : "Sin proveedor" },
                ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
              ]}
            >
              <SelectTrigger id="receipt-supplier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!reception && <SelectItem value={NONE}>Sin proveedor</SelectItem>}
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reception ? (
            <div className="sm:col-span-2">
              <InvoicePhotoField
                value={photoUrl}
                onChange={setPhotoUrl}
                onUploadingChange={setUploadingPhoto}
              />
            </div>
          ) : (
          <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-doc-type">Documento</Label>
            <Select
              value={docType}
              onValueChange={(value) => value && setDocType(value as ReceiptDocType)}
              items={RECEIPT_DOC_TYPES.map((type) => ({
                value: type,
                label: RECEIPT_DOC_TYPE_LABELS[type],
              }))}
            >
              <SelectTrigger id="receipt-doc-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECEIPT_DOC_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {RECEIPT_DOC_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-doc-number" required={docType !== "ninguno"}>Serie y número</Label>
            <Input
              id="receipt-doc-number"
              placeholder="F020-00014194"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              disabled={docType === "ninguno"}
              required={docType !== "ninguno"}
              className="font-mono uppercase"
            />
          </div>
          </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading font-semibold">Productos que llegaron</h2>
        <ScanHint lastScanAt={lastScanAt} flash={feedback.flash}>
          Dispara el lector sobre cada caja: suma 1 por disparo.
        </ScanHint>
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Primero registra productos en Productos.
          </p>
        )}
        {lines.map((line, index) => {
          const product = productOf(line);
          const units = (Number(line.quantity) || 0) * unitsPer(line);
          const ownPresentations = presentations.filter(
            (p) => String(p.productId) === line.productId,
          );
          const paid = paidFor(line);
          const discount = discountOf(line);
          const perUnit = !line.isBonus && units > 0 && paid > 0 ? paid / units : null;
          const margin =
            !reception && perUnit !== null && product?.priceSale !== undefined
              ? productMargin(product.priceSale, perUnit)
              : null;
          return (
            <Card
              key={line.key}
              id={`line-${line.key}`}
              className={cn(
                line.isBonus && "border-emerald-500/40",
                line.key === scannedKey && "ring-2 ring-primary",
              )}
            >
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor={`product-${line.key}`} required>Producto {index + 1}</Label>
                    <Select
                      value={line.productId || null}
                      onValueChange={(value) =>
                        value &&
                        update(line.key, {
                          productId: value as string,
                          presentation: UNIT,
                          captureSource: "manual",
                        })
                      }
                      items={orderedProducts.map((p) => ({
                        value: String(p.id),
                        label: p.name,
                      }))}
                    >
                      <SelectTrigger id={`product-${line.key}`} className="w-full">
                        <SelectValue placeholder="Elige el producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {orderedProducts.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar producto ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                  >
                    <XIcon />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`presentation-${line.key}`}>Viene en</Label>
                    <Select
                      value={line.presentation}
                      onValueChange={(value) =>
                        value && update(line.key, { presentation: value as string })
                      }
                      items={[
                        { value: UNIT, label: "Unidades" },
                        ...ownPresentations.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} (${p.unitsTotal} und)${p.supplierCode ? ` · ${p.supplierCode}` : ""}`,
                        })),
                      ]}
                    >
                      <SelectTrigger id={`presentation-${line.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNIT}>Unidades</SelectItem>
                        {ownPresentations.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} ({p.unitsTotal} und)
                            {p.supplierCode && (
                              <span className="font-mono text-xs text-muted-foreground">
                                {p.supplierCode}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`quantity-${line.key}`} required>
                      {reception ? "Cantidad que llegó" : "Cantidad"}
                    </Label>
                    <QuantityStepper
                      id={`quantity-${line.key}`}
                      min={1}
                      value={line.quantity}
                      onChange={(quantity) => update(line.key, { quantity })}
                      required
                    />
                  </div>
                  {!reception && (
                  <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`total-${line.key}`} required={!line.isBonus}>
                      {discount > 0 ? "Total sin desc. (S/)" : "Pagaste (S/)"}
                    </Label>
                    <Input
                      id={`total-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder={line.isBonus ? "Regalo" : "0.00"}
                      value={line.isBonus ? "" : line.lineTotal}
                      onChange={(e) => update(line.key, { lineTotal: e.target.value })}
                      disabled={line.isBonus}
                      required={!line.isBonus}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`discount-${line.key}`} optional>
                      Desc. %
                    </Label>
                    <Input
                      id={`discount-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={MAX_RECEIPT_DISCOUNT_PERCENT}
                      step="0.5"
                      placeholder="Ej. 8"
                      value={line.isBonus ? "" : line.discountPercent}
                      onChange={(e) => update(line.key, { discountPercent: e.target.value })}
                      disabled={line.isBonus}
                    />
                  </div>
                  </>
                  )}
                  {product?.tracksExpiry && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`expires-${line.key}`} required>Vence el</Label>
                      <Input
                        id={`expires-${line.key}`}
                        type="date"
                        value={line.expiresAt}
                        onChange={(e) => update(line.key, { expiresAt: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>

                {reception ? (
                  units > 0 && (
                    <p className="text-right text-sm text-muted-foreground tabular-nums">
                      Entran al Almacén: <strong className="text-foreground">{units} unidades</strong>
                    </p>
                  )
                ) : (
                <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={line.complete}
                      onChange={(e) =>
                        update(line.key, {
                          complete: e.target.checked,
                          received: e.target.checked ? "" : String(units || ""),
                        })
                      }
                    />
                    Llegó completo
                  </label>
                  {!line.complete && (
                    <span className="flex items-center gap-2">
                      <Label htmlFor={`received-${line.key}`} required>Llegaron</Label>
                      <Input
                        id={`received-${line.key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={line.received}
                        onChange={(e) => update(line.key, { received: e.target.value })}
                        className="h-8 w-24"
                        required
                      />
                      <span>unidades</span>
                    </span>
                  )}
                </div>
                {!line.complete && units > 0 && line.received !== "" &&
                  Number(line.received) !== units && (
                    <p
                      className={cn(
                        "rounded-md px-3 py-2 text-sm",
                        Number(line.received) < units
                          ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                          : "bg-sky-500/10 text-sky-800 dark:text-sky-300",
                      )}
                    >
                      {Number(line.received) < units
                        ? `Faltan ${units - Number(line.received)} unidades: entran ${line.received} al Almacén y la diferencia queda anotada para reclamar al proveedor.`
                        : `Sobran ${Number(line.received) - units} unidades: entran ${line.received} y la diferencia queda anotada para revisar.`}
                    </p>
                  )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-emerald-600"
                      checked={line.isBonus}
                      onChange={(e) => update(line.key, { isBonus: e.target.checked })}
                    />
                    <GiftIcon className="size-4 text-emerald-600" />
                    Bonificación (regalo del proveedor)
                  </label>
                  {units > 0 && (
                    <span className="text-muted-foreground tabular-nums">
                      Factura: <strong className="text-foreground">{units} unidades</strong>
                      {discount > 0 && paid > 0 && (
                        <>
                          {" · "}
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            Pagas {formatSoles(paid)} (−{discount}%)
                          </strong>
                        </>
                      )}
                      {perUnit !== null && ` · ${formatSoles(perUnit)} c/u`}
                      {line.isBonus && " · costo S/ 0"}
                    </span>
                  )}
                </div>
                {margin && product?.priceSale !== undefined && (
                  <p
                    className={cn(
                      "text-right text-xs tabular-nums",
                      margin.profit > 0 ? "text-muted-foreground" : "text-destructive",
                    )}
                  >
                    Vendes a {formatSoles(product.priceSale)}
                    {margin.profit > 0
                      ? ` · ganas ${formatSoles(margin.profit)} por unidad (${margin.markupPercent}%)`
                      : margin.profit < 0
                        ? ` · pierdes ${formatSoles(-margin.profit)} por unidad`
                        : " · no le ganas nada"}
                  </p>
                )}
                </>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setLines((prev) => [...prev, newLine()])}
        >
          <PlusIcon data-icon="inline-start" />
          Agregar producto
        </Button>
      </div>

      <PaperNote
        id="receipt-note"
        placeholder="Ej. Llegó con una caja golpeada"
        value={note}
        onChange={setNote}
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-4 border-t pt-4">
        <DraftControls
          onClear={handleClear}
          clearDisabled={isPending}
          draftStatus={draft.status}
          className="mr-auto"
        />
        {!reception && (
          <span className="text-sm text-muted-foreground">
            Total pagado:{" "}
            <strong className="text-lg text-foreground tabular-nums">
              {formatSoles(total)}
            </strong>
          </span>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={isPending || uploadingPhoto || products.length === 0}
        >
          {isPending ? "Guardando..." : reception ? "Guardar recepción" : "Guardar ingreso"}
        </Button>
      </div>
    </form>
  );
}
