import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DniNotFoundError, IdentityServiceUnavailableError } from "@/domain/errors";
import type { CompanyLookup } from "@/domain/repositories/company-lookup";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";
import { lookupCustomerUseCase } from "./lookup-customer";

const identity: IdentityLookup = {
  async lookupDni(dni) {
    if (dni === "11111111") throw new DniNotFoundError();
    if (dni === "22222222") throw new IdentityServiceUnavailableError();
    return { dni, fullName: "JUAN PEREZ LOPEZ" };
  },
};
const companies: CompanyLookup = {
  async lookupRuc(ruc) {
    return { ruc, businessName: "ALICORP S.A.A.", address: "AV. ARGENTINA 4793" };
  },
};
const deps = { identity, companies };

describe("lookupCustomerUseCase", () => {
  it("finds a person by DNI and a company by RUC", async () => {
    assert.deepEqual(await lookupCustomerUseCase(deps, { docType: "1", number: "12345678" }, 1000), {
      status: "found",
      name: "JUAN PEREZ LOPEZ",
      address: null,
    });
    assert.deepEqual(await lookupCustomerUseCase(deps, { docType: "6", number: "20100055237" }, 1000), {
      status: "found",
      name: "ALICORP S.A.A.",
      address: "AV. ARGENTINA 4793",
    });
  });

  it("an invalid number is not found, without calling the provider", async () => {
    assert.deepEqual(await lookupCustomerUseCase(deps, { docType: "6", number: "20100055238" }, 1000), {
      status: "not_found",
    });
    assert.deepEqual(await lookupCustomerUseCase(deps, { docType: "1", number: "123" }, 1000), {
      status: "not_found",
    });
  });

  it("provider problems never throw", async () => {
    assert.deepEqual(await lookupCustomerUseCase(deps, { docType: "1", number: "11111111" }, 1000), {
      status: "not_found",
    });
    assert.deepEqual(await lookupCustomerUseCase(deps, { docType: "1", number: "22222222" }, 1000), {
      status: "unavailable",
    });
  });
});
