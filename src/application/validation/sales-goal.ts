import { z } from "zod";

export const SALES_GOAL_MIN = 100;
export const SALES_GOAL_MAX = 10_000_000;

export const salesGoalSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido"),
  amount: z.coerce
    .number("Ingresa el monto de la meta")
    .min(SALES_GOAL_MIN, `La meta mínima es S/ ${SALES_GOAL_MIN}`)
    .max(SALES_GOAL_MAX, "El monto es demasiado alto"),
});

export type SalesGoalInput = z.infer<typeof salesGoalSchema>;
