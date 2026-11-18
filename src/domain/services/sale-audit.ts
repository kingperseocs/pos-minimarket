import type { AuditFlag } from "../entities/audit";
import type { ProductCatalogEntry } from "../entities/product";
import type { WorkerStatus } from "../entities/worker";
import { round2 } from "../value-objects/money";
import { isBirthdayAt } from "./birthday";
import { discountUnitsLeft, maxSaleDiscount, promoLineDiscount } from "./sale-pricing";

const CENT = 0.01;

export interface SaleAuditContext {
  // What the POS actually charged, as stored (a gift is its own line).
  lines: {
    productId: number;
    unitPrice: number;
    quantity: number;
    // Recomputed gross amount (unitPrice × quantity).
    lineTotal: number;
    discountAmount: number;
    isGift: boolean;
  }[];
  // Current catalog entry per product id (missing = unknown product).
  catalog: Map<number, ProductCatalogEntry>;
  // Worker discount charged (sum of the paid lines' discounts).
  chargedDiscount: number;
  giftTotal: number;
  soldAt: Date;
  worker: { status: WorkerStatus; birthDate: string | null } | null;
  policy: {
    maxDiscountedUnitsPerDay: number;
    birthdayGiftMaxAmount: number;
  } | null;
  // Usage *before* this sale.
  usage: { discountedUnitsToday: number; giftUsedThisYear: boolean } | null;
  // Percentage the cashier chose for the worker, with the percent stored on
  // the server (never the client's).
  promo?: { percent: number } | null;
}

// Pure: decides which anomalies a sale has. Never throws — a sale is always
// accepted, only marked, because the customer already paid.
export function evaluateSaleFlags(ctx: SaleAuditContext): AuditFlag[] {
  const flags = new Set<AuditFlag>();

  for (const line of ctx.lines) {
    const catalog = ctx.catalog.get(line.productId);
    if (catalog === undefined || Math.abs(catalog.price - line.unitPrice) >= CENT) {
      flags.add("PRICE_MISMATCH");
      break;
    }
  }

  const discount = ctx.chargedDiscount;
  const gifts = ctx.lines.filter((line) => line.isGift);

  if (!ctx.worker) {
    // Only an identified worker may get a discount (or name a percentage).
    if (discount > 0 || ctx.promo) flags.add("DISCOUNT_MISMATCH");
    if (gifts.length > 0) flags.add("GIFT_NOT_BIRTHDAY");
    return [...flags];
  }

  if (ctx.worker.status !== "active") flags.add("WORKER_NOT_ACTIVE");

  if (discount > 0) {
    // The discount is the chosen percentage: without one (or without a
    // policy) none is allowed. Each line may take at most the percentage of
    // its units (checked per line, so an inflated line can't hide behind the
    // others), and the sale at most its best units still left of the
    // worker's daily allowance.
    const percent = ctx.promo?.percent ?? 0;
    const unitDiscount = (unitPrice: number) =>
      Math.min(promoLineDiscount(unitPrice, percent), round2(unitPrice));
    const overLine =
      !ctx.policy ||
      percent <= 0 ||
      ctx.lines.some((line) => {
        if (line.isGift) return line.discountAmount > 0;
        const max = round2(unitDiscount(line.unitPrice) * line.quantity);
        return line.discountAmount - max >= CENT;
      });
    if (overLine) {
      flags.add("DISCOUNT_MISMATCH");
    } else if (ctx.policy) {
      const unitsLeft = discountUnitsLeft(
        ctx.policy.maxDiscountedUnitsPerDay,
        ctx.usage?.discountedUnitsToday ?? 0,
      );
      const max = maxSaleDiscount(
        ctx.lines.map((line) => ({
          quantity: line.quantity,
          isGift: line.isGift,
          unitDiscount: unitDiscount(line.unitPrice),
        })),
        unitsLeft,
      );
      const units = ctx.lines.reduce((sum, line) => sum + (line.isGift ? 0 : line.quantity), 0);
      // Today's discounted purchase already used, fewer products than the
      // minimum, or more discounted units than allowed.
      if (unitsLeft === 0) flags.add("DAILY_LIMIT_EXCEEDED");
      else if (units < ctx.policy.maxDiscountedUnitsPerDay) flags.add("DISCOUNT_BELOW_MINIMUM");
      else if (discount - max >= CENT) flags.add("UNITS_LIMIT_EXCEEDED");
    }
  }

  if (gifts.length > 0) {
    if (!isBirthdayAt(ctx.worker.birthDate, ctx.soldAt)) flags.add("GIFT_NOT_BIRTHDAY");
    if (ctx.usage?.giftUsedThisYear) flags.add("GIFT_ALREADY_USED");
    const maxGift = ctx.policy?.birthdayGiftMaxAmount ?? 0;
    if (
      gifts.length > 1 ||
      gifts[0].quantity !== 1 ||
      gifts[0].unitPrice - maxGift >= CENT
    ) {
      flags.add("GIFT_OVER_LIMIT");
    }
  }

  return [...flags];
}
