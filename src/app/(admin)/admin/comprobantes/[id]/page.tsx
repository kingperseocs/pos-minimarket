import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canApprove, canReissue } from "@/application/use-cases/e-invoicing/manage-document";
import { canVoid } from "@/application/use-cases/e-invoicing/notes";
import { DocumentActions } from "@/components/admin/e-invoicing/document-actions";
import { NoteActions } from "@/components/admin/e-invoicing/note-actions";
import { PageHeader } from "@/components/admin/page-header";
import { DocumentStatusBadge } from "@/components/e-invoicing/document-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REVIEW_REASON_LABELS,
  SALE_DOCUMENT_NOTE_KIND_LABELS,
  SALE_DOCUMENT_TYPE_LABELS,
} from "@/domain/entities/sale-document";
import { STORE_TIME_ZONE, storeDateKey } from "@/domain/value-objects/store-time";
import { formatSoles } from "@/lib/money";
import { saleDocumentNoteRepository, saleDocumentRepository } from "@/infrastructure/repositories";

const dateTime = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: STORE_TIME_ZONE });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function AdminDocumentPage({ params }: PageProps<"/admin/comprobantes/[id]">) {
  const id = Number((await params).id);
  const doc = Number.isInteger(id) ? await saleDocumentRepository.findById(id) : null;
  if (!doc) notFound();

  const title = `${SALE_DOCUMENT_TYPE_LABELS[doc.docType]} ${doc.number ?? "(sin número)"}`;
  const notes = await saleDocumentNoteRepository.listByDocument(doc.id);
  const valid = doc.status === "issued" && (doc.motorStatus === "ACEPTADO" || doc.motorStatus === "OBSERVADO");
  const awaitsAccountant = doc.status === "review" && !canApprove(doc);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={`Venta del ${dateTime.format(doc.soldAt)}`}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/admin/comprobantes?date=${storeDateKey(doc.soldAt)}`} />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Comprobantes del día
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Estado">
                <DocumentStatusBadge status={doc.status} motorStatus={doc.motorStatus} />
              </Field>
              <Field label="Total cobrado">{formatSoles(doc.saleTotal)}</Field>
              <Field label="Cliente">
                {doc.customerName ? `${doc.customerName} · ${doc.customerDocNumber}` : "Clientes varios"}
              </Field>
              <Field label="Cajero">{doc.cashierName ?? "—"}</Field>
              {doc.customerAddress && <Field label="Dirección">{doc.customerAddress}</Field>}
              <Field label="Serie">{doc.series}</Field>
              {doc.issuedAt && <Field label="Emitido">{dateTime.format(doc.issuedAt)}</Field>}
              <Field label="Intentos">{doc.attempts}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Respuesta</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {doc.sunatDescription && (
              <p>
                <span className="text-muted-foreground">SUNAT: </span>
                {doc.sunatCode !== null && `[${doc.sunatCode}] `}
                {doc.sunatDescription}
              </p>
            )}
            {doc.status === "review" && (
              <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  En revisión: {doc.reviewReasons.map((r) => REVIEW_REASON_LABELS[r]).join(", ")}.
                  {awaitsAccountant &&
                    " Se emitirá cuando el contador defina cómo declarar descuentos, regalos, puntos y redondeo."}
                </span>
              </p>
            )}
            {doc.lastError && (
              <p className="text-red-700 dark:text-red-400">
                <span className="font-medium">Último error: </span>
                {doc.lastError}
              </p>
            )}
            {!doc.sunatDescription && doc.status !== "review" && !doc.lastError && (
              <p className="text-muted-foreground">Sin respuesta todavía.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentActions
        id={doc.id}
        status={doc.status}
        docType={doc.docType}
        hasMotorDocument={doc.motorId !== null}
        canApprove={canApprove(doc)}
        canReissue={canReissue(doc)}
        customer={
          doc.customerDocType !== "0" && doc.customerDocNumber && doc.customerName
            ? {
                docType: doc.customerDocType,
                number: doc.customerDocNumber,
                name: doc.customerName,
                address: doc.customerAddress,
              }
            : null
        }
      />

      {valid && <NoteActions id={doc.id} canVoid={canVoid(doc, new Date())} />}

      {notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Notas y anulaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {notes.map((note) => (
                <li key={note.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-medium">
                    {SALE_DOCUMENT_NOTE_KIND_LABELS[note.kind]} {note.number}
                  </span>
                  <span className="text-muted-foreground">{note.reasonText}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {note.motorStatus} · {note.createdByName} · {dateTime.format(note.createdAt)}
                  </span>
                  {note.kind !== "void" && (
                    <a
                      className="text-xs underline underline-offset-4"
                      href={`/api/e-invoicing/notes/${note.id}/pdf?formato=a4`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
