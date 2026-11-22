import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import type { EInvoicingSettings } from "@/domain/entities/sale-document";
import type { EInvoicingSettingsRepository } from "@/domain/repositories/e-invoicing-settings-repository";
import { updateSettingsUseCase } from "./settings";

const valid = {
  boletaSeries: "b002",
  facturaSeries: "F001",
  creditNoteBoletaSeries: "BC01",
  creditNoteFacturaSeries: "FC01",
  debitNoteBoletaSeries: "BD01",
  debitNoteFacturaSeries: "FD01",
  globalIgvOverride: null,
  autoEmitEnabled: true,
};

function repo() {
  const saved: EInvoicingSettings[] = [];
  const r = {
    async get() {
      return saved.at(-1)!;
    },
    async update(s: EInvoicingSettings) {
      saved.push(s);
    },
  } as EInvoicingSettingsRepository;
  return { r, saved };
}

describe("updateSettingsUseCase", () => {
  it("normalizes the series to capitals and saves", async () => {
    const { r, saved } = repo();
    await updateSettingsUseCase(r, { ...valid, globalIgvOverride: "20" });
    assert.equal(saved[0].boletaSeries, "B002");
    assert.equal(saved[0].globalIgvOverride, "20");
  });

  it("a boleta series starts with B and a factura one with F", async () => {
    const { r } = repo();
    await assert.rejects(updateSettingsUseCase(r, { ...valid, boletaSeries: "F001" }), ZodError);
    await assert.rejects(updateSettingsUseCase(r, { ...valid, facturaSeries: "B001" }), ZodError);
    await assert.rejects(updateSettingsUseCase(r, { ...valid, creditNoteFacturaSeries: "FC1" }), ZodError);
  });

  it("only catalog 07 affectations", async () => {
    const { r } = repo();
    await assert.rejects(updateSettingsUseCase(r, { ...valid, globalIgvOverride: "40" }), ZodError);
  });
});
