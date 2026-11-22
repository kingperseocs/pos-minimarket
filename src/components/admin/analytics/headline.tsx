import { ArrowDownIcon, ArrowUpIcon, type LucideIcon, MinusIcon } from "lucide-react";
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

// Pastel tones for the KPI tiles (same palette as the documents screen).
const KPI_TONES = {
  emerald: {
    tile: "bg-emerald-50 ring-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:ring-emerald-900 dark:text-emerald-50",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  sky: {
    tile: "bg-sky-50 ring-sky-200 text-sky-950 dark:bg-sky-950/40 dark:ring-sky-900 dark:text-sky-50",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  },
  violet: {
    tile: "bg-violet-50 ring-violet-200 text-violet-950 dark:bg-violet-950/40 dark:ring-violet-900 dark:text-violet-50",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  },
  amber: {
    tile: "bg-amber-50 ring-amber-200 text-amber-950 dark:bg-amber-950/40 dark:ring-amber-900 dark:text-amber-50",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
} as const;

export function KpiTile({
  label,
  value,
  change,
  hint,
  icon: Icon,
  tone = "sky",
}: {
  label: string;
  value: string;
  change: number | null;
  hint: string;
  icon?: LucideIcon;
  tone?: keyof typeof KPI_TONES;
}) {
  const colors = KPI_TONES[tone];
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-xl p-4 shadow-sm ring-1", colors.tile)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", colors.badge)}>
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="truncate font-heading text-3xl font-bold tabular-nums">{value}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <DeltaChip change={change} />
      </div>
      <p className="text-xs font-medium opacity-75">{hint}</p>
    </div>
  );
}
