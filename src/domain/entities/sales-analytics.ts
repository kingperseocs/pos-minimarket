import type { PaymentType } from "./sale";

// The windows the admin compares. Every period is compared against the one
// right before it, of the same length and up to the same time of day, so a
// half-finished day is never compared against a whole one.
export type AnalyticsPeriod = "today" | "7d" | "30d" | "month";

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = ["today", "7d", "30d", "month"];

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: "Hoy",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  month: "Este mes",
};

// How the previous window is named in sentences: fits after "frente a",
// "más que" and "comparado con".
export const PREVIOUS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: "ayer a esta hora",
  "7d": "los 7 días anteriores",
  "30d": "los 30 días anteriores",
  month: "lo que llevabas el mes pasado",
};

export interface SalesTotals {
  // What customers paid (sales.total), completed sales only.
  revenue: number;
  orders: number;
  units: number;
  workerDiscount: number;
  birthdayGifts: number;
  // Paid by identified airport workers.
  workerRevenue: number;
  // Revenue minus the cost of what was sold, over the lines whose product
  // had a cost when sold. null when no line had one.
  profit: number | null;
  // Share of units whose cost was known (0–1): below 1 the profit is a floor.
  costCoverage: number;
}

export interface DailySales {
  // YYYY-MM-DD in the store's zone.
  dateKey: string;
  revenue: number;
  orders: number;
}

export interface HourlySales {
  // 0–23, store time.
  hour: number;
  revenue: number;
  orders: number;
}

export interface ProductSales {
  productId: number;
  name: string;
  units: number;
  revenue: number;
}

export interface CategorySales {
  categoryId: number;
  name: string;
  revenue: number;
}

export interface PaymentSales {
  paymentType: PaymentType;
  revenue: number;
  orders: number;
}
