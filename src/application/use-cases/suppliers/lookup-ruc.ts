import { RucNotFoundError } from "@/domain/errors";
import type { CompanyLookup } from "@/domain/repositories/company-lookup";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { isValidRuc } from "@/domain/services/ruc";
import { withTimeout } from "@/application/use-cases/workers/lookup-dni";

export type RucLookupResult =
  | { status: "found"; businessName: string; address: string | null }
  | { status: "registered"; supplierName: string }
  | { status: "not_found" }
  | { status: "unavailable" };

// Never throws for SUNAT problems: "not_found"/"unavailable" tell the form to
// let the admin type the business name by hand.
export async function lookupRucUseCase(
  deps: {
    suppliers: Pick<SupplierRepository, "findNameByRuc">;
    companies: CompanyLookup;
  },
  input: { ruc: unknown; excludeId?: unknown },
  timeoutMs: number,
): Promise<RucLookupResult> {
  const ruc = typeof input.ruc === "string" ? input.ruc.trim() : "";
  // The form only asks for valid RUCs; anything else is simply not found.
  if (!isValidRuc(ruc)) return { status: "not_found" };
  const excludeId =
    typeof input.excludeId === "number" && Number.isInteger(input.excludeId)
      ? input.excludeId
      : undefined;

  const existing = await deps.suppliers.findNameByRuc(ruc, excludeId);
  if (existing) return { status: "registered", supplierName: existing };

  try {
    const company = await withTimeout(deps.companies.lookupRuc(ruc), timeoutMs);
    return {
      status: "found",
      businessName: company.businessName,
      address: company.address,
    };
  } catch (error) {
    if (error instanceof RucNotFoundError) return { status: "not_found" };
    return { status: "unavailable" };
  }
}
