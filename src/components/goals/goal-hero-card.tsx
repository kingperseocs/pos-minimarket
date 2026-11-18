"use client";

import { PencilIcon, TargetIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GoalProgress } from "@/domain/entities/sales-goal";
import { formatSoles } from "@/lib/money";
import { EditGoalDialog } from "./edit-goal-dialog";
import { GoalCelebration } from "./goal-celebration";
import { formatPercent, goalMonthName } from "./goal-copy";
import { GoalPace, GoalStats } from "./goal-details";
import { GoalProgressBar } from "./goal-progress-bar";

// The month's goal at the top of the dashboard: big bar, the dog and the
// numbers that matter to reach it.
export function GoalHeroCard({ progress, demo }: { progress: GoalProgress; demo: boolean }) {
  const [editing, setEditing] = useState(false);
  const month = goalMonthName(progress.month);
  const goal = progress.goal;

  return (
    <section
      aria-labelledby="goal-title"
      className="relative overflow-hidden rounded-xl border border-orange-200/80 bg-linear-to-br from-orange-50 via-card to-amber-50/60 p-4 shadow-xs md:p-6 dark:border-orange-900/60 dark:from-orange-950/30 dark:via-card dark:to-card"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="goal-title"
              className="flex flex-wrap items-center gap-2 text-base font-semibold md:text-lg"
            >
              <TargetIcon className="size-5 text-orange-500" aria-hidden />
              <span>
                Meta de <span className="capitalize">{month}</span>
              </span>
              {demo && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  ventas de ejemplo
                </span>
              )}
            </h2>
            {goal !== null && (
              <p className="mt-1 text-2xl font-bold tabular-nums md:text-3xl">
                <span className="text-orange-600 dark:text-orange-400">
                  {formatSoles(progress.revenue)}
                </span>{" "}
                <span className="text-sm font-medium text-muted-foreground md:text-lg">
                  de {formatSoles(goal)} · {formatPercent(progress.percent)}
                </span>
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={goal !== null ? "outline" : "default"}
            onClick={() => setEditing(true)}
          >
            <PencilIcon data-icon="inline-start" />
            {goal !== null ? "Editar meta" : "Fijar meta"}
          </Button>
        </div>

        {goal !== null ? (
          <>
            <GoalProgressBar
              percent={progress.percent}
              mood={progress.mood}
              expectedPercent={progress.expectedPercent}
              size="lg"
            />
            <GoalStats progress={progress} />
            <GoalPace progress={progress} />
          </>
        ) : (
          <>
            <GoalProgressBar percent={0} mood="sleeping" size="lg" />
            <p className="text-sm text-muted-foreground">
              Fija cuánto quieres vender este mes y el perrito correrá hacia la meta con cada
              venta.
            </p>
          </>
        )}
      </div>
      <GoalCelebration month={progress.month} reached={!demo && progress.percent >= 100} />
      <EditGoalDialog
        open={editing}
        onOpenChange={setEditing}
        month={progress.month}
        currentGoal={goal}
      />
    </section>
  );
}
