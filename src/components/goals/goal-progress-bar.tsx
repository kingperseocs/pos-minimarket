import { PawPrintIcon } from "lucide-react";
import { GOAL_MILESTONES, type GoalMood } from "@/domain/entities/sales-goal";
import { cn } from "@/lib/utils";
import { DogMascot } from "./dog-mascot";
import { FinishLine } from "./finish-line";
import { GOAL_MOOD_LABELS } from "./goal-copy";

// Centered on its spot, but kept inside the track at both ends.
function dogShift(shown: number) {
  if (shown < 8) return -15;
  if (shown > 92) return -85;
  return -50;
}

const SIZES = {
  // Fits the 56px admin header.
  xs: { track: "h-2", dog: "h-8 w-11", dogBox: "pt-6", finish: "h-8 w-9", paw: "size-2" },
  sm: { track: "h-2.5", dog: "h-7 w-9", dogBox: "pt-6", finish: "h-8 w-9", paw: "size-2.5" },
  md: { track: "h-3", dog: "h-9 w-12", dogBox: "pt-8", finish: "h-11 w-12", paw: "size-3" },
  lg: { track: "h-5", dog: "h-14 w-[4.5rem]", dogBox: "pt-12", finish: "h-16 w-[4.4rem]", paw: "size-3.5" },
};

// Orange progress bar with the Shih Tzu running on it toward the finish
// arch. The fill and the dog grow from 0 when mounted (CSS only).
export function GoalProgressBar({
  percent,
  mood,
  expectedPercent,
  size = "md",
  milestones = size === "md" || size === "lg",
  className,
}: {
  percent: number;
  mood: GoalMood;
  // Marker of where the bar "should" be today.
  expectedPercent?: number;
  size?: keyof typeof SIZES;
  milestones?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const shown = Math.min(Math.max(percent, 0), 100);
  const reached = percent >= 100;

  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      <div className={cn("relative min-w-0 flex-1", s.dogBox)}>
        {/* The dog's paws rest on the bar; it never leaves the track. */}
        <div className="goal-runner absolute top-0" style={{ left: `${shown}%` }}>
          <div style={{ translate: `${dogShift(shown)}% 0` }}>
            <DogMascot mood={mood} className={s.dog} title={GOAL_MOOD_LABELS[mood]} />
          </div>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(shown)}
          aria-label="Avance de la meta del mes"
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-orange-100 ring-1 ring-orange-200/70 ring-inset dark:bg-orange-950/60 dark:ring-orange-900",
            s.track,
          )}
        >
          <div
            className={cn(
              "goal-fill goal-shimmer h-full rounded-full bg-linear-to-r",
              reached
                ? "from-orange-400 via-amber-400 to-yellow-300"
                : "from-orange-400 to-orange-500",
            )}
            style={{ width: `${shown}%` }}
          />
          {expectedPercent !== undefined && expectedPercent < 100 && (
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground/35"
              style={{ left: `${expectedPercent}%` }}
              title="Donde deberías ir hoy"
              aria-hidden
            />
          )}
          {milestones &&
            GOAL_MILESTONES.map((m) => (
              <PawPrintIcon
                key={m}
                aria-hidden
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors",
                  s.paw,
                  shown >= m ? "text-white drop-shadow-sm" : "text-orange-300 dark:text-orange-800",
                )}
                style={{ left: `${m}%` }}
              />
            ))}
        </div>
      </div>
      <FinishLine reached={reached} className={s.finish} />
    </div>
  );
}
