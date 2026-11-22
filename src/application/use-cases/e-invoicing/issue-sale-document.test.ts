import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SaleDocument } from "@/domain/entities/sale-document";
import { MotorRejectedError, MotorUnavailableError } from "@/domain/errors";
import type { EInvoicingGateway, MotorDocument } from "@/domain/repositories/e-invoicing-gateway";
import type { IssueContext, SaleDocumentRepository } from "@/domain/repositories/sale-document-repository";
import { type IssueDeps, drainOutbox, issueSaleDocument, retryDelayMs } from "./issue-sale-document";

const UUID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function document(over: Partial<SaleDocument> = {}): SaleDocument {
  return {
    id: 7,
    saleId: 3,
    saleUuid: UUID,
    docType: "boleta",
    series: "B001",
    customerDocType: "0",
    customerDocNumber: null,
    customerName: null,
    customerAddress: null,
    status: "sending",
    reviewReasons: [],
    motorId: null,
    number: null,
    motorStatus: null,
    sunatCode: null,
    sunatDescription: null,
    idempotencyKey: UUID,
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date(),
    issuedAt: null,
    createdAt: new Date(),
    ...over,
  };
}

function context(over: Partial<SaleDocument> = {}): IssueContext {
  return {
    document: document(over),
    items: [{ productId: 1, productName: "Gaseosa", unitPrice: 3.5, quantity: 2, lineTotal: 7 }],
    affectations: new Map([[1, "10"]]),
    globalOverride: null,
    cashierName: "CAJA 1",
  };
}

function fakes(opts: { claim?: IssueContext | null; issue?: () => Promise<MotorDocument>; due?: string[] }) {
  const log: string[] = [];
  const issued: { type: string; key: string; serie: string }[] = [];
  const documents = {
    async claim() {
      return opts.claim === undefined ? context() : opts.claim;
    },
    async dueForIssue() {
      return opts.due ?? [];
    },
    async markIssued(id: number, doc: MotorDocument) {
      log.push(`issued ${id} ${doc.number}`);
    },
    async markRetry(id: number, error: string, next: Date) {
      log.push(`retry ${id} ${next.toISOString()} ${error}`);
    },
    async markRejected(id: number, error: string) {
      log.push(`rejected ${id} ${error}`);
    },
    async findBySaleUuid() {
      return null;
    },
    async findById() {
      return null;
    },
  } as SaleDocumentRepository;
  const gateway = {
    async issue(type, request, key) {
      issued.push({ type, key, serie: request.serie });
      return (opts.issue ?? (async () => ({ id: "m-1", number: "B001-8", status: "ACEPTADO", sunatCode: 0, sunatDescription: "ok" })))();
    },
  } as EInvoicingGateway;
  const deps: IssueDeps = { documents, gateway, now: () => new Date("2026-11-22T15:00:00.000Z") };
  return { deps, log, issued };
}

describe("issueSaleDocument", () => {
  it("sends it with the sale uuid as idempotency key and records the number", async () => {
    const { deps, log, issued } = fakes({});
    assert.equal(await issueSaleDocument(deps, UUID), "issued");
    assert.deepEqual(issued, [{ type: "boleta", key: UUID, serie: "B001" }]);
    assert.deepEqual(log, ["issued 7 B001-8"]);
  });

  it("does nothing when it could not be claimed (another till, review, issued)", async () => {
    const { deps, log, issued } = fakes({ claim: null });
    assert.equal(await issueSaleDocument(deps, UUID), "skipped");
    assert.equal(issued.length, 0);
    assert.equal(log.length, 0);
  });

  it("motor down: retries later, waiting more each time", async () => {
    const { deps, log } = fakes({
      claim: context({ attempts: 2 }),
      issue: async () => {
        throw new MotorUnavailableError("El motor de facturación no respondió: fetch failed");
      },
    });
    assert.equal(await issueSaleDocument(deps, UUID), "retry");
    // 3rd failed attempt: 15 minutes after now.
    assert.deepEqual(log, ["retry 7 2026-11-22T15:15:00.000Z El motor de facturación no respondió: fetch failed"]);
  });

  it("motor refused: no automatic retry, the reason is kept", async () => {
    const { deps, log } = fakes({
      issue: async () => {
        throw new MotorRejectedError(422, "VALIDACION_FALLIDA", "Revisa los campos indicados.", [
          { field: "serie", message: "la serie no existe" },
        ]);
      },
    });
    assert.equal(await issueSaleDocument(deps, UUID), "rejected");
    assert.deepEqual(log, ["rejected 7 Revisa los campos indicados. · serie: la serie no existe"]);
  });
});

describe("retryDelayMs", () => {
  it("1, 5, 15 minutes, then every hour", () => {
    assert.deepEqual([1, 2, 3, 4, 9].map((n) => retryDelayMs(n) / 60_000), [1, 5, 15, 60, 60]);
  });
});

describe("drainOutbox", () => {
  it("sends each due document and counts the outcomes", async () => {
    const { deps, issued } = fakes({ due: [UUID, "other-uuid"] });
    const counts = await drainOutbox(deps);
    assert.deepEqual(counts, { issued: 2, retry: 0, rejected: 0, skipped: 0 });
    assert.equal(issued.length, 2);
  });
});
