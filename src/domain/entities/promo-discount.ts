// A percentage the admin offers (1–100) that the cashier may give an
// identified airport worker, on the first units of the purchase (see
// discount_policies). The percent is fixed at creation: offering another one
// means creating a new discount, so a sale charged offline still matches the
// discount it names when it syncs. Never deleted (sales reference it):
// deactivated instead.
export interface PromoDiscount {
  id: number;
  name: string;
  percent: number;
  isActive: boolean;
  createdById: number | null;
  createdByName?: string | null;
  createdAt: Date;
}

export const PROMO_PERCENT_MIN = 1;
export const PROMO_PERCENT_MAX = 100;

export interface PromoDiscountData {
  name: string;
  percent: number;
}

// "Promo verano · 30%"
export function promoDiscountLabel(discount: { name: string; percent: number }) {
  return `${discount.name} · ${discount.percent}%`;
}
