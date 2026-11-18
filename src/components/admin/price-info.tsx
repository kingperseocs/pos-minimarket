"use client";

import { InfoIcon } from "lucide-react";
import { productMargin } from "@/domain/services/product-margin";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

// "i" button that opens on tap/click (not hover), so it works on tablets.
export function InfoPopover({
  label,
  title,
  children,
  side = "top",
  align = "center",
}: {
  // Accessible name of the button, e.g. "Cómo se calcula el precio de venta".
  label: string;
  title: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={label}
        // Small icon, generous touch target (≈ 36px) for fingers.
        className="-m-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-popup-open:text-primary"
      >
        <InfoIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-3"
      >
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        {children}
      </PopoverContent>
    </Popover>
  );
}

// One step of a calculation: formula on top, numbers below.
function Step({
  formula,
  numbers,
  result,
  note,
  negative,
}: {
  formula: string;
  numbers: string;
  result: string;
  note?: string;
  negative?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/60 p-2">
      <span className="text-xs text-muted-foreground">{formula}</span>
      <span className="font-mono text-xs">
        {numbers} ={" "}
        <span
          className={cn(
            "font-semibold",
            negative ? "text-destructive" : "text-foreground",
          )}
        >
          {result}
        </span>
      </span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

const plain = (n: number) => n.toFixed(2);

// Step-by-step explanation of the profit numbers shown in the form.
export function ProfitBreakdown({
  priceSale,
  priceCost,
}: {
  priceSale: number;
  priceCost: number | null;
}) {
  const margin = productMargin(priceSale, priceCost);
  if (!margin || priceCost === null) {
    return (
      <PopoverDescription className="text-xs">
        Escribe el precio de compra y el de venta para ver aquí, paso a paso,
        cuánto ganas por unidad.
      </PopoverDescription>
    );
  }

  const loses = margin.profit < 0;
  const perSolInvested = margin.profit / priceCost;
  const perSolCharged = margin.profit / priceSale;

  return (
    <div className="flex flex-col gap-2">
      <Step
        formula="1. Ganancia por unidad = Venta − Compra"
        numbers={`${formatSoles(priceSale)} − ${formatSoles(priceCost)}`}
        result={formatSoles(margin.profit)}
        note={
          loses
            ? "Vendes por debajo de lo que te cuesta: pierdes dinero en cada venta."
            : undefined
        }
        negative={loses}
      />
      <Step
        formula="2. % sobre el costo = Ganancia ÷ Compra × 100"
        numbers={`${plain(margin.profit)} ÷ ${plain(priceCost)} × 100`}
        result={`${margin.markupPercent}%`}
        note={`Por cada S/ 1 que inviertes, ${
          loses ? "pierdes" : "ganas"
        } ${formatSoles(Math.abs(perSolInvested))}.`}
        negative={loses}
      />
      <Step
        formula="3. % del precio de venta = Ganancia ÷ Venta × 100"
        numbers={`${plain(margin.profit)} ÷ ${plain(priceSale)} × 100`}
        result={`${margin.marginPercent}%`}
        note={`De cada S/ 1 que cobras, ${formatSoles(
          Math.abs(perSolCharged),
        )} es ${loses ? "pérdida" : "ganancia"}.`}
        negative={loses}
      />
    </div>
  );
}

export function PriceCostInfo({ priceCost }: { priceCost: number | null }) {
  return (
    <InfoPopover
      label="Qué es el precio de compra"
      title="Precio de compra"
      align="start"
    >
      <PopoverDescription className="flex flex-col gap-2 text-xs">
        <span>
          Lo que pagas al proveedor por <strong>una unidad</strong>, no por la
          caja.
        </span>
        <span className="rounded-md bg-muted/60 p-2 font-mono">
          Caja de 12 a S/ 36.00 → 36.00 ÷ 12 = S/ 3.00 por unidad
        </span>
        <span>
          {priceCost === null
            ? "Es opcional, pero sin él no se puede calcular cuánto ganas."
            : `Ahora: ${formatSoles(priceCost)} por unidad.`}
        </span>
      </PopoverDescription>
    </InfoPopover>
  );
}

export function PriceSaleInfo(props: {
  priceSale: number;
  priceCost: number | null;
}) {
  return (
    <InfoPopover
      label="Cómo se calcula la ganancia con el precio de venta"
      title="Precio de venta"
      align="end"
    >
      <PopoverDescription className="text-xs">
        Lo que cobra la caja por una unidad. Así se calcula lo que ganas:
      </PopoverDescription>
      <ProfitBreakdown {...props} />
    </InfoPopover>
  );
}
