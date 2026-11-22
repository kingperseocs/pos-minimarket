import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SaleDocumentListItem } from "@/domain/entities/sale-document";
import { MotorUnavailableError } from "@/domain/errors";
import { dailyReportUseCase, summarizePosDay } from "./daily-report";

function doc(status: SaleDocumentListItem["status"], saleTotal: number) {
  return { status, saleTotal } as SaleDocumentListItem;
}

describe("summarizePosDay", () => {
  it("splits the day's sales by document state", () => {
    assert.deepEqual(
      summarizePosDay([doc("issued", 14), doc("issued", 2), doc("review", 6.4), doc("failed", 3.5), doc("queued", 1.1)]),
      { sales: 5, salesTotal: 27, issued: 2, issuedTotal: 16, review: 1, reviewTotal: 6.4, pending: 2, pendingTotal: 4.6 },
    );
  });
});

describe("dailyReportUseCase", () => {
  it("still shows the till when the motor is unreachable", async () => {
    const result = await dailyReportUseCase(
      {
        documents: { async list() { return [doc("issued", 14)]; } },
        gateway: {
          async dailyReport() {
            throw new MotorUnavailableError("El motor de facturación no respondió: fetch failed");
          },
        },
      },
      "2026-11-22",
    );
    assert.equal(result.pos.issuedTotal, 14);
    assert.equal(result.motor, null);
    assert.match(result.motorError ?? "", /no respondió/);
  });
});
