"use client";

import { CheckCircle2Icon, ClockIcon, LoaderCircleIcon, PrinterIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { printDocumentPdf } from "@/components/e-invoicing/print-pdf";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import {
  REVIEW_REASON_LABELS,
  SALE_DOCUMENT_TYPE_LABELS,
  type ReviewReason,
  type SaleDocumentStatus,
  type SaleDocumentType,
} from "@/domain/entities/sale-document";

interface DocumentState {
  id: number;
  docType: SaleDocumentType;
  status: SaleDocumentStatus;
  number: string | null;
  motorStatus: string | null;
  reviewReasons: ReviewReason[];
  lastError: string | null;
}

// How long the till waits for the motor before letting the cashier go on;
// the document keeps being issued in the background either way.
const POLL_MS = 1500;
const WAIT_MS = 15_000;

// Right after "Confirmar venta": waits for the sale's electronic document and
// prints it on the thermal printer as soon as the motor issued it. If it
// takes too long (offline, motor down) or needs review, the cashier moves on
// and reprints it later from "Comprobantes de hoy".
export function SaleDocumentDialog({
  saleUuid,
  docType,
  onClose,
}: {
  saleUuid: string | null;
  docType: SaleDocumentType;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<DocumentState | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printed = useRef(false);

  useEffect(() => {
    // The dialog is keyed by the sale: a new sale mounts it fresh.
    if (!saleUuid) return;
    let stopped = false;
    const started = Date.now();

    async function poll() {
      while (!stopped) {
        try {
          const response = await fetch(`/api/e-invoicing/sales/${saleUuid}`, { cache: "no-store" });
          if (response.ok) {
            const next = (await response.json()) as DocumentState;
            if (stopped) return;
            setDoc(next);
            if (next.status === "issued" || next.status === "review" || next.status === "voided") return;
          }
        } catch {
          // Offline: keep trying until the wait is over.
        }
        if (Date.now() - started > WAIT_MS) {
          setTimedOut(true);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    }
    void poll();
    return () => {
      stopped = true;
    };
  }, [saleUuid]);

  async function print(id: number) {
    setPrinting(true);
    try {
      await printDocumentPdf(id, "ticket");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo imprimir.");
    } finally {
      setPrinting(false);
    }
  }

  // Print once, automatically, when the document is issued.
  useEffect(() => {
    if (doc?.status === "issued" && !printed.current) {
      printed.current = true;
      void print(doc.id);
    }
  }, [doc]);

  const label = SALE_DOCUMENT_TYPE_LABELS[doc?.docType ?? docType];
  const waiting = !timedOut && (!doc || doc.status === "queued" || doc.status === "sending" || doc.status === "failed");

  return (
    <Dialog open={saleUuid !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>Comprobante electrónico</DialogTitle>
        <DialogDescription className="sr-only">Estado de la {label.toLowerCase()} de la venta.</DialogDescription>

        {doc?.status === "issued" ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <CheckCircle2Icon className="size-10 text-emerald-600" aria-hidden />
            <p className="text-lg font-semibold">
              {label} {doc.number}
            </p>
            <p className="text-sm text-muted-foreground">
              {doc.motorStatus === "ACEPTADO" || doc.motorStatus === "OBSERVADO"
                ? "Aceptada por SUNAT."
                : "Emitida. SUNAT la confirmará en unos minutos."}
            </p>
          </div>
        ) : doc?.status === "review" ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <TriangleAlertIcon className="size-10 text-amber-600" aria-hidden />
            <p className="font-semibold">La {label.toLowerCase()} queda en revisión</p>
            <p className="text-sm text-muted-foreground">
              {doc.reviewReasons.map((r) => REVIEW_REASON_LABELS[r]).join(" · ")}. El administrador la emitirá.
            </p>
          </div>
        ) : waiting ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <LoaderCircleIcon className="size-10 animate-spin text-muted-foreground" aria-hidden />
            <p className="font-semibold">Emitiendo {label.toLowerCase()}…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <ClockIcon className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-semibold">La {label.toLowerCase()} está en proceso</p>
            <p className="text-sm text-muted-foreground">
              Se emitirá sola cuando haya conexión con el sistema de facturación. Imprímela luego desde
              «Comprobantes de hoy».
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {doc?.status === "issued" && (
            <Button variant="outline" onClick={() => void print(doc.id)} disabled={printing}>
              {printing ? <LoaderCircleIcon className="animate-spin" /> : <PrinterIcon />}
              Reimprimir
            </Button>
          )}
          <Button autoFocus onClick={onClose}>
            Siguiente venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
