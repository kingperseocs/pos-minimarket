import type { GoalProgress } from "@/domain/entities/sales-goal";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatPercent, GOAL_MOOD_MESSAGES } from "./goal-copy";

// Figures under the bar: sold, goal, missing, per day, and the pace.
export function GoalStats({ progress, className }: { progress: GoalProgress; className?: string }) {
  const reached = progress.percent >= 100;
  const items = [
    { label: "Vendido", value: formatSoles(progress.revenue), strong: true },
    { label: "Meta", value: progress.goal !== null ? formatSoles(progress.goal) : "—" },
    reached
      ? { label: "Superado por", value: formatSoles(progress.revenue - (progress.goal ?? 0)) }
      : { label: "Falta", value: formatSoles(progress.remaining) },
    reached
      ? { label: "Avance", value: formatPercent(progress.percent) }
      : {
          label: progress.daysLeft === 1 ? "Hoy" : `Por día (${progress.daysLeft} días)`,
          value: formatSoles(progress.dailyNeeded),
        },
  ];
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "truncate text-sm font-semibold tabular-nums",
              item.strong && "text-orange-600 dark:text-orange-400",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function GoalPace({ progress }: { progress: GoalProgress }) {
  if (progress.goal === null || progress.percent >= 100) {
    return <p className="text-sm text-muted-foreground">{GOAL_MOOD_MESSAGES[progress.mood]}</p>;
  }
  const ahead = progress.paceDiff >= 0;
  return (
    <p className="text-sm text-muted-foreground">
      {GOAL_MOOD_MESSAGES[progress.mood]}{" "}
      <span
        className={cn(
          "font-medium",
          ahead ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
        )}
      >
        {ahead
          ? `Vas adelantado ${formatSoles(progress.paceDiff)} al ritmo esperado.`
          : `Vas ${formatSoles(-progress.paceDiff)} por debajo del ritmo esperado.`}
      </span>
    </p>
  );
}
