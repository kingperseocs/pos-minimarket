"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { countStock } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogHandle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StockLot } from "@/domain/entities/inventory";
import { useFormDraft } from "@/hooks/use-form-draft";
import { cn } from "@/lib/utils";
import { DraftControls, toastCleared } from "../form-dialog";
import {
  type LotLine,
  LotLinesField,
  lotLinesTotal,
  newLotLine,
} from "./lot-lines-field";

export type LocationOption = { id: number; name: string };

export function StockCountDialog({
  productId,
  productName,
  byLocation,
  locations,
  tracksExpiry = false,
  lots = [],
  trigger,
  handle,
}: {
  productId: number;
  productName: string;
  // Balance per location id; a missing location was never counted.
  byLocation: Record<number, number>;
  locations: LocationOption[];
  // Expiry-controlled: counted by expiry date.
  tracksExpiry?: boolean;
  lots?: StockLot[];
  trigger?: React.ReactElement;
  // Without a trigger, opened through `handle` (a row's "⋮" menu).
  handle?: DialogHandle;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState<number | null>(
    locations[0]?.id ?? null,
  );
  const [typedCount, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [lotLines, setLotLines] = useState<LotLine[]>([]);

  // Known dates at that location are suggested; quantities are not, so the
  // count stays a real count.
  function linesFor(location: number | null): LotLine[] {
    const dates = lots
      .filter((lot) => lot.locationId === location)
      .map((lot) => newLotLine(lot.expiresAt));
    return dates.length > 0 ? dates : [newLotLine()];
  }

  const counted = tracksExpiry ? String(lotLinesTotal(lotLines)) : typedCount;

  const isOpening = locationId === null || byLocation[locationId] === undefined;
  const current = locationId === null ? 0 : (byLocation[locationId] ?? 0);
  const countedNumber = counted === "" ? null : Number(counted);
  const delta = countedNumber === null ? null : countedNumber - current;
  const needsNote = !isOpening && delta !== null && delta !== 0;

  const blankForm = {
    locationId: (locations[0]?.id ?? null) as number | null,
    typedCount: "",
    note: "",
    lotLines: linesFor(locations[0]?.id ?? null),
  };
  type FormState = typeof blankForm;
  // A count half-done survives closing the dialog by accident.
  const draft = useFormDraft<FormState>({
    key: `stock-count:${productId}`,
    values: { locationId, typedCount, note, lotLines },
    baseline: blankForm,
    enabled: open,
  });

  function applyForm(next: FormState) {
    const location = locations.some((l) => l.id === next.locationId)
      ? next.locationId
      : blankForm.locationId;
    setLocationId(location);
    setCounted(next.typedCount ?? "");
    setNote(next.note ?? "");
    setLotLines(next.lotLines?.length ? next.lotLines : linesFor(location));
  }

  function reset() {
    applyForm(blankForm);
  }

  function handleClear() {
    const before = { locationId, typedCount, note, lotLines };
    reset();
    draft.clear();
    toastCleared(() => applyForm(before));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const result = await countStock({
        productId,
        locationId,
        counted,
        note: note || undefined,
        ...(tracksExpiry && {
          lots: lotLines.map(({ expiresAt, quantity }) => ({ expiresAt, quantity })),
        }),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (isOpening) toast.success("Stock inicial registrado");
      else if (result.data === null) toast.success("El conteo coincide, sin cambios");
      else {
        const d = result.data.delta;
        toast.success(`Ajuste registrado (${d > 0 ? "+" : ""}${d})`);
      }
      draft.clear();
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) applyForm(draft.restore() ?? blankForm);
        setOpen(next);
      }}
      handle={handle}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contar stock</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="location" required>Ubicación</Label>
            <Select
              value={locationId}
              onValueChange={(v) => {
                setLocationId(v as number);
                setLotLines(linesFor(v as number));
              }}
              items={locations.map((l) => ({ value: l.id, label: l.name }))}
            >
              <SelectTrigger id="location" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tracksExpiry ? (
            <div className="flex flex-col gap-2">
              <Label required>Unidades contadas por fecha de vencimiento</Label>
              <LotLinesField lines={lotLines} onChange={setLotLines} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="counted" required>Unidades contadas</Label>
              <Input
                id="counted"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={typedCount}
                onChange={(e) => setCounted(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            {isOpening ? (
              <span className="text-muted-foreground">
                Primer conteo en esta ubicación: se registra como{" "}
                <strong className="text-foreground">stock inicial</strong> y el
                producto empieza a descontarse con cada venta.
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
                <span>
                  Sistema: <strong>{current}</strong>
                </span>
                {delta !== null && (
                  <span
                    className={cn(
                      "font-medium",
                      delta < 0 && "text-destructive",
                      delta > 0 && "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    Diferencia: {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                )}
              </div>
            )}
          </div>

          {!isOpening && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="note" required={needsNote} optional={!needsNote}>
                Motivo
              </Label>
              <Input
                id="note"
                placeholder="Ej. Faltante detectado en conteo del turno mañana"
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={needsNote}
              />
            </div>
          )}

          <DialogFooter>
            <DraftControls
              onClear={handleClear}
              clearDisabled={isPending}
              draftStatus={draft.status}
              className="sm:mr-auto"
            />
            <Button type="submit" disabled={isPending || !locationId}>
              {isPending ? "Guardando..." : "Registrar conteo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
