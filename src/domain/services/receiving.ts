import { ValidationError } from "../errors";
import { round2 } from "../value-objects/money";

// Costs per unit are kept with 4 decimals: a candy bought at S/ 12.00 the
// box of 144 costs S/ 0.0833, and rounding that to cents would distort the
// margin of every sale.
export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export interface ReceiptLineInput {
  quantity: number;
  // Units per presentation (1 for the unit itself, 144 for a Caja…).
  unitsPerPresentation: number;
  // What was paid for the whole line; ignored for bonus lines.
  lineTotal: number;
  // Given away by the supplier (S/ 0.00 on the invoice).
  isBonus: boolean;
}

export function receiptLineUnits(line: ReceiptLineInput): number {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    throw new ValidationError("La cantidad debe ser un número entero mayor a 0");
  }
  return line.quantity * line.unitsPerPresentation;
}

// Cost of one unit on this line: 0 for a bonus (it still enters stock and
// lowers the average cost, which is the point of a bonus).
export function receiptLineUnitCost(line: ReceiptLineInput): number {
  if (line.isBonus) return 0;
  return round4(line.lineTotal / receiptLineUnits(line));
}

// Weighted average purchase cost after receiving `inUnits` that cost
// `inTotal` altogether. Stock already on hand (all locations) keeps its
// current cost. Without known stock or cost, the new cost is the receipt's.
export function weightedAverageCost(input: {
  currentUnits: number;
  currentCost: number | null;
  inUnits: number;
  inTotal: number;
}): number | null {
  const { currentCost, inUnits, inTotal } = input;
  if (inUnits <= 0) return currentCost;
  const currentUnits = Math.max(0, input.currentUnits);
  if (currentCost === null || currentUnits === 0) return round4(inTotal / inUnits);
  return round4(
    (currentUnits * currentCost + inTotal) / (currentUnits + inUnits),
  );
}

// Average cost once a receipt counted earlier gets its invoice: its units
// are already part of `onHand`, so they are taken out of the "before" stock
// to not count them twice.
export function costAfterInvoice(input: {
  currentCost: number | null;
  onHand: number;
  receivedUnits: number;
  receivedTotal: number;
}): number | null {
  return weightedAverageCost({
    currentUnits: input.onHand - input.receivedUnits,
    currentCost: input.currentCost,
    inUnits: input.receivedUnits,
    inTotal: input.receivedTotal,
  });
}

// Invoiced against counted, per line: units < 0 were invoiced but didn't
// arrive, > 0 arrived without being invoiced. Amount at the line's cost.
export function invoiceGap(line: {
  units: number;
  receivedUnits: number;
  unitCost: number;
}): { units: number; amount: number } | null {
  const units = line.receivedUnits - line.units;
  if (units === 0) return null;
  return { units, amount: round2(Math.abs(units) * line.unitCost) };
}

export const MAX_RECEIPT_DISCOUNT_PERCENT = 90;

// What is paid for a line with the supplier's volume discount: S/ 230.00
// with 8% → S/ 211.60.
export function discountedLineTotal(listTotal: number, discountPercent: number) {
  if (discountPercent < 0 || discountPercent > MAX_RECEIPT_DISCOUNT_PERCENT) {
    throw new ValidationError(
      `El descuento debe estar entre 0 y ${MAX_RECEIPT_DISCOUNT_PERCENT}%`,
    );
  }
  return round2((listTotal * (100 - discountPercent)) / 100);
}

// "YYYY-MM-DD" plus `days`, as calendar days (no time zone involved).
function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The invoice is due the day it arrives, or after the supplier's credit days.
export function receiptDueDate(arrivalDay: string, creditDays: number | null) {
  return addDays(arrivalDay, creditDays && creditDays > 0 ? creditDays : 0);
}

// Days until an unpaid invoice is due (< 0: overdue by that many days).
export function daysUntilDue(dueDate: string, today: string) {
  const ms = Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// A transfer can only move what is physically in the origin.
export function checkTransfer(available: number, requested: number) {
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new ValidationError("La cantidad a trasladar debe ser mayor a 0");
  }
  if (requested > available) {
    throw new ValidationError(
      `Solo hay ${Math.max(0, available)} unidades en el Almacén y quieres trasladar ${requested}`,
    );
  }
}

export type DiscrepancyResolution =
  | "replenished"
  | "credited"
  | "written_off"
  | "kept"
  | "returned";

// What arrived minus what the invoice says: < 0 missing, > 0 extra.
export function receiptDiscrepancy(invoiceUnits: number, receivedUnits: number) {
  if (!Number.isInteger(receivedUnits) || receivedUnits < 0) {
    throw new ValidationError("Lo que llegó debe ser un número entero de 0 o más");
  }
  return receivedUnits - invoiceUnits;
}

// Missing units can be brought later, discounted or assumed as a loss;
// extra units are kept or given back.
export function allowedResolutions(units: number): DiscrepancyResolution[] {
  return units < 0
    ? ["replenished", "credited", "written_off"]
    : ["kept", "returned"];
}
