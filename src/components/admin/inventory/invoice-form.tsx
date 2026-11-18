"use client";

import { CheckIcon, GiftIcon, PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { registerInvoice } from "@/actions/inventory";
import { DraftControls, toastCleared } from "@/components/admin/form-dialog";
import { QuantityStepper } from "@/components/scanner/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type ReceivedLineForInvoice,
} from "@/domain/entities/receiving";
import { productMargin } from "@/domain/services/product-margin";
import {
  discountedLineTotal,
  MAX_RECEIPT_DISCOUNT_PERCENT,
} from "@/domain/services/receiving";
import { round2 } from "@/domain/value-objects/money";
import { useFormDraft } from "@/hooks/use-form-draft";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ReceiptPresentationOption, ReceiptProductOption } from "./receipt-form";

const UNIT = "unit";

type Line = {
  key: string;
  // A received line, or null for one invoiced that never arrived.
  itemId: number | null;
  productId: string;
  presentation: string;
  quantity: string;
  lineTotal: string;
  discountPercent: string;
  isBonus: boolean;
};

function lineFromReceived(line: ReceivedLineForInvoice): Line {
  return {
    key: `item-${line.itemId}`,
    itemId: line.itemId,
    productId: String(line.productId),
    presentation: line.presentationId === null ? UNIT : String(line.presentationId),
    // What the invoice most likely says: what arrived.
    quantity: String(line.quantity),
    lineTotal: "",
    discountPercent: "",
    isBonus: false,
  };
}

const extraLine = (): Line => ({
  key: crypto.randomUUID(),
  itemId: null,
  productId: "",
  presentation: UNIT,
  quantity: "1",
  lineTotal: "",
  discountPercent: "",
  isBonus: false,
});

function paidFor(line: Line) {
  const quantity = Number(line.quantity) || 0;
  if (line.isBonus || quantity === 0) return 0;
  const typed = Number(line.lineTotal) || 0;
  const percent = Math.min(Number(line.discountPercent) || 0, MAX_RECEIPT_DISCOUNT_PERCENT);
  return percent > 0 ? discountedLineTotal(typed, percent) : typed;
}

