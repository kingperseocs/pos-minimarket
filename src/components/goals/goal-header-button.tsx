"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GoalProgress } from "@/domain/entities/sales-goal";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DogMascot } from "./dog-mascot";
import { EditGoalDialog } from "./edit-goal-dialog";
import { formatPercent, goalMonthName } from "./goal-copy";
import { GoalPace, GoalStats } from "./goal-details";
import { GoalProgressBar } from "./goal-progress-bar";

const TRIGGER =
  "flex h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl px-2 whitespace-nowrap text-orange-900 transition-colors hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-popup-open:bg-orange-50 dark:text-orange-100 dark:hover:bg-orange-950/50 dark:data-popup-open:bg-orange-950/50";

// The bar with the dog and the finish arch, sized for the 56px header.
// Phones get a compact chip (dog + %) instead; the details open on tap.
function HeaderBar({ percent, mood }: Pick<GoalProgress, "percent" | "mood">) {
  return (
    <>
      <span className="flex items-center rounded-full border border-orange-200 bg-orange-50/80 py-0.5 pr-1 pl-0.5 sm:hidden dark:border-orange-900 dark:bg-orange-950/40">
        <DogMascot mood={mood} className="h-7 w-9" />
      </span>
      <GoalProgressBar
        percent={percent}
        mood={mood}
        size="xs"
        className="hidden w-40 sm:flex md:w-52 lg:w-72"
      />
    </>
  );
}

export function GoalHeaderButton({ progress }: { progress: GoalProgress }) {
  const [editing, setEditing] = useState(false);
  const month = goalMonthName(progress.month);

  const dialog = (
    <EditGoalDialog
      key={String(progress.goal)}
      open={editing}
      onOpenChange={setEditing}
      month={progress.month}
      currentGoal={progress.goal}
    />
  );

  if (progress.goal === null) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Fijar meta del mes"
          className={TRIGGER}
        >
          <HeaderBar percent={0} mood="sleeping" />
          <span className="text-sm font-semibold">
            <span className="hidden lg:inline">Fijar meta</span>
            <span className="lg:hidden">Meta</span>
          </span>
        </button>
        {dialog}
      </>
    );
  }

  const reached = progress.percent >= 100;
  return (
    <>
      <Popover>
        <PopoverTrigger
          aria-label={`Meta de ${month}: ${formatPercent(progress.percent)}`}
          className={TRIGGER}
        >
          <HeaderBar percent={progress.percent} mood={progress.mood} />
          <span className="flex flex-col items-end leading-tight">
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                reached && "text-amber-600 dark:text-amber-400",
              )}
            >
              {formatPercent(progress.percent)}
            </span>
            <span className="hidden text-[0.7rem] text-orange-800/80 tabular-nums xl:inline dark:text-orange-200/80">
              {formatSoles(progress.revenue)}
            </span>
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-88 max-w-[calc(100vw-2rem)] gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                Meta de <span className="capitalize">{month}</span>
              </p>
              {progress.inherited && (
                <p className="text-xs text-muted-foreground">Misma meta del mes anterior</p>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <PencilIcon data-icon="inline-start" />
              Editar
            </Button>
          </div>
          <GoalProgressBar
            percent={progress.percent}
            mood={progress.mood}
            expectedPercent={progress.expectedPercent}
            size="md"
          />
          <GoalStats progress={progress} />
          <GoalPace progress={progress} />
        </PopoverContent>
      </Popover>
      {dialog}
    </>
  );
}
