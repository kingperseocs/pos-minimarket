import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IdentityServiceUnavailableError, RucNotFoundError } from "@/domain/errors";
import type { CompanyLookup } from "@/domain/repositories/company-lookup";
import { lookupRucUseCase } from "./lookup-ruc";

const BBVA = "20100130204";

function deps(
  lookupRuc: CompanyLookup["lookupRuc"],
  registered: Record<string, string> = {},
) {
  return {
    suppliers: {
      findNameByRuc: async (ruc: string) => registered[ruc] ?? null,
    },
    companies: { lookupRuc },
  };
}

const found: CompanyLookup["lookupRuc"] = async (ruc) => ({
  ruc,
  businessName: "BANCO BBVA PERU",
  address: "AV. REPUBLICA DE PANAMA - LIMA - LIMA",
});

describe("lookupRucUseCase", () => {
  it("returns SUNAT's business name and address", async () => {
    assert.deepEqual(await lookupRucUseCase(deps(found), { ruc: BBVA }, 1000), {
      status: "found",
      businessName: "BANCO BBVA PERU",
      address: "AV. REPUBLICA DE PANAMA - LIMA - LIMA",
    });
  });

  it("reports a RUC already used by another supplier, without calling SUNAT", async () => {
    let called = false;
    const result = await lookupRucUseCase(
      deps(async (ruc) => {
        called = true;
        return found(ruc);
      }, { [BBVA]: "BBVA" }),
      { ruc: BBVA },
      1000,
    );
    assert.deepEqual(result, { status: "registered", supplierName: "BBVA" });
    assert.equal(called, false);
  });

  it("maps SUNAT's 'no data' to not_found", async () => {
    const result = await lookupRucUseCase(
      deps(async () => {
        throw new RucNotFoundError();
      }),
      { ruc: BBVA },
      1000,
    );
    assert.deepEqual(result, { status: "not_found" });
  });

  it("maps a SUNAT failure to unavailable", async () => {
    const result = await lookupRucUseCase(
      deps(async () => {
        throw new IdentityServiceUnavailableError();
      }),
      { ruc: BBVA },
      1000,
    );
    assert.deepEqual(result, { status: "unavailable" });
  });

  it("gives up on a slow SUNAT", async () => {
    const result = await lookupRucUseCase(
      deps(() => new Promise(() => {})),
      { ruc: BBVA },
      20,
    );
    assert.deepEqual(result, { status: "unavailable" });
  });

  it("does not query an invalid RUC", async () => {
    const result = await lookupRucUseCase(
      deps(async () => assert.fail("should not call SUNAT")),
      { ruc: "20100130205" },
      1000,
    );
    assert.deepEqual(result, { status: "not_found" });
  });
});
