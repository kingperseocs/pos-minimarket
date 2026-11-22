"use client";

import { ChevronDownIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveDocument,
  creditNoteFor,
  debitNoteFor,
  type DocumentDetail,
  getDocumentDetail,
  refreshDocument,
  reissueDocument,
  retryDocumentNow,
  voidDocumentNow,
} from "@/actions/e-invoicing";
import { openDocumentPdf, printDocumentPdf } from "@/components/e-invoicing/print-pdf";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  CREDIT_NOTE_REASONS,
  DEBIT_NOTE_REASONS,
  REVIEW_REASON_LABELS,
  SALE_DOCUMENT_NOTE_KIND_LABELS,
  SALE_DOCUMENT_STATUS_LABELS,
  VOID_MAX_DAYS,
  type ReviewReason,
  type SaleDocumentNoteKind,
  type SaleDocumentStatus,
} from "@/domain/entities/sale-document";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { formatSoles } from "@/lib/money";

const OUTCOMES = {
  issued: "Comprobante emitido.",
  retry: "El sistema de facturación no respondió: se reintentará solo.",
  rejected: "El sistema de facturación lo rechazó: revisa el motivo.",
  skipped: "Ya se está enviando o no le toca todavía.",
} as const;

export const FULL_TYPE_LABELS = { boleta: "Boleta de Venta Electrónica", factura: "Factura Electrónica" } as const;

const FORMATS = [
  { value: "ticket", label: "Ticket 80 mm" },
  { value: "a4", label: "A4" },
  { value: "a5", label: "A5 (media hoja)" },
] as const;
type Format = (typeof FORMATS)[number]["value"];

const dateTime = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: STORE_TIME_ZONE });

// KeyFacil-style solid button for the modal grid; greyed out when it does
// not apply (an annulled document keeps only view, download and print).
function ActionButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={`h-10 font-semibold uppercase tracking-wide disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 ${className ?? ""}`}
    />
  );
}

// A field with its label on the border (outlined), as on KeyFacil.
function OutlinedField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="absolute -top-2 left-3 bg-background px-1 text-xs text-muted-foreground peer-focus:text-primary"
      >
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="peer h-12 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none read-only:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

type Form =
  | { kind: "approve" }
  | { kind: "void" }
  | { kind: "credit"; code: string }
  | { kind: "debit"; code: string }
  | null;

