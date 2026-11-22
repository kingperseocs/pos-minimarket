import { DniNotFoundError, RucNotFoundError } from "@/domain/errors";
import type { CompanyLookup } from "@/domain/repositories/company-lookup";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";
import { isValidRuc } from "@/domain/services/ruc";
import { withTimeout } from "@/application/use-cases/workers/lookup-dni";

export type CustomerLookupResult =
  | { status: "found"; name: string; address: string | null }
  | { status: "not_found" }
  | { status: "unavailable" };

// Name (and address, for a RUC) of the customer of a boleta or factura.
// Never throws for provider problems: "not_found" / "unavailable" let the
// cashier type the name by hand.
export async function lookupCustomerUseCase(
  deps: { identity: IdentityLookup; companies: CompanyLookup },
  input: { docType: unknown; number: unknown },
  timeoutMs: number,
): Promise<CustomerLookupResult> {
  const number = typeof input.number === "string" ? input.number.trim() : "";
  try {
    if (input.docType === "1") {
      if (!/^\d{8}$/.test(number)) return { status: "not_found" };
      const person = await withTimeout(deps.identity.lookupDni(number), timeoutMs);
      return { status: "found", name: person.fullName, address: null };
    }
    if (input.docType === "6") {
      if (!isValidRuc(number)) return { status: "not_found" };
      const company = await withTimeout(deps.companies.lookupRuc(number), timeoutMs);
      return { status: "found", name: company.businessName, address: company.address };
    }
    return { status: "not_found" };
  } catch (error) {
    if (error instanceof DniNotFoundError || error instanceof RucNotFoundError) {
      return { status: "not_found" };
    }
    return { status: "unavailable" };
  }
}
