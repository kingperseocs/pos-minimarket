import { round2 } from "../value-objects/money";

export interface ProductMargin {
  // Ganancia por unidad: precio de venta − precio de compra.
  profit: number;
  // Ganancia como % del precio de compra ("le gano el 50%").
  markupPercent: number;
  // Ganancia como % del precio de venta (margen bruto).
  marginPercent: number;
}

// Profit per unit. Huánuco is IGV-exempt, so both prices are used as is.
// null when the purchase price is unknown.
export function productMargin(
  priceSale: number,
  priceCost: number | null,
): ProductMargin | null {
  if (priceCost === null || priceCost <= 0 || priceSale <= 0) return null;
  const profit = round2(priceSale - priceCost);
  return {
    profit,
    markupPercent: Math.round((profit / priceCost) * 100),
    marginPercent: Math.round((profit / priceSale) * 100),
  };
}
