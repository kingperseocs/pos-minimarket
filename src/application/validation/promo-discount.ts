import { z } from "zod";
import {
  PROMO_PERCENT_MAX,
  PROMO_PERCENT_MIN,
} from "@/domain/entities/promo-discount";
import { idSchema } from "./id";

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio")
  .max(40, "Máximo 40 caracteres");

export const promoDiscountSchema = z.object({
  name: nameSchema,
  percent: z.coerce
    .number("Ingresa el porcentaje")
    .int("El porcentaje debe ser un número entero")
    .min(PROMO_PERCENT_MIN, `Mínimo ${PROMO_PERCENT_MIN}%`)
    .max(PROMO_PERCENT_MAX, `Máximo ${PROMO_PERCENT_MAX}%`),
});

// The percent is not editable: only the name.
export const promoDiscountRenameSchema = z.object({
  id: idSchema,
  name: nameSchema,
});
