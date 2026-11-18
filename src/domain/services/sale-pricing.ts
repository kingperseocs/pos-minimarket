import { round2, saleRounding } from "../value-objects/money";

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  // One unit of this line is the worker's birthday gift.
  isGift?: boolean;
}

export interface WorkerDiscountRule {
  pointsPerSol: number;
  // Units of the purchase that get the chosen percentage, taken in basket
  // order (the first 3).
  unitsPerSale: number;
  // Fewest units the purchase must have for any discount (3: with 1 or 2
  // products there is none). Absent = no minimum.
  minUnits?: number;
  // False when the worker already used today's discounted units: the sale
  // still earns points, but charges full price.
  discountAllowed?: boolean;
  // True on the worker's birthday while this year's gift is unused.
  giftAllowed?: boolean;
  // Highest price the gift may have.
  giftMaxAmount?: number;
  // Points worth S/ 1 off when redeemed (0 or absent = no redemption).
  redeemPointsPerSol?: number;
  // Fewest points the worker must hold to redeem.
  minRedeemPoints?: number;
}

export interface LinePricing {
  gross: number;
  // The percentage's discount per unit when it was applied to this line, else 0.
  discountUnitAmount: number;
  discountedQuantity: number;
  discountAmount: number;
  // True when one unit of the line went as the birthday gift.
  isGift: boolean;
  giftAmount: number;
  // What the customer pays for the line.
  net: number;
}

export interface SalePricing {
  subtotal: number;
  // Worker discount; the birthday gift is tracked apart (giftTotal).
  discountTotal: number;
  // The percentage actually applied (null without a worker, without a
  // chosen percentage, or past the worker's daily limit).
  promo: PromoDiscountRule | null;
  giftTotal: number;
  // Added to reach whole soles when there is a discount (−0.32: S/ 20.32 is
  // charged S/ 20.00); 0 without discount.
  rounding: number;
  // Whole soles paid with the worker's points, and the points they cost
  // (0 when none). Taken off after the discount and the rounding.
  redeemTotal: number;
  pointsRedeemed: number;
  total: number;
  // Earned on what is actually paid (after the points redeemed).
  pointsEarned: number;
  // Set when the worker's discount was chosen but the purchase has fewer
  // units than the minimum (2 of 3): no discount until it reaches it.
  belowMinimum: { have: number; need: number } | null;
  // True when some units had a discount but the per-purchase limit left them
  // at full price.
  unitsCapped: boolean;
  lines: LinePricing[];
}

// The percentage (1–100) the cashier chose for an identified worker, from the
// list the admin keeps in Descuentos. It applies to the first
// `unitsPerSale` units of the basket only.
export interface PromoDiscountRule {
  id: number;
  percent: number;
}

// Discount `percent` takes off `amount` (also what the server audits
// against).
export function promoLineDiscount(gross: number, percent: number) {
  const pct = Math.min(Math.max(0, percent), 100);
  return round2((gross * pct) / 100);
}

export type DiscountLimitReached = "daily" | null;

// The worker's discount, once a day: the first purchase of the day with at
// least N products (3) gets the percentage on N of them. Units already
// discounted today mean today's discounted purchase was used.
export function discountUnitsLeft(perPurchase: number, usedToday: number) {
  return usedToday > 0 ? 0 : Math.max(0, perPurchase);
}

// Turns the active policy and the worker's usage into the rule the POS
// prices with. Once today's discounted purchase is used the worker still
// earns points; the sale simply has no discount (and the POS tells the
// cashier why).
export function buildWorkerDiscountRule(
  policy: {
    maxDiscountedUnitsPerDay: number;
    pointsPerSol: number;
    birthdayGiftMaxAmount: number;
    redeemPointsPerSol?: number;
    minRedeemPoints?: number;
  },
  usage: { discountedUnitsToday: number },
  giftAvailable: boolean,
): { rule: WorkerDiscountRule; limitReached: DiscountLimitReached; unitsLeft: number } {
  const unitsLeft = discountUnitsLeft(policy.maxDiscountedUnitsPerDay, usage.discountedUnitsToday);
  const limitReached: DiscountLimitReached = unitsLeft === 0 ? "daily" : null;

  return {
    unitsLeft,
    rule: {
      pointsPerSol: policy.pointsPerSol,
      unitsPerSale: unitsLeft,
      minUnits: policy.maxDiscountedUnitsPerDay,
      discountAllowed: limitReached === null,
      giftAllowed: giftAvailable,
      giftMaxAmount: policy.birthdayGiftMaxAmount,
      redeemPointsPerSol: policy.redeemPointsPerSol ?? 0,
      minRedeemPoints: policy.minRedeemPoints ?? 0,
    },
    limitReached,
  };
}

