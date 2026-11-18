"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CashierGoalProgress } from "@/domain/entities/sales-goal";
import { DogMascot } from "./dog-mascot";
import { GoalCelebration } from "./goal-celebration";
import { formatPercent, GOAL_MOOD_MESSAGES, goalMonthName } from "./goal-copy";
import { GoalProgressBar } from "./goal-progress-bar";

// The team's goal at the till: the dog and the percentage, no amounts. It
// comes with the page, so offline it shows the last known value.
export function GoalChip({
  goal,
  align = "end",
}: {
  goal: CashierGoalProgress;
  // Where the detail opens: "start" when the chip sits on the left (header).
  align?: "start" | "end";
}) {
  if (!goal.hasGoal) {
    // No goal this month yet: the dog sleeps until the admin sets one.
    return (
      <span
        title="El administrador aún no fijó la meta de este mes"
        className="flex h-8 items-center gap-1.5 rounded-full border border-dashed px-2 text-xs font-medium text-muted-foreground"
      >
        <DogMascot mood="sleeping" className="h-5 w-7 shrink-0" />
        <span className="hidden sm:inline">Sin meta este mes</span>
      </span>
    );
  }
  const month = goalMonthName(goal.month);

  return (
    <>
      <Popover>
        <PopoverTrigger
          aria-label={`Meta de ${month}: ${formatPercent(goal.percent)}`}
          className="flex h-8 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50/70 px-2 text-sm font-semibold text-orange-900 tabular-nums transition-colors hover:bg-orange-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100"
        >
          <DogMascot mood={goal.mood} className="h-5 w-7 shrink-0" />
          {formatPercent(goal.percent)}
        </PopoverTrigger>
        <PopoverContent align={align} className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-4">
          <p className="text-sm font-semibold">
            Meta de la tienda · <span className="capitalize">{month}</span>
          </p>
          <GoalProgressBar percent={goal.percent} mood={goal.mood} size="md" />
          <p className="text-sm text-muted-foreground">
            Vamos en <strong className="text-foreground">{formatPercent(goal.percent)}</strong>.{" "}
            {GOAL_MOOD_MESSAGES[goal.mood]}
          </p>
        </PopoverContent>
      </Popover>
      <GoalCelebration month={goal.month} reached={goal.percent >= 100} />
    </>
  );
}
