// Search and filters of the admin tables. They live in the URL (?q=…&estado=…)
// so a filtered list survives a reload and can be linked to.

// Lowercase, no accents: "jamon" finds "Jamón", "galletas" finds "GALLETAS".
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// Every word typed must appear in some field: "coca 500" finds
// "Coca-Cola 500 ml". An empty query matches everything.
export function matchesQuery(
  query: string | null | undefined,
  ...fields: (string | null | undefined)[]
): boolean {
  const words = normalizeText(query ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields
    .filter((field): field is string => Boolean(field))
    .map(normalizeText)
    .join(" ");
  return words.every((word) => haystack.includes(word));
}

export type StatusFilter = "active" | "inactive";

// ?estado=activos / inactivos; anything else is "all".
export function parseStatus(param: unknown): StatusFilter | null {
  if (param === "activos") return "active";
  if (param === "inactivos") return "inactive";
  return null;
}

export function matchesStatus(status: StatusFilter | null, isActive: boolean): boolean {
  return status === null || (status === "active") === isActive;
}

// A positive integer id from the URL, or null.
export function parseId(param: unknown): number | null {
  const id = Number(Array.isArray(param) ? param[0] : param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// The first value of a search param, as text.
export function paramText(param: unknown): string {
  const value = Array.isArray(param) ? param[0] : param;
  return typeof value === "string" ? value.slice(0, 100) : "";
}