export function lineTotal(line: { unitPrice: number; quantity: number }) {
  return round2(line.unitPrice * line.quantity);
}

// True when a product may be the birthday gift under this rule.
export function canBeGift(unitPrice: number, rule: WorkerDiscountRule | null) {
  return (
    rule !== null &&
    (rule.giftAllowed ?? false) &&
    unitPrice <= (rule.giftMaxAmount ?? 0)
  );
}

// Most whole soles a worker's points can take off a sale: as many as the
// balance buys at the policy's rate, never more than what is left to pay.
// 0 without redemption, or while the balance is under the minimum.
export function maxRedeemableSoles(
  balance: number,
  rule: WorkerDiscountRule | null,
  payableTotal: number,
): number {
  const rate = rule?.redeemPointsPerSol ?? 0;
  if (!rule || rate <= 0 || balance <= 0) return 0;
  if (balance < (rule.minRedeemPoints ?? 0)) return 0;
  return Math.max(0, Math.min(Math.floor(balance / rate), Math.floor(round2(payableTotal))));
}

// Points that `soles` of redemption cost under this rule.
export function pointsForSoles(soles: number, rule: WorkerDiscountRule | null) {
  return Math.max(0, Math.floor(soles)) * (rule?.redeemPointsPerSol ?? 0);
}

// Single source of truth for how a sale is priced. The POS uses it to show the
// cashier the amount to charge, and the server checks what was charged
// against the same rules.
//
// Only an identified worker (rule !== null) gets a discount: the percentage
// the cashier chose (promo), on the first `unitsPerSale` units of the basket
// in order. On the worker's birthday one unit of one product (up to
// giftMaxAmount) is free and doesn't use up discounted units.
//
// `redeemSoles` are whole soles paid with the worker's points (the caller
// checks the balance with maxRedeemableSoles); they come off the rounded
// total, never below zero.
export function priceSale(
  lines: PricedLine[],
  rule: WorkerDiscountRule | null,
  promo: PromoDiscountRule | null = null,
  redeemSoles = 0,
): SalePricing {
  const allowed = rule !== null && (rule.discountAllowed ?? true);
  // Units that could take the discount (the birthday gift unit doesn't).
  const eligibleUnits =
    lines.reduce((sum, line) => sum + line.quantity, 0) -
    (lines.some((line) => line.isGift && canBeGift(line.unitPrice, rule)) ? 1 : 0);
  const wantsPromo = allowed && promo !== null && promo.percent > 0;
  const belowMinimum =
    wantsPromo && rule?.minUnits && eligibleUnits < rule.minUnits
      ? { have: Math.max(0, eligibleUnits), need: rule.minUnits }
      : null;
  const appliedPromo = wantsPromo && !belowMinimum ? promo : null;
  let unitsLeft = rule?.unitsPerSale ?? 0;
  let giftGiven = false;
  let unitsCapped = false;

  const priced: LinePricing[] = lines.map((line) => {
    const gross = lineTotal(line);

    const isGift = !giftGiven && (line.isGift ?? false) && canBeGift(line.unitPrice, rule);
    if (isGift) giftGiven = true;
    const giftAmount = isGift ? round2(line.unitPrice) : 0;

    const perUnit = appliedPromo
      ? Math.min(promoLineDiscount(line.unitPrice, appliedPromo.percent), round2(line.unitPrice))
      : 0;
    const eligible = line.quantity - (isGift ? 1 : 0);
    const discountedQuantity = perUnit > 0 ? Math.min(eligible, Math.max(0, unitsLeft)) : 0;
    if (perUnit > 0 && discountedQuantity < eligible) unitsCapped = true;
    unitsLeft -= discountedQuantity;
    const discountAmount = round2(perUnit * discountedQuantity);

    return {
      gross,
      discountUnitAmount: discountedQuantity > 0 ? perUnit : 0,
      discountedQuantity,
      discountAmount,
      isGift,
      giftAmount,
      net: round2(gross - discountAmount - giftAmount),
    };
  });

  const subtotal = round2(priced.reduce((sum, l) => sum + l.gross, 0));
  const discountTotal = round2(priced.reduce((sum, l) => sum + l.discountAmount, 0));
  const giftTotal = round2(priced.reduce((sum, l) => sum + l.giftAmount, 0));
  const rawTotal = round2(subtotal - discountTotal - giftTotal);
  const rounding = saleRounding(rawTotal, discountTotal);
  const payable = round2(rawTotal + rounding);
  const redeemTotal =
    rule && (rule.redeemPointsPerSol ?? 0) > 0
      ? Math.min(Math.max(0, Math.floor(redeemSoles)), Math.floor(payable))
      : 0;
  const total = round2(payable - redeemTotal);

  return {
    subtotal,
    discountTotal,
    giftTotal,
    rounding,
    redeemTotal,
    pointsRedeemed: pointsForSoles(redeemTotal, rule),
    total,
    pointsEarned: rule ? Math.floor(total * rule.pointsPerSol) : 0,
    unitsCapped,
    belowMinimum,
    promo: appliedPromo,
    lines: priced,
  };
}

