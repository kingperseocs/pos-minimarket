// Port for looking up a Peruvian RUC (SUNAT taxpayer registry). Fills the
// supplier form; the admin can still correct what comes back.
// Implementations throw RucNotFoundError / IdentityServiceUnavailableError.
export interface CompanyLookup {
  lookupRuc(
    ruc: string,
  ): Promise<{ ruc: string; businessName: string; address: string | null }>;
}
