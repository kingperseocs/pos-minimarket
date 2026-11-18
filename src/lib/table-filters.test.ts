import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchesQuery,
  matchesStatus,
  normalizeText,
  paramText,
  parseId,
  parseStatus,
} from "./table-filters";

describe("normalizeText", () => {
  it("ignores case and accents", () => {
    assert.equal(normalizeText("  JAMÓN Ahumado "), "jamon ahumado");
    assert.equal(normalizeText("Pequeñín"), "pequenin");
  });
});

describe("matchesQuery", () => {
  it("matches everything without a query", () => {
    assert.equal(matchesQuery("", "Coca-Cola"), true);
    assert.equal(matchesQuery(undefined, "Coca-Cola"), true);
  });

  it("finds a word regardless of accents and case", () => {
    assert.equal(matchesQuery("jamon", "Crackelet Jamón 47 g"), true);
    assert.equal(matchesQuery("GALLETAS", "Galletas saladas"), true);
  });

  it("needs every word, in any field", () => {
    assert.equal(matchesQuery("coca 500", "Coca-Cola 500 ml"), true);
    assert.equal(matchesQuery("coca 1.5", "Coca-Cola 500 ml"), false);
    // RUC in one field, name in another.
    assert.equal(matchesQuery("2060 felix", "20606823283", "Felix Distribuidora"), true);
  });

  it("skips empty fields", () => {
    assert.equal(matchesQuery("800436", null, "Crackelet", "800436"), true);
    assert.equal(matchesQuery("x", null, undefined), false);
  });
});

describe("status and ids from the URL", () => {
  it("reads the status", () => {
    assert.equal(parseStatus("activos"), "active");
    assert.equal(parseStatus("inactivos"), "inactive");
    assert.equal(parseStatus("todos"), null);
    assert.equal(parseStatus(undefined), null);
  });

  it("filters by status", () => {
    assert.equal(matchesStatus(null, false), true);
    assert.equal(matchesStatus("active", true), true);
    assert.equal(matchesStatus("active", false), false);
    assert.equal(matchesStatus("inactive", false), true);
  });

  it("reads ids and text safely", () => {
    assert.equal(parseId("5"), 5);
    assert.equal(parseId(["7", "8"]), 7);
    assert.equal(parseId("abc"), null);
    assert.equal(parseId("-2"), null);
    assert.equal(paramText(["coca", "x"]), "coca");
    assert.equal(paramText(undefined), "");
  });
});
