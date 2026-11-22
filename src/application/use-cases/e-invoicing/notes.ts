import {
  CREDIT_NOTE_REASONS,
  DEBIT_NOTE_REASONS,
  type SaleDocumentListItem,
  VOID_MAX_DAYS,
} from "@/domain/entities/sale-document";
import { ValidationError } from "@/domain/errors";
import type { EInvoicingGateway } from "@/domain/repositories/e-invoicing-gateway";
import type { EInvoicingSettingsRepository } from "@/domain/repositories/e-invoicing-settings-repository";
import type { SaleDocumentNoteRepository } from "@/domain/repositories/sale-document-note-repository";
import type { SaleDocumentRepository } from "@/domain/repositories/sale-document-repository";

export interface NotesDeps {
  documents: SaleDocumentRepository;
  notes: SaleDocumentNoteRepository;
  settings: EInvoicingSettingsRepository;
  gateway: EInvoicingGateway;
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Who acts: a cashier may only act on the sales they charged; the admin, on
// any. (The 7-day annulment rule applies to both.)
export interface Actor {
  id: number;
  isAdmin: boolean;
}

export function canActOn(doc: Pick<SaleDocumentListItem, "cashierId">, actor: Actor): boolean {
  return actor.isAdmin || doc.cashierId === actor.id;
}

function assertOwner(doc: SaleDocumentListItem, actor: Actor) {
  if (!canActOn(doc, actor)) {
    throw new ValidationError("Solo puedes hacerlo con las ventas que tú cobraste.");
  }
}

// Only a document SUNAT holds as valid can be annulled or noted.
function assertValid(doc: SaleDocumentListItem | null): asserts doc is SaleDocumentListItem & { motorId: string } {
  if (!doc) throw new ValidationError("El comprobante no existe.");
  if (doc.status !== "issued" || !doc.motorId) {
    throw new ValidationError("Solo se puede hacer sobre un comprobante emitido.");
  }
  if (doc.motorStatus !== "ACEPTADO" && doc.motorStatus !== "OBSERVADO") {
    throw new ValidationError(
      `SUNAT todavía no lo aceptó (está ${doc.motorStatus ?? "sin respuesta"}). Refresca el estado e inténtalo después.`,
    );
  }
}

function reasonText(text: string, min: number, max: number, what: string): string {
  const clean = text.trim().toUpperCase();
  if (clean.length < min || clean.length > max) {
    throw new ValidationError(`${what}: de ${min} a ${max} caracteres.`);
  }
  return clean;
}

// Whether the annulment window is still open (7 days from issue).
export function canVoid(doc: Pick<SaleDocumentListItem, "issuedAt">, now: Date): boolean {
  return doc.issuedAt !== null && now.getTime() - doc.issuedAt.getTime() <= VOID_MAX_DAYS * DAY_MS;
}

// Annuls the document with SUNAT: a factura by comunicación de baja (RA), a
// boleta by resumen diario (RC). SUNAT answers the batch later; the motor
// follows it up and the document turns ANULADO (refresh its status).
export async function voidDocument(deps: NotesDeps, id: number, reason: string, actor: Actor) {
  const doc = await deps.documents.findById(id);
  assertValid(doc);
  assertOwner(doc, actor);
  if (!canVoid(doc, (deps.now ?? (() => new Date()))())) {
    throw new ValidationError(
      `Pasaron más de ${VOID_MAX_DAYS} días desde la emisión: ya no se puede anular. Emite una nota de crédito.`,
    );
  }
  const motivo = reasonText(reason, 3, 100, "El motivo");
  const batch = await deps.gateway.void(doc.motorId, motivo);
  await deps.notes.create({
    saleDocumentId: doc.id,
    kind: "void",
    motorId: batch.id,
    number: batch.identifier,
    reasonCode: null,
    reasonText: motivo,
    motorStatus: batch.status,
    createdBy: actor.id,
  });
  if (batch.status === "ACEPTADO") {
    await deps.documents.updateMotorStatus(doc.id, {
      id: doc.motorId,
      number: doc.number ?? "",
      status: "ANULADO",
      sunatCode: doc.sunatCode,
      sunatDescription: doc.sunatDescription,
    });
  }
  return batch;
}

async function nextKey(deps: NotesDeps, doc: SaleDocumentListItem, prefix: "nc" | "nd") {
  const notes = await deps.notes.listByDocument(doc.id);
  const kind = prefix === "nc" ? "credit_note" : "debit_note";
  return `${doc.saleUuid}:${prefix}${notes.filter((n) => n.kind === kind).length + 1}`;
}

// A credit note that cancels the whole sale (catalog 09: 01, 02, 06). The
// motor copies the lines of the original document.
export async function issueCreditNote(
  deps: NotesDeps,
  id: number,
  input: { reasonCode: string; detail: string },
  actor: Actor,
) {
  const doc = await deps.documents.findById(id);
  assertValid(doc);
  assertOwner(doc, actor);
  if (!(input.reasonCode in CREDIT_NOTE_REASONS)) throw new ValidationError("Elige un motivo de la lista.");
  if (input.reasonCode === "02" && doc.docType !== "factura") {
    throw new ValidationError("«Error en el RUC» solo aplica a facturas.");
  }
  const sustento = reasonText(input.detail, 3, 500, "El sustento");
  const settings = await deps.settings.get();
  const note = await deps.gateway.creditNote(
    {
      serie: doc.docType === "factura" ? settings.creditNoteFacturaSeries : settings.creditNoteBoletaSeries,
      documento_afectado_id: doc.motorId,
      motivo: input.reasonCode,
      sustento,
    },
    await nextKey(deps, doc, "nc"),
  );
  await deps.notes.create({
    saleDocumentId: doc.id,
    kind: "credit_note",
    motorId: note.id,
    number: note.number,
    reasonCode: input.reasonCode,
    reasonText: sustento,
    motorStatus: note.status,
    createdBy: actor.id,
  });
  return note;
}

// A debit note charging an extra amount (catalog 10), as one line.
export async function issueDebitNote(
  deps: NotesDeps,
  id: number,
  input: { reasonCode: string; detail: string; amount: number },
  actor: Actor,
) {
  const doc = await deps.documents.findById(id);
  assertValid(doc);
  assertOwner(doc, actor);
  if (!(input.reasonCode in DEBIT_NOTE_REASONS)) throw new ValidationError("Elige un motivo de la lista.");
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 99999) {
    throw new ValidationError("El monto debe ser mayor a cero.");
  }
  const sustento = reasonText(input.detail, 3, 250, "El concepto");
  const settings = await deps.settings.get();
  const note = await deps.gateway.debitNote(
    {
      serie: doc.docType === "factura" ? settings.debitNoteFacturaSeries : settings.debitNoteBoletaSeries,
      documento_afectado_id: doc.motorId,
      motivo: input.reasonCode,
      sustento,
      items: [
        {
          codigo: "ND",
          descripcion: sustento,
          unidad: "ZZ",
          cantidad: "1",
          precio_unitario: input.amount.toFixed(2),
          afectacion_igv: settings.globalIgvOverride ?? "10",
        },
      ],
    },
    await nextKey(deps, doc, "nd"),
  );
  await deps.notes.create({
    saleDocumentId: doc.id,
    kind: "debit_note",
    motorId: note.id,
    number: note.number,
    reasonCode: input.reasonCode,
    reasonText: sustento,
    motorStatus: note.status,
    createdBy: actor.id,
  });
  return note;
}

// Brings the notes of a document up to date with SUNAT: a note still
// pending is asked to the motor, and the annulment counts as accepted once
// the document itself is ANULADO.
export async function refreshDocumentNotes(deps: NotesDeps, id: number): Promise<void> {
  const doc = await deps.documents.findById(id);
  if (!doc) return;
  for (const note of await deps.notes.listByDocument(id)) {
    if (note.motorStatus === "ACEPTADO" || !note.motorId) continue;
    if (note.kind === "void") {
      if (doc.motorStatus === "ANULADO") await deps.notes.updateStatus(note.id, "ACEPTADO");
      continue;
    }
    const current = await deps.gateway.get(note.motorId);
    if (current.status !== note.motorStatus) await deps.notes.updateStatus(note.id, current.status);
  }
}
