import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import type { SalesAnalyticsReport } from "@/application/use-cases/dashboard/sales-analytics";
import { STEADY_THRESHOLD } from "@/domain/services/sales-insights";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { InsightIconBadge } from "./insights";

// The one sentence the dashboard leads with, plus the hero figure.
export function Headline({ report }: { report: SalesAnalyticsReport }) {
  const { headline } = report;
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <InsightIconBadge insight={headline} className="size-11" />
        <div className="space-y-1">
          <p className="font-heading text-xl font-semibold leading-tight sm:text-2xl">
            {headline.title}
          </p>
          <p className="text-sm text-muted-foreground">{headline.detail}</p>
        </div>
      </div>
      <div className="sm:text-right">
        <p className="text-xs font-medium text-muted-foreground">Total vendido</p>
        <p className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          {formatSoles(report.current.revenue)}
        </p>
      </div>
    </section>
  );
}

// Signed change against the previous period, in words and an arrow — the
// color only repeats what the arrow and the text already say.
export function DeltaChip({
  change,
  upIsGood = true,
}: {
  change: number | null;
  upIsGood?: boolean;
}) {
  if (change === null) {
    return <span className="text-xs text-muted-foreground">Sin datos para comparar</span>;
  }
  const steady = Math.abs(change) < STEADY_THRESHOLD;
  const up = change > 0;
  const good = steady ? null : up === upIsGood;
  const Icon = steady ? MinusIcon : up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        good === null && "bg-muted text-muted-foreground",
        good === true && "bg-(--viz-good-bg) text-(--viz-good)",
        good === false && "bg-(--viz-bad-bg) text-(--viz-bad)",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {steady ? "Estable" : `${up ? "Subió" : "Bajó"} ${Math.abs(change)}%`}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  change,
  hint,
}: {
  label: string;
  value: string;
  change: number | null;
  hint: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="truncate font-heading text-2xl font-semibold">{value}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <DeltaChip change={change} />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
