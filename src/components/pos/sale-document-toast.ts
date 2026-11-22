"use client";

import { toast } from "sonner";
import { printDocumentPdf } from "@/components/e-invoicing/print-pdf";
import { reviewText } from "@/components/e-invoicing/review-text";
import { FULL_TYPE_LABELS } from "@/components/e-invoicing/document-modal";
import type { ReviewReason, SaleDocumentStatus, SaleDocumentType } from "@/domain/entities/sale-document";
import { formatSoles } from "@/lib/money";

interface DocumentState {
  id: number;
  docType: SaleDocumentType;
  status: SaleDocumentStatus;
  number: string | null;
  motorStatus: string | null;
  reviewReasons: ReviewReason[];
}

const POLL_MS = 1500;
const WAIT_MS = 15_000;

async function print(id: number) {
  try {
    await printDocumentPdf(id, "ticket");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "No se pudo imprimir.");
  }
}

// After "Confirmar venta": one toast (top centre) follows the sale's
// electronic document while the cashier keeps selling. It turns into the
// boleta's number and total as soon as the motor issues it, and prints it on
// the thermal printer; if it takes too long it says so, and it can be
// reprinted later from "Comprobantes".
export function watchSaleDocument(sale: {
  uuid: string;
  docType: SaleDocumentType;
  total: number;
  extra?: string;
}) {
  const id = `sale-${sale.uuid}`;
  const label = sale.docType === "factura" ? "Factura" : "Boleta";
  const lines = (main: string) => [main, sale.extra].filter(Boolean).join(" · ");
  toast.loading(`Venta registrada · emitiendo ${label.toLowerCase()}…`, {
    id,
    description: lines(formatSoles(sale.total)),
  });

  const started = Date.now();
  async function poll() {
    for (;;) {
      try {
        const response = await fetch(`/api/e-invoicing/sales/${sale.uuid}`, { cache: "no-store" });
        if (response.ok) {
          const doc = (await response.json()) as DocumentState;
          if (doc.status === "issued") {
            const accepted = doc.motorStatus === "ACEPTADO" || doc.motorStatus === "OBSERVADO";
            toast.success(`${FULL_TYPE_LABELS[doc.docType]} » ${doc.number}`, {
              id,
              description: lines(`${formatSoles(sale.total)} · ${accepted ? "Aceptada por SUNAT" : "Emitida"}`),
              duration: 6000,
              action: { label: "Reimprimir", onClick: () => void print(doc.id) },
            });
            void print(doc.id);
            return;
          }
          if (doc.status === "review") {
            toast.warning(`${label} en revisión`, {
              id,
              description: lines(`${reviewText(doc.reviewReasons)}. El administrador la emitirá.`),
              duration: 8000,
            });
            return;
          }
        }
      } catch {
        // Offline: keep trying until the wait is over.
      }
      if (Date.now() - started > WAIT_MS) {
        toast.info(`${label} en proceso`, {
          id,
          description: lines("Se emitirá sola; imprímela luego desde Comprobantes."),
          duration: 6000,
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
  void poll();
}
