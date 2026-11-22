"use client";

import { DownloadIcon, FileTextIcon, LoaderCircleIcon, PrinterIcon, RefreshCwIcon, RotateCcwIcon, SendIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveDocument, refreshDocument, reissueDocument, retryDocumentNow } from "@/actions/e-invoicing";
import type { IssueOutcome } from "@/application/use-cases/e-invoicing/issue-sale-document";
import { openDocumentPdf, printDocumentPdf } from "@/components/e-invoicing/print-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentCustomer, SaleDocumentStatus, SaleDocumentType } from "@/domain/entities/sale-document";

const OUTCOME_MESSAGES: Record<IssueOutcome, string> = {
  issued: "Comprobante emitido.",
  retry: "El sistema de facturación no respondió: se reintentará solo.",
  rejected: "El sistema de facturación lo rechazó: revisa el motivo.",
  skipped: "Ya se está enviando o no le toca todavía.",
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export function DocumentActions({
  id,
  status,
  docType,
  hasMotorDocument,
  canApprove,
  canReissue,
  customer,
}: {
  id: number;
  status: SaleDocumentStatus;
  docType: SaleDocumentType;
  hasMotorDocument: boolean;
  canApprove: boolean;
  canReissue: boolean;
  customer: DocumentCustomer | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<DocumentCustomer>(
    customer ?? { docType: docType === "factura" ? "6" : "1", number: "", name: "", address: "" },
  );

  function run<T>(action: () => Promise<Result<T>>, message: (data: T) => string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(message(result.data));
      else toast.error(result.error);
    });
  }

  async function print(format: "ticket" | "a4" | "a5") {
    try {
      await printDocumentPdf(id, format);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo imprimir.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {hasMotorDocument && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void print("ticket")}>
            <PrinterIcon data-icon="inline-start" />
            Ticket 80 mm
          </Button>
          <Button variant="outline" onClick={() => openDocumentPdf(id, "a4")}>
            <FileTextIcon data-icon="inline-start" />
            PDF A4
          </Button>
          <Button variant="outline" onClick={() => openDocumentPdf(id, "a5")}>
            <FileTextIcon data-icon="inline-start" />
            PDF A5
          </Button>
          <Button variant="outline" nativeButton={false} render={<a href={`/api/e-invoicing/documents/${id}/xml`} />}>
            <DownloadIcon data-icon="inline-start" />
            XML
          </Button>
          <Button variant="outline" nativeButton={false} render={<a href={`/api/e-invoicing/documents/${id}/cdr`} />}>
            <DownloadIcon data-icon="inline-start" />
            CDR
          </Button>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => refreshDocument(id), (s) => `Estado en SUNAT: ${s ?? "sin respuesta"}`)}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Refrescar estado
          </Button>
        </div>
      )}

      {(status === "failed" || status === "queued") && (
        <Button
          className="self-start"
          disabled={isPending}
          onClick={() => run(() => retryDocumentNow(id), (o) => OUTCOME_MESSAGES[o])}
        >
          {isPending ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon data-icon="inline-start" />}
          Reintentar ahora
        </Button>
      )}

      {canReissue && (
        <Button
          className="self-start"
          disabled={isPending}
          onClick={() => run(() => reissueDocument(id), (o) => OUTCOME_MESSAGES[o])}
        >
          <RotateCcwIcon data-icon="inline-start" />
          Emitir de nuevo (SUNAT lo rechazó)
        </Button>
      )}

      {canApprove && (
        <form
          className="flex max-w-md flex-col gap-2 rounded-md border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const hasCustomer = form.number.trim() !== "" || form.name.trim() !== "";
            run(() => approveDocument(id, hasCustomer ? form : null), (o) => OUTCOME_MESSAGES[o]);
          }}
        >
          <p className="text-sm font-medium">Corregir el cliente y emitir</p>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fix-number">{form.docType === "6" ? "RUC" : "DNI"}</Label>
            <Input
              id="fix-number"
              inputMode="numeric"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fix-name">{form.docType === "6" ? "Razón social" : "Nombre"}</Label>
            <Input id="fix-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          {form.docType === "6" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="fix-address">Dirección</Label>
              <Input
                id="fix-address"
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          )}
          <Button type="submit" className="self-start" disabled={isPending}>
            {isPending ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon data-icon="inline-start" />}
            Emitir
          </Button>
        </form>
      )}
    </div>
  );
}
