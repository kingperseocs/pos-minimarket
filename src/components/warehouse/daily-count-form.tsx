"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitDailyCount } from "@/actions/inventory";
import {
  type LotLine,
  LotLinesField,
  lotLinesTotal,
  newLotLine,
} from "@/components/admin/inventory/lot-lines-field";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { DraftControls, toastCleared } from "@/components/admin/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { DailyCountProduct } from "@/domain/entities/daily-count";
import { COUNT_REASON_LABELS } from "@/domain/services/daily-count";
import { QuantityStepper } from "@/components/scanner/quantity-stepper";
import { ScanHint, useScanFlash } from "@/components/scanner/scanner-status";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useScanner } from "@/hooks/use-scanner";
import { cn } from "@/lib/utils";

// none: "No hay ninguno" for products counted by expiry date.
// source: null until touched; "scan" while only the reader added to it.
type Entry = {
  counted: string;
  lots: LotLine[];
  none: boolean;
  source: CaptureSource | null;
};

// A unit's or a box's code: a box adds all its units at once.
export type CountCode = { barcode: string; productId: number; units: number };

// Whoever counts writes what they see on the shelf; the system's number is
// never shown, so the count is a real one.
export function DailyCountForm({
  locationId,
  locationName,
  products,
  codes,
}: {
  locationId: number;
  locationName: string;
  products: DailyCountProduct[];
  codes: CountCode[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const blankEntries = (): Record<number, Entry> =>
    Object.fromEntries(
      products.map((p) => [
        p.productId,
        {
          counted: "",
          none: false,
          source: null,
          // Known dates are suggested; quantities are not.
          lots: p.lotDates.length ? p.lotDates.map((d) => newLotLine(d)) : [newLotLine()],
        },
      ]),
    );
  const [entries, setEntries] = useState<Record<number, Entry>>(blankEntries);

  // A count half-done survives leaving the page or reloading it — for today
  // only: tomorrow's count starts fresh.
  const draft = useFormDraft<Record<number, Entry>>({
    key: `daily-count:${locationId}:${storeDateKey(new Date())}`,
    values: entries,
    baseline: blankEntries(),
    enabled: products.length > 0,
    onRestore: applyEntries,
  });

  function applyEntries(next: Record<number, Entry>) {
    // Only today's products; anything new on the list starts blank.
    const blank = blankEntries();
    setEntries(
      Object.fromEntries(
        products.map((p) => {
          const saved = next[p.productId];
          return [p.productId, saved ? { ...blank[p.productId], ...saved } : blank[p.productId]];
        }),
      ),
    );
  }

  function handleClear() {
    const before = entries;
    applyEntries(blankEntries());
    draft.clear();
    setError(null);
    toastCleared(() => applyEntries(before), "Conteo limpiado");
  }

  const feedback = useScanFlash();
  const [scannedId, setScannedId] = useState<number | null>(null);
  const { lastScanAt } = useScanner((code, source) => {
    const match = codes.find((c) => c.barcode === code);
    const product = match && products.find((p) => p.productId === match.productId);
    if (!match || !product) {
      feedback.fail();
      toast.error("Ese producto no está en el conteo de hoy", {
        id: "scan-unknown",
        description: `Código ${code}.`,
      });
      return;
    }
    const entry = entries[product.productId];
    const nextSource: CaptureSource =
      entry.source === null || entry.source === "scan" ? source : "manual";
    setScannedId(product.productId);
    requestAnimationFrame(() =>
      document
        .getElementById(`count-card-${product.productId}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
    if (!product.tracksExpiry) {
      update(product.productId, {
        counted: String((Number(entry.counted) || 0) + match.units),
        source: nextSource,
      });
      feedback.ok();
      return;
    }
    // By expiry date: the code carries no date, so a scan only adds up when
    // there is a single date line to add to.
    if (entry.lots.length === 1 && !entry.none) {
      const [lot] = entry.lots;
      update(product.productId, {
        lots: [{ ...lot, quantity: String((Number(lot.quantity) || 0) + match.units) }],
        source: nextSource,
      });
      feedback.ok();
      return;
    }
    feedback.fail();
    toast.info(`${product.productName} se cuenta por fecha`, {
      id: "scan-lots",
      description: "Escribe cuántos hay en cada fecha de vencimiento.",
    });
  });

  if (products.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2Icon}
        title={`Nada que contar hoy en ${locationName}`}
        description="Ya se contó lo necesario, o aún no hay mercadería aquí. Vuelve mañana."
      />
    );
  }

  function update(productId: number, patch: Partial<Entry>) {
    setEntries((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitDailyCount({
        locationId,
        items: products.map((p) => {
          const entry = entries[p.productId];
          const captureSource = entry.source ?? "manual";
          if (!p.tracksExpiry) {
            return { productId: p.productId, counted: entry.counted, captureSource };
          }
          if (entry.none) {
            return { productId: p.productId, counted: 0, lots: [], captureSource: "manual" };
          }
          return {
            productId: p.productId,
            counted: lotLinesTotal(entry.lots),
            lots: entry.lots.map(({ expiresAt, quantity }) => ({ expiresAt, quantity })),
            captureSource,
          };
        }),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { matched, pending } = result.data;
      draft.clear();
      toast.success("Conteo guardado. ¡Gracias!", {
        description:
          pending === 0
            ? `Los ${matched} productos coinciden con el sistema.`
            : `${matched} coinciden · ${pending} ${pending === 1 ? "pasa" : "pasan"} al administrador para revisar.`,
      });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Cuenta lo que ves en {locationName} y escríbelo. Si no hay ninguno, pon 0.
      </p>
      <ScanHint lastScanAt={lastScanAt} flash={feedback.flash}>
        O dispara el lector sobre cada unidad o caja: se suma solo.
      </ScanHint>
      {products.map((p, index) => {
        const entry = entries[p.productId];
        return (
          <Card
            key={p.productId}
            id={`count-card-${p.productId}`}
            className={cn(
              "gap-0 overflow-hidden border-l-4 py-0",
              entry.none || (p.tracksExpiry ? lotLinesTotal(entry.lots) > 0 : entry.counted !== "")
                ? "border-l-emerald-500"
                : "border-l-muted-foreground/30",
              p.productId === scannedId && "ring-2 ring-primary",
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 rounded-md bg-foreground/90 px-1.5 py-0.5 font-mono text-xs font-semibold text-background tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-semibold">{p.productName}</div>
                  <div className="text-xs text-muted-foreground">{p.categoryName}</div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {p.reasons.map((reason) => (
                  <Badge key={reason} variant="outline" className="bg-background text-xs">
                    {COUNT_REASON_LABELS[reason]}
                  </Badge>
                ))}
              </div>
            </div>
            <CardContent className="flex flex-col gap-3 px-4 py-4">
              {p.tracksExpiry ? (
                <>
                  <label
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 self-start rounded-lg border px-3 text-sm font-medium transition-colors",
                      entry.none
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={entry.none}
                      onChange={(e) => update(p.productId, { none: e.target.checked })}
                    />
                    No hay ninguno en {locationName}
                  </label>
                  {!entry.none && (
                    <LotLinesField
                      lines={entry.lots}
                      onChange={(lots) => update(p.productId, { lots, source: "manual" })}
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor={`count-${p.productId}`} required>Contaste</Label>
                  <QuantityStepper
                    id={`count-${p.productId}`}
                    value={entry.counted}
                    onChange={(counted) => update(p.productId, { counted, source: "manual" })}
                    className="w-44"
                    required
                  />
                  <span className="text-sm text-muted-foreground">unidades</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
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
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar conteo"}
        </Button>
      </div>
    </form>
  );
}
