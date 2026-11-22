import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShiftPattern, WorkSchedule } from "../entities/attendance";
import { scheduleFor } from "./attendance";
import { datesInRange, expandTemplate, planPaste, shiftMinutes } from "./work-shifts";

// 2026-11-16 is a Monday.
const MONDAY = "2026-11-16";
const TUESDAY = "2026-11-17";
const WEDNESDAY = "2026-11-18";

const juan: ShiftPattern = {
  userId: 7,
  startTime: "08:00",
  endTime: "16:00",
  toleranceMin: 10,
  earlyMin: 5,
  color: "#ea580c",
  note: null,
};
const ana: ShiftPattern = { ...juan, userId: 8, startTime: "14:00", endTime: "22:00", color: "#1d4ed8" };

describe("planPaste", () => {
  it("pastes one shift on many days", () => {
    const plan = planPaste([juan], [TUESDAY, WEDNESDAY], [], false);
    assert.deepEqual(
      plan.toCreate.map((s) => [s.userId, s.workDate, s.startTime, s.endTime]),
      [
        [7, TUESDAY, "08:00", "16:00"],
        [7, WEDNESDAY, "08:00", "16:00"],
      ],
    );
    assert.equal(plan.skipped.length, 0);
  });

  it("skips a person who already works that day, unless overwriting", () => {
    const existing = [{ userId: 7, workDate: TUESDAY }];
    const skip = planPaste([juan, ana], [TUESDAY], existing, false);
    assert.deepEqual(skip.toCreate.map((s) => s.userId), [8]);
    assert.deepEqual(skip.skipped.map((s) => s.userId), [7]);

    const replace = planPaste([juan, ana], [TUESDAY], existing, true);
    assert.deepEqual(replace.toCreate.map((s) => s.userId), [8]);
    assert.deepEqual(replace.toReplace.map((s) => s.userId), [7]);
    assert.equal(replace.skipped.length, 0);
  });

  it("one shift per person and date, even if copied twice", () => {
    const plan = planPaste([juan, { ...juan, startTime: "10:00" }], [TUESDAY, TUESDAY], [], false);
    assert.equal(plan.toCreate.length, 1);
    assert.equal(plan.toCreate[0].startTime, "08:00");
  });
});

describe("datesInRange", () => {
  it("every day, or only some weekdays", () => {
    assert.deepEqual(datesInRange(MONDAY, WEDNESDAY), [MONDAY, TUESDAY, WEDNESDAY]);
    assert.deepEqual(datesInRange(MONDAY, "2026-11-22", [2, 3]), [TUESDAY, WEDNESDAY]);
    assert.deepEqual(datesInRange(WEDNESDAY, MONDAY), []);
  });
});

describe("expandTemplate", () => {
  it("lays the weekly template on the dates, and the calendar decides the shift", () => {
    const week: WorkSchedule[] = [
      { userId: 7, weekday: 1, startTime: "08:00", endTime: "16:00", toleranceMin: 10, earlyMin: 5 },
      { userId: 7, weekday: 3, startTime: "22:00", endTime: "06:00", toleranceMin: 5, earlyMin: 5 },
    ];
    const shifts = expandTemplate(week, MONDAY, "2026-11-22", () => "#15803d");
    assert.deepEqual(shifts.map((s) => s.workDate), [MONDAY, WEDNESDAY]);
    assert.equal(shifts[0].color, "#15803d");
    assert.equal(scheduleFor(TUESDAY, shifts), null);
    // Night shift: ends the next day.
    assert.equal(scheduleFor(WEDNESDAY, shifts)!.end.toISOString(), "2026-11-19T11:00:00.000Z");
  });
});

describe("shiftMinutes", () => {
  it("wraps past midnight", () => {
    assert.equal(shiftMinutes("08:00", "16:00"), 480);
    assert.equal(shiftMinutes("22:00", "06:00"), 480);
  });
});
