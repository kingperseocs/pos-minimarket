"use client";

import { ClockIcon, LoaderCircleIcon, SendIcon, UserRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/e-invoicing/document-status-badge";
import { LiveRefresh } from "@/components/e-invoicing/live-refresh";
import { Button } from "@/components/ui/button";
import type { ReviewReason, SaleDocumentStatus, SaleDocumentType } from "@/domain/entities/sale-document";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { DocumentModal, FULL_TYPE_LABELS, reviewText } from "./document-modal";

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

const dayMonth = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", timeZone: STORE_TIME_ZONE });
const clock = new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: STORE_TIME_ZONE });

// "22º NOVIEMBRE, 3:50 P. M."
function when(iso: string) {
  const date = new Date(iso);
  const [day, , month] = dayMonth.format(date).split(" ");
  return `${day}º ${month.toUpperCase()}, ${clock.format(date).toUpperCase()}`;
}

// S/ 350.⁰⁰ — the cents raised, as on KeyFacil.
function Amount({ value }: { value: number }) {
  const [soles, cents] = value.toFixed(2).split(".");
  return (
    <span className="whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
      <span className="text-sm">S/ </span>
      <span className="text-2xl tabular-nums">{Number(soles).toLocaleString("es-PE")}</span>
      <sup className="text-xs">.{cents}</sup>
    </span>
  );
}

// The cashier's documents of a day as KeyFacil-like cards; a click opens
// the document's actions. Live: refreshes itself while visible.
export function TodayDocuments({ documents, live }: { documents: TodayDocumentRow[]; live: boolean }) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [openId, setOpenId] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pending = documents.filter((d) => d.status === "queued" || d.status === "failed").length;

  async function retry() {
    setRetrying(true);
    try {
      const response = await fetch("/api/e-invoicing/drain", { method: "POST" });
      if (!response.ok) throw new Error();
      const counts = (await response.json()) as { issued: number };
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
      {live && <LiveRefresh />}
      {pending > 0 && (
        <Button variant="outline" className="self-start" onClick={() => void retry()} disabled={retrying}>
          {retrying ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon data-icon="inline-start" />}
          Reintentar pendientes ({pending})
        </Button>
      )}

      {documents.length === 0 ? (
        <p className="rounded-lg bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No hay comprobantes este día. Las ventas sin conexión aparecen cuando se sincronizan.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className="flex w-full items-center gap-4 rounded-lg bg-card px-5 py-4 text-left shadow-sm ring-1 ring-foreground/5 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {FULL_TYPE_LABELS[d.docType]} » {d.number ?? "por emitir"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground uppercase">
                    <UserRoundIcon className="size-3.5 shrink-0" aria-hidden />
                    {d.customerName ? `${d.customerName} (${d.customerDocNumber})` : "Clientes varios"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <ClockIcon className="size-3.5 shrink-0" aria-hidden />
                    {when(d.soldAt)}
                  </p>
                  {d.status === "review" && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{reviewText(d.reviewReasons)}</p>
                  )}
                  {d.status === "failed" && d.lastError && (
                    <p className="mt-1 truncate text-xs text-red-700 dark:text-red-400">{d.lastError}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Amount value={d.total} />
                  {!(d.status === "issued" && d.motorStatus === "ACEPTADO") && (
                    <DocumentStatusBadge status={d.status} motorStatus={d.motorStatus} />
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentModal key={openId ?? "none"} documentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
