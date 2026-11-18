import { z } from "zod";
import { CAPTURE_SOURCES } from "@/domain/value-objects/capture-source";
import { idSchema } from "./id";

export const saleItemSchema = z.object({
  productId: idSchema,
  productName: z.string().min(1),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
  // Per-line worker discount / gift. Defaulted so sales queued by older
  // versions of the POS keep syncing: those carry `discountPercent` (ignored)
  // and `isCourtesy`, an admin-approved free line.
  discountUnitAmount: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  isGift: z.boolean().optional(),
  isCourtesy: z.boolean().optional(),
  // Reader or by hand; absent on sales queued before the reader.
  captureSource: z.enum(CAPTURE_SOURCES).nullable().default(null),
});

export const saleCreateSchema = z.object({
  // Client-generated idempotency key (see SaleInput).
  uuid: z.uuid(),
  // Optional only for sales queued in IndexedDB before cashierId was
  // captured at checkout; those fall back to the syncing user.
  cashierId: idSchema.optional(),
  paymentType: z.enum(["cash", "yape_plin", "card"]),
  items: z.array(saleItemSchema).min(1),
  total: z.number().nonnegative(),
  clientCreatedAt: z.iso.datetime(),
  // Airport-worker discount. All optional/defaulted so sales queued before
  // this feature existed keep syncing.
  workerId: idSchema.optional(),
  workerVerification: z
    .enum(["none", "dni_manual", "pin_online", "pin_offline"])
    .default("none"),
  discountTotal: z.number().nonnegative().default(0),
  // Sent by POS versions that round discounted totals to whole soles. The
  // server recomputes the amount; absent (older queued sales, charged
  // without rounding) means the sale is not rounded.
  roundingAmount: z.number().optional(),
  policyId: idSchema.optional(),
  // Percentage discount the cashier applied (only its id: the percent is
  // taken from the server). Exclusive with the worker discount.
  promoDiscountId: idSchema.optional(),
  // Worker points spent as whole soles off the sale. The soles are worked
  // out on the server from the policy's rate, never taken from the client.
  pointsRedeemed: z.number().int().nonnegative().default(0),
  // The till shift it was charged in. Optional: sales queued before shifts
  // existed keep syncing.
  shiftUuid: z.uuid().optional(),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