// A line as the sale is stored: the gift unit travels as its own line of one
// unit, fully free, so every stored line is either paid or given away whole.
export interface SaleLine {
  // Index of the basket line it comes from.
  index: number;
  quantity: number;
  lineTotal: number;
  discountUnitAmount: number;
  discountAmount: number;
  isGift: boolean;
}

export function saleLines(
  lines: { unitPrice: number; quantity: number }[],
  pricing: SalePricing,
): SaleLine[] {
  return lines.flatMap((line, index) => {
    const p = pricing.lines[index];
    const paidQuantity = line.quantity - (p.isGift ? 1 : 0);
    const result: SaleLine[] = [];
    if (paidQuantity > 0) {
      result.push({
        index,
        quantity: paidQuantity,
        lineTotal: lineTotal({ unitPrice: line.unitPrice, quantity: paidQuantity }),
        discountUnitAmount: p.discountUnitAmount,
        discountAmount: p.discountAmount,
        isGift: false,
      });
    }
    if (p.isGift) {
      result.push({
        index,
        quantity: 1,
        lineTotal: round2(line.unitPrice),
        discountUnitAmount: 0,
        discountAmount: 0,
        isGift: true,
      });
    }
    return result;
  });
}

// Most discount the stored lines could carry: the `unitsPerSale` best unit
// discounts among the paid lines. The server checks the charged discount
// against it, whatever order the basket was in.
export function maxSaleDiscount(
  lines: { quantity: number; isGift: boolean; unitDiscount: number }[],
  unitsPerSale: number,
) {
  const units = lines
    .filter((line) => !line.isGift && line.unitDiscount > 0)
    .flatMap((line) => Array<number>(line.quantity).fill(line.unitDiscount))
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, unitsPerSale));
  return round2(units.reduce((sum, amount) => sum + amount, 0));
}

// Units of a sold line that took the discount (the line keeps its total and
// per-unit discount, not the count).
export function discountedQuantity(line: {
  discountAmount: number;
  discountUnitAmount: number;
}): number {
  if (!(line.discountAmount > 0) || !(line.discountUnitAmount > 0)) return 0;
  return Math.round(line.discountAmount / line.discountUnitAmount);
}

// The daily allowance of a cached policy (snapshots from before it carry the
// old per-sale count, which had the same default of 3).
export function unitsPerDayOf(policy: {
  maxDiscountedUnitsPerDay?: number;
  maxDiscountedUnitsPerSale?: number;
}): number {
  return policy.maxDiscountedUnitsPerDay ?? policy.maxDiscountedUnitsPerSale ?? 3;
}
