import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SalesTotals } from "../entities/sales-analytics";
import { periodRanges, storeDaysBetween } from "./analytics-period";
import {
  buildSalesInsights,
  formatHourRange,
  type InsightInput,
  percentChange,
} from "./sales-insights";

const totals = (overrides: Partial<SalesTotals> = {}): SalesTotals => ({
  revenue: 0,
  orders: 0,
  units: 0,
  workerDiscount: 0,
  birthdayGifts: 0,
  workerRevenue: 0,
  profit: null,
  costCoverage: 0,
  ...overrides,
});

const input = (overrides: Partial<InsightInput> = {}): InsightInput => ({
  period: "7d",
  current: totals({ revenue: 1180, orders: 59 }),
  previous: totals({ revenue: 1000, orders: 50 }),
  daily: [],
  hourly: [],
  topProducts: [],
  categories: [],
  payments: [],
  ...overrides,
});

describe("periodRanges", () => {
  // 04/10/2026, 15:00 in Lima.
  const now = new Date("2026-10-04T20:00:00Z");

  it("compares today with yesterday up to the same hour", () => {
    const { current, previous, currentDays } = periodRanges("today", now);
    assert.equal(current.from.toISOString(), "2026-10-04T05:00:00.000Z");
    assert.equal(previous.from.toISOString(), "2026-10-03T05:00:00.000Z");
    assert.equal(previous.to.toISOString(), "2026-10-03T20:00:00.000Z");
    assert.deepEqual(currentDays, ["2026-10-04"]);
  });

  it("covers 7 days including today, against the 7 before", () => {
    const { currentDays, previousDays } = periodRanges("7d", now);
    assert.equal(currentDays.length, 7);
    assert.equal(currentDays[0], "2026-09-28");
    assert.equal(currentDays.at(-1), "2026-10-04");
    assert.equal(previousDays[0], "2026-09-21");
    assert.equal(previousDays.at(-1), "2026-09-27");
  });

  it("compares this month so far with the same days of last month", () => {
    const { current, previous } = periodRanges("month", now);
    assert.equal(current.from.toISOString(), "2026-10-01T05:00:00.000Z");
    assert.equal(previous.from.toISOString(), "2026-09-01T05:00:00.000Z");
    assert.equal(previous.to.toISOString(), "2026-09-04T20:00:00.000Z");
  });

  it("stops a short previous month at its own end", () => {
    const { previous } = periodRanges("month", new Date("2027-03-31T20:00:00Z"));
    assert.equal(previous.to.toISOString(), "2027-03-01T04:59:59.999Z");
  });

  it("lists store days, not UTC days", () => {
    assert.deepEqual(
      storeDaysBetween(new Date("2026-10-02T05:00:00Z"), new Date("2026-10-04T04:00:00Z")),
      ["2026-10-02", "2026-10-03"],
    );
  });
});

describe("percentChange", () => {
  it("rounds to whole percent and has no value without a base", () => {
    assert.equal(percentChange(1180, 1000), 18);
    assert.equal(percentChange(850, 1000), -15);
    assert.equal(percentChange(100, 0), null);
  });
});

describe("formatHourRange", () => {
  it("speaks like people do", () => {
    assert.equal(formatHourRange(18), "de 6 a 7 de la tarde");
    assert.equal(formatHourRange(8), "de 8 a 9 de la mañana");
    assert.equal(formatHourRange(20), "de 8 a 9 de la noche");
  });
});

describe("buildSalesInsights", () => {
  it("says sales went up, with the amounts", () => {
    const { headline } = buildSalesInsights(input());
    assert.equal(headline.tone, "good");
    assert.equal(headline.title, "Tus ventas subieron 18%");
    assert.match(headline.detail, /los 7 días anteriores/);
  });

  it("says sales went down", () => {
    const { headline } = buildSalesInsights(
      input({ current: totals({ revenue: 850, orders: 40 }) }),
    );
    assert.equal(headline.tone, "bad");
    assert.equal(headline.title, "Tus ventas bajaron 15%");
  });

  it("calls a small change stable", () => {
    const { headline } = buildSalesInsights(
      input({ current: totals({ revenue: 1020, orders: 50 }) }),
    );
    assert.equal(headline.tone, "neutral");
    assert.equal(headline.title, "Tus ventas se mantienen estables");
  });

  it("has nothing to compare against without previous sales", () => {
    const { headline } = buildSalesInsights(input({ previous: totals() }));
    assert.equal(headline.tone, "neutral");
    assert.match(headline.detail, /Aún no hay con qué comparar/);
  });

  it("names the star product, best day and peak hour", () => {
    const { insights } = buildSalesInsights(
      input({
        topProducts: [{ productId: 1, name: "Inca Kola 500 ml", units: 42, revenue: 147 }],
        daily: [
          { dateKey: "2026-10-01", revenue: 100, orders: 5 },
          { dateKey: "2026-10-02", revenue: 300, orders: 12 },
        ],
        hourly: [
          { hour: 9, revenue: 100, orders: 4 },
          { hour: 18, revenue: 400, orders: 15 },
        ],
      }),
    );
    const titles = insights.map((i) => i.title);
    assert.ok(titles.includes("Tu producto estrella: Inca Kola 500 ml"));
    assert.ok(titles.some((t) => t.startsWith("Tu mejor día fue el viernes")));
    assert.ok(titles.includes("Vendes más de 6 a 7 de la tarde"));
  });

  it("explains profit per S/ 10 sold", () => {
    const { insights } = buildSalesInsights(
      input({ current: totals({ revenue: 1000, orders: 50, profit: 250, costCoverage: 1 }) }),
    );
    const profit = insights.find((i) => i.icon === "coins");
    // Intl puts a no-break space after "S/".
    assert.match(profit?.title ?? "", /^Ganaste aprox\. S\/\s250\.00$/);
    assert.match(profit?.detail ?? "", /S\/ 2\.50/);
  });
});
