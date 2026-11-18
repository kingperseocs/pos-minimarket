import { DniNotFoundError } from "@/domain/errors";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";
import { fetchSunatLookup } from "./sunat-client";

type SunatDniResponse = {
  lista?: { nombresapellidos?: string }[];
};

// SUNAT returns "APELLIDO_PATERNO APELLIDO_MATERNO, NOMBRES". The POS shows
// names as written on the DNI card front: "NOMBRES APELLIDOS".
export function parseSunatName(raw: string): string | null {
  const [surnamesPart, namesPart] = raw.split(",");
  const surnames = (surnamesPart ?? "").trim();
  const names = (namesPart ?? "").trim();
  const fullName = (names ? `${names} ${surnames}` : surnames)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return fullName.length > 0 ? fullName : null;
}

// Uses SUNAT's public DNI lookup. Any failure makes the POS fall back to
// typing the name manually.
export class SunatDniLookup implements IdentityLookup {
  constructor(private readonly timeoutMs: number) {}

  async lookupDni(dni: string) {
    const data = await fetchSunatLookup<SunatDniResponse>(
      { accion: "obtenerDatosDni", numDocumento: dni },
      this.timeoutMs,
      "DNI",
    );

    const raw = data.lista?.[0]?.nombresapellidos;
    const fullName = raw ? parseSunatName(raw) : null;
    if (!fullName) throw new DniNotFoundError("No se encontraron datos para este DNI");

    return { dni, fullName };
  }
}
