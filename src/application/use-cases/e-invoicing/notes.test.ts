import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SaleDocumentListItem } from "@/domain/entities/sale-document";
import { ValidationError } from "@/domain/errors";
import type { EInvoicingGateway, MotorNoteRequest } from "@/domain/repositories/e-invoicing-gateway";
import type { EInvoicingSettingsRepository } from "@/domain/repositories/e-invoicing-settings-repository";
import type {
  NewSaleDocumentNote,
  SaleDocumentNoteRepository,
} from "@/domain/repositories/sale-document-note-repository";
import type { SaleDocumentRepository } from "@/domain/repositories/sale-document-repository";
import { canVoid, issueCreditNote, issueDebitNote, type NotesDeps, voidDocument } from "./notes";

const UUID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const NOW = new Date("2026-11-22T15:00:00.000Z");
const ADMIN = { id: 1, isAdmin: true };

function doc(over: Partial<SaleDocumentListItem> = {}): SaleDocumentListItem {
  return {
    id: 7, saleId: 3, saleUuid: UUID, docType: "boleta", series: "B001",
    customerDocType: "0", customerDocNumber: null, customerName: null, customerAddress: null,
    status: "issued", reviewReasons: [], motorId: "m-1", number: "B001-8", motorStatus: "ACEPTADO",
    sunatCode: 0, sunatDescription: "ok", idempotencyKey: UUID, attempts: 1, lastError: null,
    nextAttemptAt: NOW, issuedAt: new Date("2026-11-21T15:00:00.000Z"), createdAt: NOW,
    saleTotal: 14, cashierId: 2, cancelledByNote: false, voidSent: false, soldAt: NOW, cashierName: "CAJA 1",
    ...over,
  };
}

function fakes(current: SaleDocumentListItem) {
  const created: NewSaleDocumentNote[] = [];
  const sent: { kind: string; request?: MotorNoteRequest; key?: string; reason?: string }[] = [];
  const statuses: string[] = [];
  const deps: NotesDeps = {
    documents: {
      async findById() { return current; },
      async updateMotorStatus(_id: number, d: { status: string }) { statuses.push(d.status); },
    } as unknown as SaleDocumentRepository,
    notes: {
      async create(n: NewSaleDocumentNote) { created.push(n); },
      async listByDocument() { return []; },
      async updateStatus() {},
      async findById() { return null; },
    } as SaleDocumentNoteRepository,
    settings: {
      async get() {
        return {
          boletaSeries: "B001", facturaSeries: "F001", creditNoteBoletaSeries: "BC01", creditNoteFacturaSeries: "FC01",
          debitNoteBoletaSeries: "BD01", debitNoteFacturaSeries: "FD01", globalIgvOverride: null, autoEmitEnabled: true,
        };
      },
    } as unknown as EInvoicingSettingsRepository,
    gateway: {
      async void(_motorId: string, reason: string) {
        sent.push({ kind: "void", reason });
        return { id: "r-1", identifier: "RC-20261122-1", status: "EN_PROCESO" };
      },
      async creditNote(request: MotorNoteRequest, key: string) {
        sent.push({ kind: "nc", request, key });
        return { id: "n-1", number: "BC01-2", status: "ACEPTADO", sunatCode: 0, sunatDescription: "ok" };
      },
      async debitNote(request: MotorNoteRequest, key: string) {
        sent.push({ kind: "nd", request, key });
        return { id: "n-2", number: "BD01-1", status: "ACEPTADO", sunatCode: 0, sunatDescription: "ok" };
      },
    } as unknown as EInvoicingGateway,
    now: () => NOW,
  };
  return { deps, created, sent, statuses };
}

describe("voidDocument", () => {
  it("sends the annulment and records the batch", async () => {
    const { deps, created, sent } = fakes(doc());
    await voidDocument(deps, 7, "error en la venta", ADMIN);
    assert.deepEqual(sent, [{ kind: "void", reason: "ERROR EN LA VENTA" }]);
    assert.equal(created[0].kind, "void");
    assert.equal(created[0].number, "RC-20261122-1");
    assert.equal(created[0].motorStatus, "EN_PROCESO");
  });

  it("refuses after 7 days, or before SUNAT accepted it", async () => {
    const old = fakes(doc({ issuedAt: new Date("2026-11-10T15:00:00.000Z") }));
    await assert.rejects(voidDocument(old.deps, 7, "ERROR", ADMIN), /7 días/);
    const pending = fakes(doc({ motorStatus: "PENDIENTE" }));
    await assert.rejects(voidDocument(pending.deps, 7, "ERROR", ADMIN), ValidationError);
    assert.equal(canVoid(doc({ issuedAt: null }), NOW), false);
  });
});

describe("issueCreditNote", () => {
  it("uses the boleta credit-note series and a key per note", async () => {
    const { deps, created, sent } = fakes(doc());
    await issueCreditNote(deps, 7, { reasonCode: "01", detail: "cliente desistió" }, ADMIN);
    assert.equal(sent[0].request?.serie, "BC01");
    assert.equal(sent[0].request?.documento_afectado_id, "m-1");
    assert.equal(sent[0].key, `${UUID}:nc1`);
    assert.equal(created[0].number, "BC01-2");
  });

  it("«error en el RUC» only for facturas", async () => {
    const { deps } = fakes(doc());
    await assert.rejects(issueCreditNote(deps, 7, { reasonCode: "02", detail: "RUC errado" }, ADMIN), /facturas/);
  });
});

describe("issueDebitNote", () => {
  it("charges the amount as one line", async () => {
    const { deps, sent } = fakes(doc({ docType: "factura" }));
    await issueDebitNote(deps, 7, { reasonCode: "01", detail: "intereses", amount: 5 }, ADMIN);
    assert.equal(sent[0].request?.serie, "FD01");
    assert.equal(sent[0].request?.items?.[0].precio_unitario, "5.00");
    assert.equal(sent[0].key, `${UUID}:nd1`);
  });

  it("needs a positive amount", async () => {
    const { deps } = fakes(doc());
    await assert.rejects(issueDebitNote(deps, 7, { reasonCode: "01", detail: "x y z", amount: 0 }, ADMIN), ValidationError);
  });
});

describe("who may act", () => {
  it("a cashier only on the sales they charged", async () => {
    const { deps } = fakes(doc());
    await assert.rejects(voidDocument(deps, 7, "ERROR EN LA VENTA", { id: 5, isAdmin: false }), /tú cobraste/);
    await voidDocument(deps, 7, "ERROR EN LA VENTA", { id: 2, isAdmin: false });
  });
});
