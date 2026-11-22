"use client";

import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, LoaderCircleIcon, SendIcon, UserRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/e-invoicing/document-status-badge";
import { LiveRefresh } from "@/components/e-invoicing/live-refresh";
import { Button } from "@/components/ui/button";
import type { ReviewReason, SaleDocumentStatus, SaleDocumentType } from "@/domain/entities/sale-document";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { DocumentModal, FULL_TYPE_LABELS, reviewText } from "./document-modal";

export interface DocumentCardRow {
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
  cashierName: string | null;
  // Annulled, or cancelled by a credit note: it no longer counts for SUNAT.
  cancelled: boolean;
}

const PAGE_SIZE = 10;

const dayMonth = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", timeZone: STORE_TIME_ZONE });
const clock = new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: STORE_TIME_ZONE });

// "22º NOVIEMBRE, 3:50 P. M."
function when(iso: string) {
  const date = new Date(iso);
  const [day, , month] = dayMonth.format(date).split(" ");
  return `${day}º ${month.toUpperCase()}, ${clock.format(date).toUpperCase()}`;
}

// S/ 350.⁰⁰ — the cents raised, as on KeyFacil.
function Amount({ value, cancelled }: { value: number; cancelled: boolean }) {
  const [soles, cents] = value.toFixed(2).split(".");
  return (
    <span
      className={`whitespace-nowrap font-bold ${cancelled ? "text-amber-800/80" : "text-emerald-600 dark:text-emerald-400"}`}
    >
      <span className="text-sm">S/ </span>
      <span className="text-2xl tabular-nums">{Number(soles).toLocaleString("es-PE")}</span>
      <sup className="text-xs">.{cents}</sup>
    </span>
  );
}

// Documents of a day as KeyFacil-like cards, 10 per page; a click opens the
// document's actions. Annulled or cancelled ones show in pastel red. Live:
// refreshes itself while visible.
export function DocumentCardList({
  documents,
  live,
  showCashier = false,
}: {
  documents: DocumentCardRow[];
  live: boolean;
  showCashier?: boolean;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [openId, setOpenId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const pending = documents.filter((d) => d.status === "queued" || d.status === "failed").length;
  const pages = Math.max(1, Math.ceil(documents.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = documents.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

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
    <div className="flex flex-col gap-4">
      {live && <LiveRefresh />}
      {pending > 0 && (
        <Button variant="outline" className="self-start" onClick={() => void retry()} disabled={retrying}>
          {retrying ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon data-icon="inline-start" />}
          Reintentar pendientes ({pending})
        </Button>
      )}

      {documents.length === 0 ? (
        <p className="rounded-lg bg-card p-8 text-center text-sm text-muted-foreground shadow-md">
          No hay comprobantes este día. Las ventas sin conexión aparecen cuando se sincronizan.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className={`flex w-full cursor-pointer items-center gap-4 rounded-lg px-6 py-4 text-left shadow-md transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:translate-y-0 ${
                  d.cancelled ? "bg-red-200/70 text-red-950 dark:bg-red-900/40 dark:text-red-100" : "bg-card"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {FULL_TYPE_LABELS[d.docType]} » {d.number ?? "por emitir"}
                    {d.cancelled && <span className="ml-2 text-xs font-medium uppercase">· Anulado</span>}
                  </p>
                  <p
                    className={`mt-1 flex items-center gap-1.5 truncate text-sm uppercase ${d.cancelled ? "opacity-80" : "text-muted-foreground"}`}
                  >
                    <UserRoundIcon className="size-3.5 shrink-0" aria-hidden />
                    {d.customerName ? `${d.customerName} (${d.customerDocNumber})` : "Clientes varios"}
                  </p>
                  <p className={`mt-0.5 flex items-center gap-1.5 text-sm ${d.cancelled ? "opacity-80" : "text-muted-foreground"}`}>
                    <ClockIcon className="size-3.5 shrink-0" aria-hidden />
                    {when(d.soldAt)}
                    {showCashier && d.cashierName && <span className="uppercase">· {d.cashierName}</span>}
                  </p>
                  {d.status === "review" && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{reviewText(d.reviewReasons)}</p>
                  )}
                  {d.status === "failed" && d.lastError && (
                    <p className="mt-1 truncate text-xs text-red-700 dark:text-red-400">{d.lastError}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Amount value={d.total} cancelled={d.cancelled} />
                  {!d.cancelled && !(d.status === "issued" && d.motorStatus === "ACEPTADO") && (
                    <DocumentStatusBadge status={d.status} motorStatus={d.motorStatus} />
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Página anterior" disabled={current === 1} onClick={() => setPage(current - 1)}>
            <ChevronLeftIcon />
          </Button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              size="icon"
              variant={n === current ? "default" : "ghost"}
              aria-current={n === current ? "page" : undefined}
              onClick={() => setPage(n)}
            >
              {n}
            </Button>
          ))}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Página siguiente"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRightIcon />
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">
            {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, documents.length)} de {documents.length}
          </span>
        </nav>
      )}

      <DocumentModal key={openId ?? "none"} documentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

// Server rows → card rows (the same for the till and the admin).
export function toCardRow(d: {
  id: number;
  docType: SaleDocumentType;
  number: string | null;
  status: SaleDocumentStatus;
  motorStatus: string | null;
  customerName: string | null;
  customerDocNumber: string | null;
  saleTotal: number;
  soldAt: Date;
  lastError: string | null;
  reviewReasons: ReviewReason[];
  cashierName: string | null;
  cancelledByNote: boolean;
}): DocumentCardRow {
  return {
    id: d.id,
    docType: d.docType,
    number: d.number,
    status: d.status,
    motorStatus: d.motorStatus,
    customerName: d.customerName,
    customerDocNumber: d.customerDocNumber,
    total: d.saleTotal,
    soldAt: d.soldAt.toISOString(),
    lastError: d.lastError,
    reviewReasons: d.reviewReasons,
    cashierName: d.cashierName,
    cancelled: d.status === "voided" || d.motorStatus === "ANULADO" || d.cancelledByNote,
  };
}
