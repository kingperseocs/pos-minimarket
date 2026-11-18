import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDeliverySchedule } from "@/domain/entities/supplier";
import { supplierSchema } from "./supplier";

// Every required field filled.
const base = {
  ruc: "20100113610",
  businessName: "Distribuidora Andina S.A.C.",
  tradeName: "Andina",
  address: "Av. Argentina 123, Lima",
  contactName: "Juan Pérez",
  phone: "987 654 321",
  categoryIds: [1],
  deliveryDays: [1],
  deliveryTimeFrom: "09:00",
  deliveryTimeTo: "11:00",
};

describe("supplierSchema", () => {
  it("adds https:// to a link typed without it", () => {
    const data = supplierSchema.parse({
      ...base,
      website: "backus.pe",
      catalogUrl: "https://drive.google.com/file/abc",
    });
    assert.equal(data.website, "https://backus.pe");
    assert.equal(data.catalogUrl, "https://drive.google.com/file/abc");
  });

  it("rejects a link without a domain", () => {
    assert.equal(supplierSchema.safeParse({ ...base, catalogUrl: "catalogo" }).success, false);
  });

  it("stores blank optional fields as null", () => {
    const data = supplierSchema.parse({
      ...base,
      website: "",
      email: "",
      claimsContactName: "",
      claimsPhone: "",
      catalogUrl: "",
      notes: "",
    });
    assert.equal(data.website, null);
    assert.equal(data.email, null);
    assert.equal(data.claimsContactName, null);
    assert.equal(data.claimsPhone, null);
    assert.equal(data.catalogUrl, null);
    assert.equal(data.notes, null);
  });

  it("requires the company, salesperson and order fields", () => {
    const required = [
      ["ruc", "Escribe el RUC"],
      ["tradeName", "Escribe el nombre comercial"],
      ["address", "Escribe la dirección fiscal"],
      ["contactName", "Escribe el nombre del vendedor"],
      ["phone", "Escribe el celular del vendedor"],
      ["deliveryTimeFrom", "Escribe desde qué hora entrega"],
      ["deliveryTimeTo", "Escribe hasta qué hora entrega"],
    ] as const;
    for (const [field, message] of required) {
      const result = supplierSchema.safeParse({ ...base, [field]: "" });
      assert.equal(result.success, false, field);
      assert.equal(result.error?.issues[0].message, message);
    }
    assert.equal(supplierSchema.safeParse({ ...base, categoryIds: [] }).success, false);
    assert.equal(supplierSchema.safeParse({ ...base, deliveryDays: [] }).success, false);
  });

  it("sorts the order days and drops repeats", () => {
    const data = supplierSchema.parse({ ...base, deliveryDays: [4, 1, 4] });
    assert.deepEqual(data.deliveryDays, [1, 4]);
  });

  it("rejects an order window that ends before it starts", () => {
    const result = supplierSchema.safeParse({
      ...base,
      deliveryTimeFrom: "11:00",
      deliveryTimeTo: "09:00",
    });
    assert.equal(result.success, false);
  });

  it("validates the claims phone like the salesperson's", () => {
    assert.equal(supplierSchema.safeParse({ ...base, claimsPhone: "abc" }).success, false);
    assert.equal(
      supplierSchema.parse({ ...base, claimsPhone: "987 654 321" }).claimsPhone,
      "987 654 321",
    );
  });
});

describe("supplierSchema payment", () => {
  it("asks for the Yape/Plin number only when it accepts Yape/Plin", () => {
    assert.equal(
      supplierSchema.safeParse({ ...base, acceptsYapePlin: true, yapePlinPhone: "" }).error
        ?.issues[0].message,
      "Escribe el número de Yape/Plin",
    );
    const data = supplierSchema.parse({ ...base, acceptsYapePlin: false, yapePlinPhone: "987654321" });
    assert.equal(data.yapePlinPhone, null);
  });

  it("asks for the credit days only when it gives credit", () => {
    assert.equal(
      supplierSchema.safeParse({ ...base, givesCredit: true, creditDays: "" }).error
        ?.issues[0].message,
      "¿A cuántos días da crédito?",
    );
    assert.equal(supplierSchema.safeParse({ ...base, givesCredit: true, creditDays: "0" }).success, false);
    assert.equal(supplierSchema.parse({ ...base, givesCredit: true, creditDays: "15" }).creditDays, 15);
    assert.equal(supplierSchema.parse({ ...base, givesCredit: false, creditDays: "15" }).creditDays, null);
  });

  it("needs an account when it says it has bank accounts", () => {
    assert.equal(
      supplierSchema.safeParse({ ...base, hasBankAccounts: true, bankAccounts: [] }).error
        ?.issues[0].message,
      "Agrega al menos una cuenta bancaria",
    );
    const half = { bank: "BCP", accountNumber: "", cci: "" };
    assert.deepEqual(
      supplierSchema.parse({ ...base, hasBankAccounts: false, bankAccounts: [half] }).bankAccounts,
      [],
    );
  });

  it("keeps the digits of the account and its CCI", () => {
    const data = supplierSchema.parse({
      ...base,
      hasBankAccounts: true,
      bankAccounts: [
        { bank: " BCP ", accountNumber: "191-1234567-0-12", cci: "002 19111234567012153" },
        { bank: "Interbank", accountNumber: "2003001234567", cci: "" },
      ],
    });
    assert.deepEqual(data.bankAccounts, [
      { bank: "BCP", accountNumber: "1911234567012", cci: "00219111234567012153" },
      { bank: "Interbank", accountNumber: "2003001234567", cci: null },
    ]);
    assert.equal("hasBankAccounts" in data, false);
  });

  it("rejects a CCI that is not 20 digits", () => {
    const result = supplierSchema.safeParse({
      ...base,
      hasBankAccounts: true,
      bankAccounts: [{ bank: "BCP", accountNumber: "1911234567012", cci: "0021911123456701215" }],
    });
    assert.equal(result.error?.issues[0].message, "El CCI tiene 20 dígitos");
  });
});

describe("formatDeliverySchedule", () => {
  it("joins the days (Monday first) and the window", () => {
    assert.equal(formatDeliverySchedule([4, 1], "09:00", "11:00"), "Lun, Jue · 09:00–11:00");
  });

  it("puts Sunday last and handles a missing end", () => {
    assert.equal(formatDeliverySchedule([0, 6], "08:00", null), "Sáb, Dom · desde 08:00");
  });

  it("is null when nothing is set", () => {
    assert.equal(formatDeliverySchedule([], null, null), null);
  });
});
