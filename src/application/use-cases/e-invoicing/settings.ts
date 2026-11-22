import { z } from "zod";
import type { EInvoicingSettingsRepository } from "@/domain/repositories/e-invoicing-settings-repository";

// A SUNAT series: 4 characters, starting with B (boleta and its notes) or F
// (factura and its notes). They must also exist in the billing engine.
const series = (letter: "B" | "F", what: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^${letter}[A-Z0-9]{3}$`), `${what}: 4 caracteres que empiezan con ${letter} (por ejemplo ${letter}001).`);

export const settingsSchema = z.object({
  boletaSeries: series("B", "Serie de boletas"),
  facturaSeries: series("F", "Serie de facturas"),
  creditNoteBoletaSeries: series("B", "Nota de crédito de boletas"),
  creditNoteFacturaSeries: series("F", "Nota de crédito de facturas"),
  debitNoteBoletaSeries: series("B", "Nota de débito de boletas"),
  debitNoteFacturaSeries: series("F", "Nota de débito de facturas"),
  // null: each product's own affectation; otherwise forced for every line.
  globalIgvOverride: z.enum(["10", "20", "30"]).nullable(),
  autoEmitEnabled: z.boolean(),
});

export function getSettingsUseCase(repo: EInvoicingSettingsRepository) {
  return repo.get();
}

// New documents use the new series; already issued ones keep theirs.
export async function updateSettingsUseCase(repo: EInvoicingSettingsRepository, input: unknown) {
  const settings = settingsSchema.parse(input);
  await repo.update(settings);
  return settings;
}
