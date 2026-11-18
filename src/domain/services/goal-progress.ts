import type { GoalMood, GoalProgress } from "../entities/sales-goal";
import { round2 } from "../value-objects/money";
import { storeDateKey } from "../value-objects/store-time";

export function moodFor(percent: number): GoalMood {
  if (percent >= 100) return "celebrating";
  if (percent >= 75) return "excited";
  if (percent >= 50) return "running";
  if (percent >= 25) return "walking";
  return "sleeping";
}

export function storeMonthKey(date: Date) {
  return storeDateKey(date).slice(0, 7);
}

// Pure: month-to-date revenue against the goal, in the store's zone.
export function computeGoalProgress(input: {
  goal: number | null;
  inherited?: boolean;
  revenue: number;
  now: Date;
}): GoalProgress {
  const { goal, revenue, now } = input;
  const dateKey = storeDateKey(now);
  const [year, month, day] = dateKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Today counts as a selling day still ahead.
  const daysLeft = daysInMonth - day + 1;
  const expectedFraction = day / daysInMonth;

  const hasGoal = goal !== null && goal > 0;
  const percent = hasGoal ? round2((revenue / goal) * 100) : 0;
  const remaining = hasGoal ? round2(Math.max(goal - revenue, 0)) : 0;

  return {
    month: dateKey.slice(0, 7),
    goal: hasGoal ? goal : null,
    inherited: hasGoal ? (input.inherited ?? false) : false,
    revenue: round2(revenue),
    percent,
    remaining,
    expectedPercent: round2(expectedFraction * 100),
    paceDiff: hasGoal ? round2(revenue - goal * expectedFraction) : 0,
    dailyNeeded: hasGoal ? round2(remaining / daysLeft) : 0,
    daysLeft,
    mood: moodFor(percent),
  };
}
