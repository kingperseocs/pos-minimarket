"use client";

import { CalendarClockIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { QuantityStepper } from "@/components/scanner/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/label";
import { expiryInfo } from "@/domain/services/expiry";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { cn } from "@/lib/utils";

export type LotLine = { key: string; expiresAt: string; quantity: string };

export function newLotLine(expiresAt = ""): LotLine {
  return { key: crypto.randomUUID(), expiresAt, quantity: "" };
}

export function lotLinesTotal(lines: LotLine[]) {
  return lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
}

// FEFO traffic light of a lot: expired, inside the warning window, or fine.
function ExpiryTag({
  expiresAt,
  today,
  warningDays,
}: {
  expiresAt: string;
  today: string;
  warningDays: number;
}) {
  if (!expiresAt) {
    return <span className="text-xs text-muted-foreground">Sin fecha</span>;
  }
  const { status, daysLeft } = expiryInfo(expiresAt, today, warningDays);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
        status === "expired" && "bg-destructive/10 text-destructive",
        status === "soon" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        status === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "expired" && "bg-destructive",
          status === "soon" && "bg-amber-500",
          status === "ok" && "bg-emerald-500",
        )}
      />
      {status === "expired"
        ? `Vencido hace ${-daysLeft} d`
        : daysLeft === 0
          ? "Vence hoy"
          : `Vence en ${daysLeft} d`}
    </span>
  );
}

// Counted units grouped by the expiry date printed on the package: one lot
// per date found on the shelf ("12 that expire on 05/10, 36 on 20/12").
// A compact table on wide screens; stacked rows with big buttons on a phone.
export function LotLinesField({
  lines,
  onChange,
  warningDays = 30,
}: {
  lines: LotLine[];
  onChange: (lines: LotLine[]) => void;
  // The category's "avisa N días antes", for the traffic light.
  warningDays?: number;
}) {
  const [today] = useState(() => storeDateKey(new Date()));

  function update(key: string, patch: Partial<LotLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <CalendarClockIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Lotes por vencimiento
        </span>
      </div>

      {/* Column titles: only on wide screens, where rows are a table. */}
      <div className="hidden grid-cols-[2.5rem_9.5rem_1fr_auto_2.75rem] items-center gap-3 border-b px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:grid">
        <span>Lote</span>
        <span className="inline-flex items-center gap-0.5">
          Cantidad
          <RequiredMark />
        </span>
        <span className="inline-flex items-center gap-0.5">
          Vence el
          <RequiredMark />
        </span>
        <span>Estado</span>
        <span className="sr-only">Quitar</span>
      </div>

      <ul className="divide-y">
        {lines.map((line, index) => (
          <li
            key={line.key}
            className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[2.5rem_9.5rem_1fr_auto_2.75rem] sm:py-2"
          >
            <span className="font-mono text-xs font-semibold text-muted-foreground sm:order-none">
              L{String(index + 1).padStart(2, "0")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 justify-self-end text-muted-foreground sm:order-last sm:size-9"
              aria-label={`Quitar lote ${index + 1}`}
              disabled={lines.length === 1}
              onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
            >
              <XIcon />
            </Button>

            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground sm:hidden">
                Cantidad
                <RequiredMark />
              </span>
              <QuantityStepper
                id={`lot-qty-${line.key}`}
                min={1}
                value={line.quantity}
                onChange={(quantity) => update(line.key, { quantity })}
                required
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground sm:hidden">
                Vence el
                <RequiredMark />
              </span>
              <Input
                type="date"
                aria-label={`Fecha de vencimiento del lote ${index + 1}`}
                value={line.expiresAt}
                onChange={(e) => update(line.key, { expiresAt: e.target.value })}
                className="h-11 sm:h-9"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <ExpiryTag expiresAt={line.expiresAt} today={today} warningDays={warningDays} />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 sm:h-8"
          onClick={() => onChange([...lines, newLotLine()])}
        >
          <PlusIcon data-icon="inline-start" />
          Otro lote (otra fecha)
        </Button>
        <span className="text-sm text-muted-foreground">
          Total contado{" "}
          <strong className="font-mono text-base text-foreground tabular-nums">
            {lotLinesTotal(lines)}
          </strong>{" "}
          und
        </span>
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Un lote por cada fecha impresa en el envase. Primero se vende lo que vence antes.
      </p>
    </div>
  );
}
