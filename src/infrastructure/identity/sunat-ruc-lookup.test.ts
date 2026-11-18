import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSunatCompany } from "./sunat-ruc-lookup";

describe("parseSunatCompany", () => {
  it("cleans SUNAT's padded fields and builds the fiscal address", () => {
    // Real answer for RUC 20100130204 (trimmed padding).
    assert.deepEqual(
      parseSunatCompany({
        apenomdenunciado: "BANCO BBVA PERU                                    ",
        direstablecimiento:
          "AV. REPUBLICA DE PANAMA - Nro: 3055  - URBANIZACION EL PALOMAR  - SAN ISIDRO",
        desdistrito: "SAN ISIDRO                ",
        desprovincia: "LIMA                                  ",
        desdepartamento: "LIMA                                  ",
      }),
      {
        businessName: "BANCO BBVA PERU",
        address:
          "AV. REPUBLICA DE PANAMA - Nro: 3055 - URBANIZACION EL PALOMAR - SAN ISIDRO - LIMA - LIMA",
      },
    );
  });

  it("leaves the address empty when SUNAT has none", () => {
    assert.deepEqual(
      parseSunatCompany({ apenomdenunciado: "PEREZ QUISPE JUAN", desprovincia: "LIMA" }),
      { businessName: "PEREZ QUISPE JUAN", address: null },
    );
  });

  it("is null without a name", () => {
    assert.equal(parseSunatCompany({ apenomdenunciado: "   " }), null);
  });
});
