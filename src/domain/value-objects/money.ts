export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// To the whole sol, half up: 20.49 → 20, 20.50 → 21. round2 first, so a
// float like 20.499999 that is really 20.50 goes up.
export function roundToSol(value: number): number {
  return Math.round(round2(value));
}

// What a sale with a discount is rounded by so the customer pays whole soles
// (S/ 20.32 → S/ 20.00: −0.32). A sale without discount is charged exactly.
export function saleRounding(rawTotal: number, discountTotal: number): number {
  if (discountTotal <= 0) return 0;
  return round2(roundToSol(rawTotal) - rawTotal);
}
