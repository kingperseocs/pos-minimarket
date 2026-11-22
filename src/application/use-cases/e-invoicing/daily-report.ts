import { z } from "zod";
import type { SaleDocumentListItem } from "@/domain/entities/sale-document";
import { MotorRejectedError, MotorUnavailableError } from "@/domain/errors";
import type { EInvoicingGateway } from "@/domain/repositories/e-invoicing-gateway";
import type { SaleDocumentRepository } from "@/domain/repositories/sale-document-repository";
import { round2 } from "@/domain/value-objects/money";
import { storeDayRange } from "@/domain/value-objects/store-time";

// GET /reportes/diario of the motor (amounts as strings with 2 decimals).
const motorReportSchema = z.object({
  total_comprobantes: z.number(),
  por_enviar: z.number(),
  por_estado: z.array(z.object({ estado: z.string(), cantidad: z.number() })),
  monedas: z.array(
    z.object({
      moneda: z.string(),
      resumen: z.object({
        ventas: z.string(),
        notas_credito: z.string(),
        notas_debito: z.string(),
        neto: z.string(),
        op_gravadas: z.string(),
        op_exoneradas: z.string(),
        op_inafectas: z.string(),
        igv: z.string(),
      }),
      por_tipo: z.array(
        z.object({ tipo_comprobante: z.string(), tipo_descripcion: z.string(), cantidad: z.number(), importe: z.string() }),
      ),
      por_cajero: z.array(z.object({ cajero: z.string(), cantidad: z.number(), neto: z.string() })),
    }),
  ),
});

export type MotorDailyReport = z.infer<typeof motorReportSchema>;

export interface PosDaySummary {
  sales: number;
  salesTotal: number;
  issued: number;
  issuedTotal: number;
  review: number;
  reviewTotal: number;
  pending: number;
  pendingTotal: number;
}

export function summarizePosDay(documents: SaleDocumentListItem[]): PosDaySummary {
  const sum = (docs: SaleDocumentListItem[]) => round2(docs.reduce((s, d) => s + d.saleTotal, 0));
  const issued = documents.filter((d) => d.status === "issued");
  const review = documents.filter((d) => d.status === "review");
  const pending = documents.filter((d) => d.status === "queued" || d.status === "sending" || d.status === "failed");
  return {
    sales: documents.length,
    salesTotal: sum(documents),
    issued: issued.length,
    issuedTotal: sum(issued),
    review: review.length,
    reviewTotal: sum(review),
    pending: pending.length,
    pendingTotal: sum(pending),
  };
}

// The day as the POS charged it next to what the motor declared to SUNAT.
// The motor part is optional: if it is unreachable, the POS part still shows.
export async function dailyReportUseCase(
  deps: { documents: Pick<SaleDocumentRepository, "list">; gateway: Pick<EInvoicingGateway, "dailyReport"> },
  date: string,
): Promise<{ pos: PosDaySummary; motor: MotorDailyReport | null; motorError: string | null }> {
  const { from, to } = storeDayRange(date);
  const pos = summarizePosDay(await deps.documents.list({ from, to }));
  try {
    const motor = motorReportSchema.parse(await deps.gateway.dailyReport(date));
    return { pos, motor, motorError: null };
  } catch (error) {
    if (error instanceof MotorUnavailableError || error instanceof MotorRejectedError) {
      return { pos, motor: null, motorError: error.message };
    }
    throw error;
  }
}
