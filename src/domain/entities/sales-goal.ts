// The sales target the owner sets for a month (in soles). Versioned: a change
// inserts a new row, so the history of goals stays auditable.
export interface SalesGoal {
  id: number;
  // YYYY-MM in the store's zone.
  month: string;
  amount: number;
  createdById: number | null;
  createdAt: Date;
}

// How the mascot feels about the month's progress.
export type GoalMood = "sleeping" | "walking" | "running" | "excited" | "celebrating";

export const GOAL_MILESTONES = [25, 50, 75] as const;

export interface GoalProgress {
  month: string;
  // null when no goal was ever set.
  goal: number | null;
  // true when the goal was inherited from an earlier month.
  inherited: boolean;
  revenue: number;
  // Real percentage (may exceed 100).
  percent: number;
  remaining: number;
  // Where the bar "should" be today if sales were even across the month.
  expectedPercent: number;
  // revenue − expected revenue by today: positive = ahead of pace.
  paceDiff: number;
  // Soles per day needed from today (included) to reach the goal.
  dailyNeeded: number;
  daysLeft: number;
  mood: GoalMood;
}

// What the cashier sees: motivation without the till's figures.
export type CashierGoalProgress = Pick<GoalProgress, "month" | "percent" | "mood"> & {
  hasGoal: boolean;
};
