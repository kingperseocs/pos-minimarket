import { z } from "zod";

// The supplier's item code from its catalog (800436). Blank = not entered.
export const supplierCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim() || null : value === undefined ? null : value,
  z.string().max(30, "Código del proveedor muy largo").nullable(),
);
