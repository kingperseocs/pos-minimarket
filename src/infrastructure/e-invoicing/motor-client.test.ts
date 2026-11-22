import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MotorRejectedError, MotorUnavailableError } from "@/domain/errors";
import { MotorClient, motorConfig } from "./motor-client";

const config = () => ({ baseUrl: "http://motor.test", apiKey: "key-1", apiSecret: "secret-1" });

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { impl, calls };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const accepted = {
  data: {
    id: "d193c7f6-1429-4e8b-9df7-d5bb23783895",
    numero: "B001-7",
    estado: "ACEPTADO",
    sunat: { codigo: 0, descripcion: "La Boleta numero B001-7, ha sido aceptada" },
  },
};

describe("motorConfig", () => {
  it("lists the missing variables", () => {
    assert.throws(() => motorConfig({ MOTOR_URL: "http://localhost:8080" }), /MOTOR_API_KEY.*MOTOR_API_SECRET/);
  });

  it("drops the trailing slash", () => {
    const cfg = motorConfig({ MOTOR_URL: "http://localhost:8080/", MOTOR_API_KEY: "k", MOTOR_API_SECRET: "s" });
    assert.equal(cfg.baseUrl, "http://localhost:8080");
  });
});

describe("MotorClient.issue", () => {
  it("posts to /boletas with the credentials and the idempotency key", async () => {
    const f = fakeFetch(() => json(201, accepted));
    const client = new MotorClient(config, f.impl);

    const doc = await client.issue("boleta", { serie: "B001", items: [] }, "sale-uuid");

    assert.deepEqual(doc, {
      id: accepted.data.id,
      number: "B001-7",
      status: "ACEPTADO",
      sunatCode: 0,
      sunatDescription: accepted.data.sunat.descripcion,
    });
    const [call] = f.calls;
    assert.equal(call.url, "http://motor.test/api/v1/boletas");
    assert.equal(call.init.method, "POST");
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers["X-Api-Key"], "key-1");
    assert.equal(headers["X-Api-Secret"], "secret-1");
    assert.equal(headers["Idempotency-Key"], "sale-uuid");
    assert.deepEqual(JSON.parse(String(call.init.body)), { serie: "B001", items: [] });
  });

  it("uses /facturas for a factura", async () => {
    const f = fakeFetch(() => json(201, accepted));
    await new MotorClient(config, f.impl).issue("factura", { serie: "F001", items: [] }, "k");
    assert.equal(f.calls[0].url, "http://motor.test/api/v1/facturas");
  });

  it("a validation error is a rejection with its details", async () => {
    const f = fakeFetch(() =>
      json(422, {
        error: {
          code: "VALIDACION_FALLIDA",
          message: "Revisa los campos indicados.",
          details: [{ field: "serie", message: "la serie está inactiva" }],
        },
        correlationId: "x",
      }),
    );
    await assert.rejects(
      new MotorClient(config, f.impl).issue("boleta", { serie: "B001", items: [] }, "k"),
      (error: unknown) =>
        error instanceof MotorRejectedError &&
        error.status === 422 &&
        error.code === "VALIDACION_FALLIDA" &&
        error.details[0].field === "serie",
    );
  });

  it("a 5xx or a network failure means unavailable (retry later)", async () => {
    const down = fakeFetch(() => new Response("bad gateway", { status: 502 }));
    await assert.rejects(
      new MotorClient(config, down.impl).issue("boleta", { serie: "B001", items: [] }, "k"),
      MotorUnavailableError,
    );
    const offline = fakeFetch(() => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(new MotorClient(config, offline.impl).get("x"), MotorUnavailableError);
  });
});

describe("MotorClient.file", () => {
  it("streams the PDF with its headers", async () => {
    const f = fakeFetch(
      () =>
        new Response("%PDF-1.3", {
          status: 200,
          headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="x.pdf"' },
        }),
    );
    const file = await new MotorClient(config, f.impl).file("abc", "pdf", "a5");
    assert.equal(f.calls[0].url, "http://motor.test/api/v1/comprobantes/abc/pdf?formato=a5");
    assert.equal(file.contentType, "application/pdf");
    assert.equal(await new Response(file.body).text(), "%PDF-1.3");
  });
});

describe("MotorClient.void", () => {
  it("returns the annulment batch", async () => {
    const f = fakeFetch(() =>
      json(201, { data: { id: "r-1", identificador: "RC-20261122-1", estado: "EN_PROCESO" } }),
    );
    const batch = await new MotorClient(config, f.impl).void("abc", "ERROR EN LA VENTA");
    assert.deepEqual(batch, { id: "r-1", identifier: "RC-20261122-1", status: "EN_PROCESO" });
    assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { motivo: "ERROR EN LA VENTA" });
  });
});
