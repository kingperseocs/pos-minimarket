import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SaleDocumentListItem } from "@/domain/entities/sale-document";
import { ValidationError } from "@/domain/errors";
import type { EInvoicingGateway } from "@/domain/repositories/e-invoicing-gateway";
import type { RequeuePatch, SaleDocumentRepository } from "@/domain/repositories/sale-document-repository";
import type { IssueDeps } from "./issue-sale-document";
import {
  approveReviewedDocument,
  canApprove,
  canReissue,
  reissueRejectedDocument,
  retryDocument,
} from "./manage-document";

const UUID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function doc(over: Partial<SaleDocumentListItem> = {}): SaleDocumentListItem {
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
    status: "review",
    reviewReasons: ["invalid_customer"],
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
    saleTotal: 800,
    cashierId: 2,
    soldAt: new Date(),
    cashierName: "CAJA 1",
    ...over,
  };
}

function fakes(current: SaleDocumentListItem) {
  const requeued: RequeuePatch[] = [];
  const documents = {
    async findById() {
      return current;
    },
    async requeue(_id: number, patch: RequeuePatch) {
      requeued.push(patch);
    },
    // Claimed by nobody in these tests: issuing is covered elsewhere.
    async claim() {
      return null;
    },
  } as unknown as SaleDocumentRepository;
  const deps: IssueDeps = { documents, gateway: {} as EInvoicingGateway };
  return { deps, requeued };
}

describe("canApprove / canReissue", () => {
  it("only a customer problem can be approved by the admin", () => {
    assert.equal(canApprove(doc()), true);
    assert.equal(canApprove(doc({ reviewReasons: ["invalid_customer", "discount"] })), false);
    assert.equal(canApprove(doc({ reviewReasons: ["rounding"] })), false);
    assert.equal(canApprove(doc({ status: "queued" })), false);
  });

  it("only a document SUNAT rejected is reissued", () => {
    assert.equal(canReissue(doc({ status: "issued", motorStatus: "RECHAZADO" })), true);
    assert.equal(canReissue(doc({ status: "issued", motorStatus: "ACEPTADO" })), false);
  });
});

describe("approveReviewedDocument", () => {
  it("stores the corrected customer and clears the review", async () => {
    const { deps, requeued } = fakes(doc());
    await approveReviewedDocument(deps, 7, { docType: "1", number: "12345678", name: "juan perez" });
    assert.deepEqual(requeued, [
      {
        customer: {
          customerDocType: "1",
          customerDocNumber: "12345678",
          customerName: "JUAN PEREZ",
          customerAddress: null,
        },
        clearReview: true,
      },
    ]);
  });

  it("still needs a customer above S/ 700", async () => {
    const { deps } = fakes(doc());
    await assert.rejects(approveReviewedDocument(deps, 7, null), ValidationError);
  });

  it("refuses a sale waiting for the accountant", async () => {
    const { deps } = fakes(doc({ reviewReasons: ["discount"] }));
    await assert.rejects(
      approveReviewedDocument(deps, 7, { docType: "1", number: "12345678", name: "JUAN" }),
      /contador/,
    );
  });
});

describe("reissueRejectedDocument", () => {
  it("uses a new idempotency key and forgets the rejected document", async () => {
    const { deps, requeued } = fakes(doc({ status: "issued", motorStatus: "RECHAZADO" }));
    await reissueRejectedDocument(deps, 7);
    assert.deepEqual(requeued, [{ idempotencyKey: `${UUID}:r1`, resetMotor: true }]);

    const again = fakes(doc({ status: "issued", motorStatus: "RECHAZADO", idempotencyKey: `${UUID}:r1` }));
    await reissueRejectedDocument(again.deps, 7);
    assert.equal(again.requeued[0].idempotencyKey, `${UUID}:r2`);
  });
});

describe("retryDocument", () => {
  it("requeues a failed document but not an issued one", async () => {
    const { deps, requeued } = fakes(doc({ status: "failed", reviewReasons: [] }));
    await retryDocument(deps, 7);
    assert.deepEqual(requeued, [{}]);
    await assert.rejects(retryDocument(fakes(doc({ status: "issued" })).deps, 7), ValidationError);
  });
});
