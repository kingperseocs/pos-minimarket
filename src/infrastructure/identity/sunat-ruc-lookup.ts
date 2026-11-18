import { RucNotFoundError } from "@/domain/errors";
import type { CompanyLookup } from "@/domain/repositories/company-lookup";
import { fetchSunatLookup } from "./sunat-client";

export type SunatCompanyItem = {
  apenomdenunciado?: string;
  direstablecimiento?: string;
  desdistrito?: string;
  desprovincia?: string;
  desdepartamento?: string;
};

type SunatRucResponse = { lista?: SunatCompanyItem[]; error?: string };

// SUNAT pads every field with spaces and doubles some inside the address.
const clean = (value: string | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim();

// "AV. REPUBLICA DE PANAMA - Nro: 3055 - URB. EL PALOMAR - SAN ISIDRO" plus
// " - LIMA - LIMA" (province, department). Empty parts are skipped.
export function parseSunatCompany(
  item: SunatCompanyItem,
): { businessName: string; address: string | null } | null {
  const businessName = clean(item.apenomdenunciado);
  if (!businessName) return null;

  const street = clean(item.direstablecimiento);
  const address = street
    ? [street, clean(item.desprovincia), clean(item.desdepartamento)]
        .filter(Boolean)
        .join(" - ")
    : null;

  return { businessName, address };
}

export class SunatRucLookup implements CompanyLookup {
  constructor(private readonly timeoutMs: number) {}

  async lookupRuc(ruc: string) {
    const data = await fetchSunatLookup<SunatRucResponse>(
      { accion: "obtenerDatosRuc", nroRuc: ruc },
      this.timeoutMs,
      "RUC",
    );

    const company = data.lista?.[0] ? parseSunatCompany(data.lista[0]) : null;
    if (!company) throw new RucNotFoundError();

    return { ruc, ...company };
  }
}
