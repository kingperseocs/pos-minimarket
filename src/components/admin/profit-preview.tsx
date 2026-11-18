import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { productMargin } from "@/domain/services/product-margin";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { InfoPopover, ProfitBreakdown } from "./price-info";

// Live "Utilidad" box in the product form: what is earned per unit.
export function ProfitPreview({
  priceSale,
  priceCost,
}: {
  priceSale: number;
  priceCost: number | null;
}) {
  const margin = productMargin(priceSale, priceCost);
  if (!margin) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Escribe el precio de compra y el de venta para ver cuánto ganas por
        unidad.
      </p>
    );
  }

  const loses = margin.profit < 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-sm",
        loses
          ? "border-destructive/30 bg-destructive/5"
          : "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        {loses ? (
          <TrendingDownIcon className="size-4 text-destructive" />
        ) : (
          <TrendingUpIcon className="size-4 text-emerald-600" />
        )}
        <span className="flex-1">
          {loses ? "Pierdes" : "Ganas"} {formatSoles(Math.abs(margin.profit))}{" "}
          por unidad
        </span>
        <InfoPopover
          label="Cómo se calcula la ganancia"
          title="Cómo se calcula"
          align="end"
        >
          <ProfitBreakdown
            priceSale={priceSale}
            priceCost={priceCost}
          />
        </InfoPopover>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatSoles(priceSale)} − {formatSoles(priceCost!)} ={" "}
        {formatSoles(margin.profit)} · {margin.markupPercent}% sobre el costo ·{" "}
        {margin.marginPercent}% del precio de venta
      </p>
    </div>
  );
}
