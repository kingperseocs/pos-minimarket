import {
  type AnalyticsPeriod,
  type DailySales,
  type HourlySales,
  PREVIOUS_PERIOD_LABELS,
} from "@/domain/entities/sales-analytics";
import type { SalesAnalyticsRepository } from "@/domain/repositories/sales-analytics-repository";
import { periodRanges } from "@/domain/services/analytics-period";
import {
  averageTicket,
  buildSalesInsights,
  peakHour,
  percentChange,
} from "@/domain/services/sales-insights";
import { storeDateKey, STORE_TIME_ZONE } from "@/domain/value-objects/store-time";

export interface TrendPoint {
  label: string;
  // Full label for the tooltip/table ("lunes 28 de septiembre", "6 pm").
  longLabel: string;
  current: number;
  // null past the end of the previous window (never drawn as zero).
  previous: number | null;
  // Still in progress (today, or the current hour): drawn dashed so a
  // half-finished day doesn't read as a drop.
  partial?: boolean;
}

const shortDay = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "numeric",
  timeZone: STORE_TIME_ZONE,
});
const longDay = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: STORE_TIME_ZONE,
});

function dayDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00-05:00`);
}

function hourLabel(hour: number) {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${hour < 12 ? "am" : "pm"}`;
}

// Today: hour by hour against yesterday. Longer periods: day by day, each
// day against the same position in the previous window.
function buildTrend(
  period: AnalyticsPeriod,
  days: { current: string[]; previous: string[] },
  daily: { current: DailySales[]; previous: DailySales[] },
  hourly: { current: HourlySales[]; previous: HourlySales[] },
  now: Date,
): { unit: "hour" | "day"; points: TrendPoint[] } {
  if (period === "today") {
    const byHour = (rows: HourlySales[]) => new Map(rows.map((r) => [r.hour, r.revenue]));
    const current = byHour(hourly.current);
    const previous = byHour(hourly.previous);
    const hours = [...current.keys(), ...previous.keys()];
    const nowHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: STORE_TIME_ZONE,
      }).format(now),
    );
    const first = Math.min(7, nowHour, ...hours);
    const last = Math.max(nowHour, ...hours);
    const points: TrendPoint[] = [];
    for (let hour = first; hour <= last; hour++) {
      points.push({
        label: hourLabel(hour),
        longLabel: `${hourLabel(hour)} – ${hourLabel(hour + 1)}${hour === nowHour ? " (en curso)" : ""}`,
        current: current.get(hour) ?? 0,
        previous: previous.get(hour) ?? 0,
        partial: hour === nowHour,
      });
    }
    return { unit: "hour", points };
  }

  const byDay = (rows: DailySales[]) => new Map(rows.map((r) => [r.dateKey, r.revenue]));
  const current = byDay(daily.current);
  const previous = byDay(daily.previous);
  const todayKey = storeDateKey(now);
  return {
    unit: "day",
    points: days.current.map((key, i) => {
      const previousKey = days.previous[i];
      const isToday = key === todayKey;
      return {
        label: isToday ? "hoy" : shortDay.format(dayDate(key)).replace(".", ""),
        longLabel: `${longDay.format(dayDate(key)).replace(",", "")}${isToday ? " (en curso)" : ""}`,
        current: current.get(key) ?? 0,
        previous: previousKey === undefined ? null : (previous.get(previousKey) ?? 0),
        partial: isToday,
      };
    }),
  };
}

// Everything the "Análisis de ventas" section shows, already explained in
// words. Plain data (no Dates) so it can cross to client components.
export async function getSalesAnalyticsUseCase(
  repo: SalesAnalyticsRepository,
  period: AnalyticsPeriod,
  now: Date = new Date(),
) {
  const ranges = periodRanges(period, now);
  const { current: cur, previous: prev } = ranges;

  const [
    current,
    previous,
    dailyCurrent,
    dailyPrevious,
    hourlyCurrent,
    hourlyPrevious,
    topProducts,
    categories,
    payments,
  ] = await Promise.all([
    repo.totals(cur.from, cur.to),
    repo.totals(prev.from, prev.to),
    repo.daily(cur.from, cur.to),
    repo.daily(prev.from, prev.to),
    repo.hourly(cur.from, cur.to),
    repo.hourly(prev.from, prev.to),
    repo.topProducts(cur.from, cur.to, 5),
    repo.byCategory(cur.from, cur.to),
    repo.byPayment(cur.from, cur.to),
  ]);

  const { headline, insights } = buildSalesInsights({
    period,
    current,
    previous,
    daily: dailyCurrent,
    hourly: hourlyCurrent,
    topProducts,
    categories,
    payments,
  });

  return {
    period,
    previousLabel: PREVIOUS_PERIOD_LABELS[period],
    todayKey: storeDateKey(now),
    isEmpty: current.orders === 0 && previous.orders === 0,
    current,
    previous,
    changes: {
      revenue: percentChange(current.revenue, previous.revenue),
      orders: percentChange(current.orders, previous.orders),
      averageTicket: percentChange(averageTicket(current), averageTicket(previous)),
      profit:
        current.profit !== null && previous.profit !== null && previous.profit > 0
          ? percentChange(current.profit, previous.profit)
          : null,
    },
    averageTicket: averageTicket(current),
    headline,
    insights,
    trend: buildTrend(
      period,
      { current: ranges.currentDays, previous: ranges.previousDays },
      { current: dailyCurrent, previous: dailyPrevious },
      { current: hourlyCurrent, previous: hourlyPrevious },
      now,
    ),
    hourly: hourlyCurrent,
    peakHour: peakHour(hourlyCurrent)?.hour ?? null,
    topProducts,
    categories,
    payments,
  };
}

export type SalesAnalyticsReport = Awaited<ReturnType<typeof getSalesAnalyticsUseCase>>;