// Step 2 of a receipt: the admin types the supplier's invoice over what the
// Almacén counted. Each line shows what arrived; whatever differs from what
// the invoice charges is flagged here and becomes a discrepancy to claim.
export function InvoiceForm({
  receiptId,
  received,
  products,
  presentations,
}: {
  receiptId: number;
  received: ReceivedLineForInvoice[];
  products: ReceiptProductOption[];
  presentations: ReceiptPresentationOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [docType, setDocType] = useState<ReceiptDocType>("factura");
  const [docNumber, setDocNumber] = useState("");
  const [paperTotal, setPaperTotal] = useState("");
  const [lines, setLines] = useState<Line[]>(() => received.map(lineFromReceived));
  const [error, setError] = useState<string | null>(null);

  const blankForm = {
    docType: "factura" as ReceiptDocType,
    docNumber: "",
    paperTotal: "",
    lines: received.map(lineFromReceived),
  };
  type FormState = typeof blankForm;
  const draft = useFormDraft<FormState>({
    key: `invoice:${receiptId}`,
    values: { docType, docNumber, paperTotal, lines },
    baseline: blankForm,
    enabled: true,
    onRestore: applyForm,
  });

  function applyForm(next: FormState) {
    setDocType(RECEIPT_DOC_TYPES.includes(next.docType) ? next.docType : "factura");
    setDocNumber(next.docNumber ?? "");
    setPaperTotal(next.paperTotal ?? "");
    // Received lines always come from the server; only extras are restored.
    const byItem = new Map((next.lines ?? []).map((l) => [l.itemId, l]));
    setLines([
      ...received.map((r) => ({ ...lineFromReceived(r), ...byItem.get(r.itemId) })),
      ...(next.lines ?? []).filter((l) => l.itemId === null),
    ]);
  }

  function handleClear() {
    const before = { docType, docNumber, paperTotal, lines };
    applyForm(blankForm);
    draft.clear();
    setError(null);
    toastCleared(() => applyForm(before));
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const receivedOf = (line: Line) =>
    line.itemId === null ? null : received.find((r) => r.itemId === line.itemId) ?? null;
  const unitsPer = (line: Line) => {
    const counted = receivedOf(line);
    if (counted) return counted.unitsPerPresentation;
    return line.presentation === UNIT
      ? 1
      : (presentations.find((p) => String(p.id) === line.presentation)?.unitsTotal ?? 1);
  };

  const total = round2(lines.reduce((sum, line) => sum + paidFor(line), 0));
  const paper = paperTotal === "" ? null : Number(paperTotal);
  const gapCount = lines.filter((line) => {
    const units = (Number(line.quantity) || 0) * unitsPer(line);
    return units !== (receivedOf(line)?.receivedUnits ?? 0);
  }).length;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerInvoice({
        receiptId,
        docType,
        docNumber: docType === "ninguno" ? null : docNumber,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          productId: line.productId,
          presentationId: line.presentation === UNIT ? null : line.presentation,
          quantity: line.quantity,
          lineTotal: line.isBonus ? null : line.lineTotal,
          discountPercent: line.isBonus ? 0 : line.discountPercent,
          isBonus: line.isBonus,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Factura registrada · ${formatSoles(result.data.total)}`, {
        description:
          result.data.gaps > 0
            ? `${result.data.gaps} ${result.data.gaps === 1 ? "diferencia" : "diferencias"} con lo que llegó: revísalas en Diferencias.`
            : "Coincide con lo que llegó al Almacén.",
      });
      draft.clear();
      router.push("/admin/inventory/ingresos?pago=pendiente");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invoice-doc-type">Documento</Label>
            <Select
              value={docType}
              onValueChange={(value) => value && setDocType(value as ReceiptDocType)}
              items={RECEIPT_DOC_TYPES.map((type) => ({
                value: type,
                label: RECEIPT_DOC_TYPE_LABELS[type],
              }))}
            >
              <SelectTrigger id="invoice-doc-type" className="w-full">
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
            <Label htmlFor="invoice-doc-number" required={docType !== "ninguno"}>
              Serie y número
            </Label>
            <Input
              id="invoice-doc-number"
              placeholder="F016-5981"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              disabled={docType === "ninguno"}
              required={docType !== "ninguno"}
              className="font-mono uppercase"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invoice-paper-total" optional>
              Importe total del papel (S/)
            </Label>
            <Input
              id="invoice-paper-total"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="Ej. 567.00"
              value={paperTotal}
              onChange={(e) => setPaperTotal(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading font-semibold">Líneas de la factura</h2>
        {lines.map((line, index) => {
          const counted = receivedOf(line);
          const product = products.find((p) => String(p.id) === line.productId);
          const units = (Number(line.quantity) || 0) * unitsPer(line);
          const arrived = counted?.receivedUnits ?? 0;
          const diff = arrived - units;
          const paid = paidFor(line);
          const perUnit = units > 0 && paid > 0 ? paid / units : null;
          const priceSale = counted?.priceSale ?? product?.priceSale;
          const margin =
            perUnit !== null && priceSale !== undefined ? productMargin(priceSale, perUnit) : null;
          const ownPresentations = presentations.filter(
            (p) => String(p.productId) === line.productId,
          );
          return (
            <Card
              key={line.key}
              className={cn(diff !== 0 && "border-amber-500/50", line.isBonus && "border-emerald-500/40")}
            >
              <CardContent className="flex flex-col gap-3">
                {counted ? (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="leading-tight">
                      <div className="font-medium">{counted.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {counted.presentationName ?? "Unidades"}
                        {counted.supplierCode && (
                          <span className="font-mono"> · Cód. {counted.supplierCode}</span>
                        )}
                        {counted.expiresAt && ` · vence ${counted.expiresAt}`}
                      </div>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 text-sm tabular-nums">
                      Llegaron{" "}
                      <strong>
                        {counted.quantity} {counted.presentationName ?? "und"}
                      </strong>{" "}
                      = {counted.receivedUnits} und
                    </span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`product-${line.key}`} required>
                          Facturado sin llegar
                        </Label>
                        <Select
                          value={line.productId || null}
                          onValueChange={(value) =>
                            value && update(line.key, { productId: value as string, presentation: UNIT })
                          }
                          items={products.map((p) => ({ value: String(p.id), label: p.name }))}
                        >
                          <SelectTrigger id={`product-${line.key}`} className="w-full">
                            <SelectValue placeholder="Elige el producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar línea ${index + 1}`}
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`quantity-${line.key}`} required>
                      Facturado
                    </Label>
                    <QuantityStepper
                      id={`quantity-${line.key}`}
                      min={counted ? 0 : 1}
                      value={line.quantity}
                      onChange={(quantity) => update(line.key, { quantity })}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`total-${line.key}`} required={!line.isBonus && Number(line.quantity) > 0}>
                      Total línea (S/)
                    </Label>
                    <Input
                      id={`total-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder={line.isBonus ? "Regalo" : "Ej. 108.00"}
                      value={line.isBonus ? "" : line.lineTotal}
                      onChange={(e) => update(line.key, { lineTotal: e.target.value })}
                      disabled={line.isBonus || Number(line.quantity) === 0}
                      required={!line.isBonus && Number(line.quantity) > 0}
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
                      disabled={line.isBonus || Number(line.quantity) === 0}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-emerald-600"
                      checked={line.isBonus}
                      onChange={(e) => update(line.key, { isBonus: e.target.checked })}
                    />
                    <GiftIcon className="size-4 text-emerald-600" />
                    Bonificación
                  </label>
                  {diff === 0 ? (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CheckIcon className="size-4" />
                      Coincide con lo que llegó
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                      <TriangleAlertIcon className="size-4" />
                      {diff < 0
                        ? `Facturan ${-diff} und que no llegaron`
                        : `Llegaron ${diff} und sin facturar`}
                    </span>
                  )}
                </div>
                {perUnit !== null && (
                  <p className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatSoles(perUnit)} c/u
                    {margin &&
                      priceSale !== undefined &&
                      (margin.profit > 0
                        ? ` · vendes a ${formatSoles(priceSale)}, ganas ${formatSoles(margin.profit)} (${margin.markupPercent}%)`
                        : ` · vendes a ${formatSoles(priceSale)}, pierdes ${formatSoles(-margin.profit)}`)}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setLines((prev) => [...prev, extraLine()])}
        >
          <PlusIcon data-icon="inline-start" />
          Producto facturado que no llegó
        </Button>
      </div>

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
        <div className="flex flex-col items-end text-sm">
          <span className="text-muted-foreground">
            Total de la factura:{" "}
            <strong className="text-lg text-foreground tabular-nums">{formatSoles(total)}</strong>
          </span>
          {paper !== null && (
            <span
              className={cn(
                "tabular-nums",
                Math.abs(paper - total) < 0.005
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-destructive",
              )}
            >
              {Math.abs(paper - total) < 0.005
                ? "Coincide con el papel"
                : `Diferencia con el papel: ${formatSoles(round2(paper - total))}`}
            </span>
          )}
          {gapCount > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              {gapCount} {gapCount === 1 ? "línea no coincide" : "líneas no coinciden"} con lo que llegó
            </span>
          )}
        </div>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Registrar factura"}
        </Button>
      </div>
    </form>
  );
}
