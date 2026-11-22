import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDayHeading } from "./day-heading";

describe("formatDayHeading", () => {
  it("weekday » dayº month, in capitals", () => {
    assert.equal(formatDayHeading("2026-11-22"), "DOMINGO » 22º NOVIEMBRE");
    assert.equal(formatDayHeading("2026-12-01"), "MARTES » 1º DICIEMBRE");
  });
});