// The document's actions, opened from its card: view / download / print the
// PDF, credit and debit notes, XML and CDR, and annul (within 7 days). A
// cashier only gets here for the sales they charged.
export function DocumentModal({ documentId, onClose }: { documentId: number | null; onClose: () => void }) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [form, setForm] = useState<Form>(null);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [customer, setCustomer] = useState({ number: "", name: "", address: "" });
  const [isPending, startTransition] = useTransition();

  async function load(id: number) {
    const result = await getDocumentDetail(id);
    if (result.ok) setDetail(result.data);
    else toast.error(result.error);
  }

  useEffect(() => {
    // The modal is keyed by the document: each opening mounts it fresh.
    if (documentId === null) return;
    let alive = true;
    getDocumentDetail(documentId).then((result) => {
      if (!alive) return;
      if (result.ok) setDetail(result.data);
      else toast.error(result.error);
    });
    return () => {
      alive = false;
    };
  }, [documentId]);

  async function print(format: Format) {
    if (!detail) return;
    try {
      await printDocumentPdf(detail.id, format);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo imprimir.");
    }
  }

  function download(kind: "pdf" | "xml" | "cdr", format: Format = "a4") {
    if (!detail) return;
    const query = kind === "pdf" ? `?formato=${format}&descarga=1` : "?descarga=1";
    // A file download, not a page: a plain link click keeps the modal open.
    const link = document.createElement("a");
    link.href = `/api/e-invoicing/documents/${detail.id}/${kind}${query}`;
    link.download = "";
    link.click();
  }

  function openForm(next: Form) {
    setForm(next);
    setText("");
    setAmount("");
    if (next?.kind === "approve" && detail) {
      setCustomer({
        number: detail.customerDocNumber ?? "",
        name: detail.customerName ?? "",
        address: detail.admin?.customerAddress ?? "",
      });
    }
  }

  // Admin: retry, or reissue a rejected one.
  function adminAction(action: "retry" | "reissue") {
    if (!detail) return;
    startTransition(async () => {
      const result = action === "retry" ? await retryDocumentNow(detail.id) : await reissueDocument(detail.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(OUTCOMES[result.data]);
      await load(detail.id);
    });
  }

  function submit() {
    if (!detail || !form) return;
    startTransition(async () => {
      let message: string;
      if (form.kind === "approve") {
        const docType = detail.docType === "factura" ? "6" : "1";
        const filled = customer.number.trim() !== "" || customer.name.trim() !== "";
        const result = await approveDocument(
          detail.id,
          filled ? { docType, number: customer.number, name: customer.name, address: customer.address || null } : null,
        );
        if (!result.ok) return void toast.error(result.error);
        message = OUTCOMES[result.data];
      } else if (form.kind === "void") {
        const result = await voidDocumentNow(detail.id, text);
        if (!result.ok) return void toast.error(result.error);
        message = "Anulación enviada a SUNAT. Se confirmará en unos minutos.";
      } else {
        const result =
          form.kind === "credit"
            ? await creditNoteFor(detail.id, { reasonCode: form.code, detail: text })
            : await debitNoteFor(detail.id, { reasonCode: form.code, detail: text, amount });
        if (!result.ok) return void toast.error(result.error);
        message = `Nota emitida: ${result.data}`;
      }
      toast.success(message);
      setForm(null);
      await load(detail.id);
    });
  }

  function refresh() {
    if (!detail) return;
    startTransition(async () => {
      const result = await refreshDocument(detail.id);
      if (result.ok) await load(detail.id);
      else toast.error(result.error);
    });
  }

  const status = detail?.status as SaleDocumentStatus | undefined;
  const reference = detail ? `${FULL_TYPE_LABELS[detail.docType]} » ${detail.number ?? ""}` : "";
  const formTitle =
    form?.kind === "approve"
      ? "Corregir el cliente"
      : form?.kind === "void"
        ? "Dar de baja (Anular)"
        : form?.kind === "credit"
          ? `Nota de crédito · ${CREDIT_NOTE_REASONS[form.code]}`
          : form?.kind === "debit"
            ? `Nota de débito · ${DEBIT_NOTE_REASONS[form.code]}`
            : "";

  return (
    <>
      <Dialog open={documentId !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          // Slides up into place when it opens, as on KeyFacil.
          className="gap-0 overflow-hidden p-0 duration-300 ease-out sm:max-w-md data-open:zoom-in-100 data-open:slide-in-from-bottom-16 data-closed:zoom-out-100 data-closed:slide-out-to-bottom-8 data-closed:duration-200"
          // A plain dark veil, no blur, as on KeyFacil.
          overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-none"
          showCloseButton={false}
        >
          <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
            <DialogTitle className="text-lg font-semibold">Comprobante electrónico</DialogTitle>
            <DialogClose
              aria-label="Cerrar"
              className="rounded-full p-1 text-primary-foreground transition hover:bg-primary-foreground/15"
            >
              <XIcon className="size-6" strokeWidth={2.75} />
            </DialogClose>
            <DialogDescription className="sr-only">Acciones del comprobante.</DialogDescription>
          </div>

          {!detail ? (
            <div className="flex justify-center p-10">
              <LoaderCircleIcon className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto bg-muted/50 p-3">
              <div className="rounded-lg bg-card p-4 text-center shadow-sm">
                <p className="font-semibold">{FULL_TYPE_LABELS[detail.docType]}</p>
                <p className="text-muted-foreground">{detail.number ?? "(sin número todavía)"}</p>
                <p className="text-lg font-bold">{formatSoles(detail.saleTotal)}</p>
              </div>

              <div className="relative">
                <dl className="divide-y rounded-lg bg-card text-sm shadow-sm">
                  <div className="px-4 py-3">
                    <dt className="font-medium uppercase">Cliente</dt>
                    <dd className="text-muted-foreground uppercase">
                      {detail.customerName ?? "Clientes varios"}
                      {detail.customerDocNumber && (
                        <>
                          <br />
                          {detail.customerDocType === "6" ? "RUC" : "DNI"} {detail.customerDocNumber}
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="px-4 py-3">
                    <dt className="font-medium uppercase">Usuario</dt>
                    <dd className="text-muted-foreground uppercase">
                      {detail.cashierName ?? "—"}
                      <br />
                      {dateTime.format(new Date(detail.soldAt))}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-2 px-4 py-3">
                    <div>
                      <dt className="font-medium uppercase">Estado SUNAT</dt>
                      <dd className="text-muted-foreground uppercase">
                        {status === "issued"
                          ? (detail.motorStatus ?? "Enviado")
                          : status
                            ? SALE_DOCUMENT_STATUS_LABELS[status]
                            : "—"}
                      </dd>
                    </div>
                    {detail.hasMotorDocument && (
                      <Button size="sm" variant="ghost" onClick={refresh} disabled={isPending}>
                        Actualizar estado
                      </Button>
                    )}
                  </div>
                </dl>
                {/* The stamp across the data, as on KeyFacil. */}
                {(detail.cancelled || detail.voidPending) && (
                  <span
                    aria-label={detail.cancelled ? "Anulado" : "Baja en proceso"}
                    className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] rounded-md px-5 py-2 text-3xl font-black tracking-wider whitespace-nowrap text-white uppercase shadow-lg ${
                      detail.cancelled ? "bg-red-600/90" : "bg-amber-500/90 text-xl"
                    }`}
                  >
                    {detail.cancelled ? "Anulado" : "Baja en proceso"}
                  </span>
                )}
              </div>

              {status === "review" && !detail.admin && (
                <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                  En revisión. El administrador lo emitirá.
                </p>
              )}

              {detail.admin &&
                (status === "review" || status === "failed" || status === "queued" || detail.admin.canReissue) && (
                  <div className="flex flex-col gap-2 rounded-lg bg-card p-4 text-sm shadow-sm">
                    <p className="font-medium uppercase">Administrador</p>
                    {status === "review" && (
                      <p className="text-amber-800 dark:text-amber-300">
                        En revisión:{" "}
                        {detail.admin.reviewReasons.map((r) => REVIEW_REASON_LABELS[r as ReviewReason]).join(", ")}.
                        {!detail.admin.canApprove &&
                          " Se emitirá cuando el contador defina cómo declarar descuentos, regalos, puntos y redondeo."}
                      </p>
                    )}
                    {detail.admin.lastError && <p className="text-red-700 dark:text-red-400">{detail.admin.lastError}</p>}
                    <div className="flex flex-wrap gap-2">
                      {detail.admin.canRetry && (
                        <Button size="sm" onClick={() => adminAction("retry")} disabled={isPending}>
                          Reintentar ahora
                        </Button>
                      )}
                      {detail.admin.canReissue && (
                        <Button size="sm" onClick={() => adminAction("reissue")} disabled={isPending}>
                          Emitir de nuevo (SUNAT lo rechazó)
                        </Button>
                      )}
                      {detail.admin.canApprove && (
                        <Button size="sm" onClick={() => openForm({ kind: "approve" })} disabled={isPending}>
                          Corregir cliente y emitir
                        </Button>
                      )}
                    </div>
                  </div>
                )}

              {detail.hasMotorDocument && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex">
                    <ActionButton className="flex-1 rounded-r-none" onClick={() => openDocumentPdf(detail.id, "a4")}>
                      Visualizar PDF
                    </ActionButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button className="h-10 rounded-l-none border-l border-primary-foreground/20 px-2" aria-label="Formato" />
                        }
                      >
                        <ChevronDownIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {FORMATS.map((f) => (
                          <DropdownMenuItem key={f.value} onClick={() => openDocumentPdf(detail.id, f.value)}>
                            {f.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex">
                    <ActionButton className="flex-1 rounded-r-none" onClick={() => download("pdf", "a4")}>
                      Descargar PDF
                    </ActionButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button className="h-10 rounded-l-none border-l border-primary-foreground/20 px-2" aria-label="Formato" />
                        }
                      >
                        <ChevronDownIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {FORMATS.map((f) => (
                          <DropdownMenuItem key={f.value} onClick={() => download("pdf", f.value)}>
                            {f.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <ActionButton className="col-span-2" onClick={() => void print("ticket")}>
                    Imprimir
                  </ActionButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<ActionButton disabled={!detail.valid} />}>
                      Nota de crédito <ChevronDownIcon data-icon="inline-end" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {Object.entries(CREDIT_NOTE_REASONS)
                        .filter(([code]) => code !== "02" || detail.docType === "factura")
                        .map(([code, label]) => (
                          <DropdownMenuItem key={code} onClick={() => openForm({ kind: "credit", code })}>
                            {code} · {label}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<ActionButton disabled={!detail.valid} />}>
                      Nota de débito <ChevronDownIcon data-icon="inline-end" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {Object.entries(DEBIT_NOTE_REASONS).map(([code, label]) => (
                        <DropdownMenuItem key={code} onClick={() => openForm({ kind: "debit", code })}>
                          {code} · {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ActionButton onClick={() => download("xml")} disabled={detail.cancelled}>
                    Descargar XML
                  </ActionButton>
                  <ActionButton
                    onClick={() => download("cdr")}
                    disabled={detail.cancelled || detail.motorStatus === "PENDIENTE"}
                  >
                    Descargar CDR
                  </ActionButton>
                  <ActionButton
                    className="col-span-2 bg-red-600 text-white hover:bg-red-700"
                    disabled={!detail.canVoid}
                    onClick={() => openForm({ kind: "void" })}
                  >
                    Dar de baja (anular)
                  </ActionButton>
                </div>
              )}
              {detail.valid && !detail.voidPending && !detail.canVoid && (
                <p className="text-center text-xs text-muted-foreground">
                  Ya pasaron {VOID_MAX_DAYS} días: para anularlo emite una nota de crédito.
                </p>
              )}

              {detail.notes.length > 0 && (
                <ul className="divide-y rounded-lg bg-card text-sm shadow-sm">
                  {detail.notes.map((note) => (
                    <li key={note.id} className="px-4 py-2">
                      <p className="font-medium">
                        {SALE_DOCUMENT_NOTE_KIND_LABELS[note.kind as SaleDocumentNoteKind]} {note.number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {note.reasonText} · {note.motorStatus}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Annul, notes and customer fix: a dialog of their own on top. */}
      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent
          className="duration-200 sm:max-w-sm data-open:slide-in-from-bottom-8"
          overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-none"
          showCloseButton={false}
        >
          <DialogTitle>{formTitle}</DialogTitle>
          <DialogDescription className="sr-only">Completa los datos y confirma.</DialogDescription>
          <form
            id="document-action-form"
            className="flex flex-col gap-5 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <OutlinedField id="action-reference" label="Referencia" value={reference} readOnly tabIndex={-1} />
            {form?.kind === "approve" ? (
              <>
                <OutlinedField
                  id="fix-number"
                  label={detail?.docType === "factura" ? "RUC" : "DNI"}
                  inputMode="numeric"
                  autoFocus
                  value={customer.number}
                  onChange={(e) => setCustomer({ ...customer, number: e.target.value.replace(/\D/g, "") })}
                />
                <OutlinedField
                  id="fix-name"
                  label={detail?.docType === "factura" ? "Razón social" : "Nombre"}
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                />
                {detail?.docType === "factura" && (
                  <OutlinedField
                    id="fix-address"
                    label="Dirección"
                    value={customer.address}
                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  />
                )}
              </>
            ) : (
              <>
                {form?.kind === "debit" && (
                  <OutlinedField
                    id="action-amount"
                    label="Monto (S/, con IGV)"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  />
                )}
                <OutlinedField
                  id="action-text"
                  label={form?.kind === "void" ? "Motivo" : form?.kind === "credit" ? "Sustento" : "Concepto"}
                  autoFocus
                  value={text}
                  maxLength={form?.kind === "void" ? 100 : 250}
                  onChange={(e) => setText(e.target.value)}
                />
                {form?.kind === "void" && (
                  <p className="-mt-2 text-xs text-muted-foreground">
                    SUNAT recibe la anulación en un lote y la confirma en minutos u horas.
                  </p>
                )}
              </>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" className="uppercase" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="document-action-form"
              className="uppercase"
              disabled={isPending || (form?.kind !== "approve" && text.trim().length < 3)}
            >
              {isPending && <LoaderCircleIcon className="animate-spin" />}
              {form?.kind === "void" ? "Anular" : "Emitir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
