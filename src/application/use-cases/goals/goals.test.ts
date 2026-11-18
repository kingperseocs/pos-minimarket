import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import type { AuditEventInput } from "@/domain/entities/audit";
import type { SalesTotals } from "@/domain/entities/sales-analytics";
import type { SalesGoal } from "@/domain/entities/sales-goal";
import { ValidationError } from "@/domain/errors";
import { getCashierGoalProgressUseCase, getGoalProgressUseCase } from "./goal-progress";
import { setMonthlyGoalUseCase } from "./set-monthly-goal";

const lima = (dateKey: string) => new Date(`${dateKey}T12:00:00.000-05:00`);

function fakeGoals(initial: SalesGoal[] = []) {
  const rows = [...initial];
  return {
    rows,
    async findEffective(month: string) {
      return (
        rows
          .filter((g) => g.month <= month)
          .sort((a, b) => b.month.localeCompare(a.month) || b.id - a.id)[0] ?? null
      );
    },
    async create(data: { month: string; amount: number }, actorId: number) {
      const goal: SalesGoal = {
        id: rows.length + 1,
        ...data,
        createdById: actorId,
        createdAt: new Date(),
      };
      rows.push(goal);
      return goal;
    },
  };
}

const analytics = (revenue: number) => ({
  async totals() {
    return { revenue } as SalesTotals;
  },
});

const goal = (month: string, amount: number, id = 1): SalesGoal => ({
  id,
  month,
  amount,
  createdById: 1,
  createdAt: new Date(),
});

describe("getGoalProgressUseCase", () => {
  it("uses the month's goal", async () => {
    const p = await getGoalProgressUseCase(
      { goals: fakeGoals([goal("2026-11", 20000)]), analytics: analytics(5000) },
      lima("2026-11-10"),
    );
    assert.equal(p.goal, 20000);
    assert.equal(p.percent, 25);
    assert.equal(p.inherited, false);
  });

  it("inherits the latest earlier goal", async () => {
    const p = await getGoalProgressUseCase(
      { goals: fakeGoals([goal("2026-09", 15000)]), analytics: analytics(0) },
      lima("2026-11-10"),
    );
    assert.equal(p.goal, 15000);
    assert.equal(p.inherited, true);
  });

  it("gives the cashier only the percentage", async () => {
    const p = await getCashierGoalProgressUseCase(
      { goals: fakeGoals([goal("2026-11", 20000)]), analytics: analytics(10000) },
      lima("2026-11-10"),
    );
    assert.deepEqual(p, { month: "2026-11", percent: 50, mood: "running", hasGoal: true });
  });
});

describe("setMonthlyGoalUseCase", () => {
  function deps() {
    const events: AuditEventInput[] = [];
    return {
      events,
      goals: fakeGoals([goal("2026-10", 18000)]),
      audit: { async record(e: AuditEventInput) { events.push(e); } },
    };
  }

  it("creates a version and records the change", async () => {
    const d = deps();
    await setMonthlyGoalUseCase(d, { month: "2026-11", amount: "20000" }, 7, lima("2026-11-17"));
    assert.equal(d.goals.rows.length, 2);
    assert.equal(d.events[0].type, "goal_changed");
    assert.equal(d.events[0].actorId, 7);
    assert.deepEqual(d.events[0].payload, {
      month: "2026-11",
      from: { month: "2026-10", amount: 18000 },
      to: 20000,
      goalId: 2,
    });
  });

  it("rejects past months", async () => {
    await assert.rejects(
      setMonthlyGoalUseCase(deps(), { month: "2026-10", amount: 20000 }, 7, lima("2026-11-17")),
      ValidationError,
    );
  });

  it("rejects invalid amounts", async () => {
    await assert.rejects(
      setMonthlyGoalUseCase(deps(), { month: "2026-11", amount: 0 }, 7, lima("2026-11-17")),
      ZodError,
    );
  });
});
