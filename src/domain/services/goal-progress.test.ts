import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeGoalProgress, moodFor, storeMonthKey } from "./goal-progress";

// Noon in Lima on the given day.
const lima = (dateKey: string) => new Date(`${dateKey}T12:00:00.000-05:00`);

describe("computeGoalProgress", () => {
  it("starts the month at 0% with the dog asleep", () => {
    const p = computeGoalProgress({ goal: 20000, revenue: 0, now: lima("2026-11-01") });
    assert.equal(p.percent, 0);
    assert.equal(p.remaining, 20000);
    assert.equal(p.mood, "sleeping");
    assert.equal(p.daysLeft, 30);
    assert.equal(p.dailyNeeded, round(20000 / 30));
  });

  it("compares against the even pace mid-month", () => {
    const p = computeGoalProgress({ goal: 20000, revenue: 9000, now: lima("2026-11-15") });
    assert.equal(p.percent, 45);
    assert.equal(p.expectedPercent, 50);
    assert.equal(p.paceDiff, -1000);
    assert.equal(p.daysLeft, 16);
    assert.equal(p.mood, "walking");
  });

  it("keeps the real percent above 100 and celebrates", () => {
    const p = computeGoalProgress({ goal: 20000, revenue: 23000, now: lima("2026-11-20") });
    assert.equal(p.percent, 115);
    assert.equal(p.remaining, 0);
    assert.equal(p.dailyNeeded, 0);
    assert.equal(p.mood, "celebrating");
  });

  it("handles the last day of the month", () => {
    const p = computeGoalProgress({ goal: 20000, revenue: 19000, now: lima("2026-02-28") });
    assert.equal(p.daysLeft, 1);
    assert.equal(p.expectedPercent, 100);
    assert.equal(p.dailyNeeded, 1000);
  });

  it("returns an empty progress without a goal", () => {
    const p = computeGoalProgress({ goal: null, revenue: 500, now: lima("2026-11-10") });
    assert.equal(p.goal, null);
    assert.equal(p.percent, 0);
    assert.equal(p.revenue, 500);
    assert.equal(p.inherited, false);
  });

  it("uses the store's month, not UTC", () => {
    // 2026-12-01 03:00 UTC is still November 30 in Lima.
    assert.equal(storeMonthKey(new Date("2026-12-01T03:00:00Z")), "2026-11");
  });
});

describe("moodFor", () => {
  it("follows the thresholds", () => {
    assert.deepEqual(
      [0, 24.99, 25, 50, 75, 99.99, 100].map(moodFor),
      ["sleeping", "sleeping", "walking", "running", "excited", "excited", "celebrating"],
    );
  });
});

function round(value: number) {
  return Math.round(value * 100) / 100;
}
