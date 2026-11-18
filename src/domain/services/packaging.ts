import { ValidationError } from "../errors";

// Supplier catalogs describe how a product ships: "16 x 6 x 31.5 g" means a
// box of 16 packs, each pack with 6 units, each unit weighing 31.5 g. The till
// sells the unit; the outer levels become presentations (Paquete, Caja…).

export const NET_UNITS = ["g", "kg", "ml", "l"] as const;
export type NetUnit = (typeof NET_UNITS)[number];

export const NET_UNIT_LABELS: Record<NetUnit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "L",
};

export const MAX_PACK_LEVELS = 3;
// Ways one product can ship (36 x 47 g, 6 x 6 x 47 g…).
export const MAX_PACK_FORMATS = 5;

export type PackFormat = {
  // Outermost first: [16, 6] = 16 packs per box, 6 units per pack.
  counts: number[];
  netContent: number | null;
  unit: NetUnit | null;
};

const UNIT_ALIASES: Record<string, NetUnit> = {
  g: "g",
  gr: "g",
  grs: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  lt: "l",
  lts: "l",
};

const toNumber = (raw: string) => Number(raw.replace(",", "."));

// "12 x 30 x 11.8 g", "16x6x31,5g", "24 × 500 ml", "12 x 1 kg". The last
// factor is the unit's content when it has a unit or a decimal; otherwise
// every factor is a count ("12 x 24": box of 12 packs of 24 units).
export function parsePackFormat(text: string): PackFormat | null {
  const parts = text
    .trim()
    .toLowerCase()
    .split(/\s*[x×*]\s*/)
    .filter(Boolean);
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1].match(/^(\d+(?:[.,]\d+)?)\s*([a-z]*)\.?$/);
  if (!last) return null;
  const [, lastNumber, lastUnit] = last;
  if (lastUnit && !(lastUnit in UNIT_ALIASES)) return null;

  const isContent = lastUnit !== "" || /[.,]/.test(lastNumber);
  const countParts = isContent ? parts.slice(0, -1) : parts;
  if (countParts.length === 0 || countParts.length > MAX_PACK_LEVELS) return null;
  if (!countParts.every((part) => /^\d+$/.test(part))) return null;
  const counts = countParts.map(Number);
  if (counts.some((count) => count < 1)) return null;

  const netContent = isContent ? toNumber(lastNumber) : null;
  if (netContent !== null && !(netContent > 0)) return null;

  return {
    counts,
    netContent,
    unit: isContent ? (lastUnit ? UNIT_ALIASES[lastUnit] : null) : null,
  };
}

const DEFAULT_NAMES: Record<number, string[]> = {
  1: ["Caja"],
  2: ["Caja", "Paquete"],
  3: ["Caja", "Display", "Paquete"],
};

export function defaultLevelNames(levels: number): string[] {
  return DEFAULT_NAMES[levels] ?? [];
}

export type PackLevel = {
  name: string;
  // How many of the next level in (or units, for the innermost) it holds.
  qtyOfParent: number;
  unitsTotal: number;
  // Name of what it contains; null = units.
  contains: string | null;
};

// Outermost first, like the catalog: Caja (16 Paquete = 96 und), Paquete (6 und).
export function packLevels(names: string[], counts: number[]): PackLevel[] {
  const levels: PackLevel[] = [];
  let units = 1;
  for (let i = counts.length - 1; i >= 0; i--) {
    units *= counts[i];
    levels.unshift({
      name: names[i]?.trim() || `Nivel ${i + 1}`,
      qtyOfParent: counts[i],
      unitsTotal: units,
      contains: i === counts.length - 1 ? null : names[i + 1]?.trim() || `Nivel ${i + 2}`,
    });
  }
  return levels;
}

export function formatNetContent(
  netContent: number | null,
  unit: NetUnit | null,
): string | null {
  if (netContent === null || unit === null) return null;
  const amount = Number.isInteger(netContent)
    ? String(netContent)
    : String(Number(netContent.toFixed(3)));
  return `${amount} ${NET_UNIT_LABELS[unit]}`;
}

// Default names that carry their counts, so two formats of the same product
// never collide: [6, 6] → "Caja 6×6", "Paquete x6"; [36] → "Caja x36".
export function formatLevelNames(counts: number[]): string[] {
  const bases = defaultLevelNames(counts.length);
  return counts.map((_, i) => {
    const rest = counts.slice(i);
    const suffix = rest.length === 1 ? `x${rest[0]}` : rest.join("×");
    return `${bases[i] ?? "Nivel"} ${suffix}`;
  });
}

// One way the supplier ships the product, outermost level first, with the
// code to order it.
export type FormatPlanInput = {
  levels: { name: string; qtyOfParent: number }[];
  supplierCode: string | null;
};

// A presentation to create; `parent` is the index (in the plan) of the level
// it contains, null = units. Innermost first, so parents exist before.
export type PlannedPresentation = {
  name: string;
  qtyOfParent: number;
  parent: number | null;
  unitsTotal: number;
  supplierCode: string | null;
};

// Turns the supplier's formats of one product into presentations:
// - a level inside two formats (the same "Paquete x6") is created once;
// - the outermost level of each format is what is ordered, so it gets the
//   format's supplier code;
// - every presentation must end up with its own name.
// Throws a ValidationError when that can't hold.
export function planPackaging(formats: FormatPlanInput[]): PlannedPresentation[] {
  const plan: PlannedPresentation[] = [];
  // Chain of counts from a level inward ("6", "6×6"), for inner levels
  // only: outer levels are never shared.
  const innerByChain = new Map<string, number>();

  for (const format of formats) {
    let parent: number | null = null;
    let units = 1;
    const levels = format.levels;
    for (let i = levels.length - 1; i >= 0; i--) {
      const level = levels[i];
      units *= level.qtyOfParent;
      const chain = levels
        .slice(i)
        .map((l) => l.qtyOfParent)
        .join("×");
      const isOuter = i === 0;
      const shared = isOuter ? undefined : innerByChain.get(chain);
      if (shared !== undefined) {
        parent = shared;
        continue;
      }
      plan.push({
        name: level.name.trim(),
        qtyOfParent: level.qtyOfParent,
        parent,
        unitsTotal: units,
        supplierCode: isOuter ? format.supplierCode : null,
      });
      parent = plan.length - 1;
      if (!isOuter) innerByChain.set(chain, parent);
    }
  }

  const seen = new Set<string>();
  for (const item of plan) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) {
      throw new ValidationError(
        `Dos presentaciones se llaman «${item.name}»: cambia el nombre de una`,
      );
    }
    seen.add(key);
  }
  return plan;
}

// Units said in packs when they fit: 36 with "Paquete x6" → "6 Paquete x6",
// 32 → "5 Paquete x6 + 2 sueltas". Without a pack (or with fewer units than
// one), just the units.
export function describeUnits(
  units: number,
  pack: { name: string; unitsTotal: number } | null,
): string {
  const loose = (n: number) => `${n} ${n === 1 ? "suelta" : "sueltas"}`;
  if (!pack || pack.unitsTotal <= 1 || units < pack.unitsTotal) return `${units} und`;
  const packs = Math.floor(units / pack.unitsTotal);
  const rest = units - packs * pack.unitsTotal;
  return rest === 0 ? `${packs} ${pack.name}` : `${packs} ${pack.name} + ${loose(rest)}`;
}
