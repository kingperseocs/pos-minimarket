"use client";

import { LoaderCircleIcon, PrinterIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/e-invoicing/document-status-badge";
import { printDocumentPdf } from "@/components/e-invoicing/print-pdf";
import { Button } from "@/components/ui/button";
import {
  REVIEW_REASON_LABELS,
  SALE_DOCUMENT_TYPE_LABELS,
  type ReviewReason,
  type SaleDocumentStatus,
  type SaleDocumentType,
} from "@/domain/entities/sale-document";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { formatSoles } from "@/lib/money";

export interface TodayDocumentRow {
  id: number;
  docType: SaleDocumentType;
  number: string | null;
  status: SaleDocumentStatus;
  motorStatus: string | null;
  customerName: string | null;
  customerDocNumber: string | null;
  total: number;
  soldAt: string;
  lastError: string | null;
  reviewReasons: ReviewReason[];
}

const time = new Intl.DateTimeFormat("es-PE", { timeStyle: "short", timeZone: STORE_TIME_ZONE });

export function TodayDocuments({ documents }: { documents: TodayDocumentRow[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [printing, setPrinting] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pending = documents.filter((d) => d.status === "queued" || d.status === "failed").length;

  async function print(id: number) {
    setPrinting(id);
    try {
      await printDocumentPdf(id, "ticket");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo imprimir.");
    } finally {
      setPrinting(null);
    }
  }

  async function retry() {
    setRetrying(true);
    try {
      const response = await fetch("/api/e-invoicing/drain", { method: "POST" });
      if (!response.ok) throw new Error();
      const counts = (await response.json()) as { issued: number; retry: number; rejected: number };
      toast.success(
        counts.issued > 0
          ? `${counts.issued} comprobante(s) emitido(s).`
          : "Nada nuevo por emitir ahora. Se reintenta solo cada pocos minutos.",
      );
    } catch {
      toast.error("No se pudo conectar. Se reintentará solo.");
    } finally {
      setRetrying(false);
      startRefresh(() => router.refresh());
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
          <RefreshCwIcon data-icon="inline-start" className={refreshing ? "animate-spin" : undefined} />
          Actualizar
        </Button>
        {pending > 0 && (
          <Button variant="outline" onClick={() => void retry()} disabled={retrying}>
            {retrying ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon data-icon="inline-start" />}
            Reintentar pendientes ({pending})
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Todavía no hay comprobantes hoy. Las ventas sin conexión aparecen cuando se sincronizan.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="w-14 text-sm tabular-nums text-muted-foreground">{time.format(new Date(d.soldAt))}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {SALE_DOCUMENT_TYPE_LABELS[d.docType]} {d.number ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.customerName ? `${d.customerName} · ${d.customerDocNumber}` : "Clientes varios"}
                  {d.status === "review" && ` · ${d.reviewReasons.map((r) => REVIEW_REASON_LABELS[r]).join(", ")}`}
                  {d.status === "failed" && d.lastError && ` · ${d.lastError}`}
                </p>
              </div>
              <span className="tabular-nums font-medium">{formatSoles(d.total)}</span>
              <DocumentStatusBadge status={d.status} motorStatus={d.motorStatus} />
              <Button
                size="sm"
                variant="outline"
                disabled={d.status !== "issued" || printing === d.id}
                onClick={() => void print(d.id)}
              >
                {printing === d.id ? <LoaderCircleIcon className="animate-spin" /> : <PrinterIcon data-icon="inline-start" />}
                Imprimir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
