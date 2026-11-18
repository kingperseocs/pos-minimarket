import { IdentityServiceUnavailableError, RucNotFoundError } from "@/domain/errors";
import type { CompanyLookup } from "@/domain/repositories/company-lookup";

// Development stand-in for SUNAT. Two special (valid) RUCs exercise the
// failure paths from the UI:
// - 20000000001 → RUC not found
// - 20999999990 → service unavailable
export class MockRucLookup implements CompanyLookup {
  async lookupRuc(ruc: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (ruc === "20000000001") throw new RucNotFoundError();
    if (ruc === "20999999990") throw new IdentityServiceUnavailableError();

    return {
      ruc,
      businessName: `EMPRESA DE PRUEBA ${ruc.slice(-4)} S.A.C.`,
      address: "AV. LOS PINOS - Nro: 123 - MIRAFLORES - LIMA - LIMA",
    };
  }
}
