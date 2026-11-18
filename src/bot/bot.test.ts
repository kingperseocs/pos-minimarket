import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decide } from "./domain/engine";
import { LIST_LIMITS, MAIN_OPTIONS } from "./domain/flow";
import { isValidSignature, sign } from "./infrastructure/signature";
import { parseWebhook } from "./infrastructure/webhook-parser";
import { toGraphPayload } from "./infrastructure/whatsapp-client";

const FROM = "51987654321";

function webhook(message: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ wa_id: FROM, profile: { name: "Ana" } }],
              messages: [{ id: "wamid.1", from: FROM, timestamp: "1", ...message }],
              ...extra,
            },
          },
        ],
      },
    ],
  };
}

describe("flujo del bot", () => {
  it("las opciones respetan los límites de WhatsApp", () => {
    assert.equal(MAIN_OPTIONS.length, 4);
    assert.ok(MAIN_OPTIONS.length <= LIST_LIMITS.rows);
    for (const o of MAIN_OPTIONS) {
      assert.ok(o.title.length <= LIST_LIMITS.rowTitle, o.title);
      assert.ok((o.description ?? "").length <= LIST_LIMITS.rowDescription, o.id);
    }
  });

  it("un texto cualquiera abre el menú con saludo y 4 opciones", () => {
    const [reply, ...rest] = decide({ id: "1", from: FROM, name: "Ana", kind: "text", text: "hola" });
    assert.equal(rest.length, 0);
    assert.equal(reply.kind, "menu");
    if (reply.kind !== "menu") return;
    assert.match(reply.body, /Hola Ana/);
    assert.deepEqual(
      reply.rows.map((r) => r.id),
      ["ayuda", "pedidos", "adquirir", "asesoria"],
    );
  });

  it("elegir una opción responde su texto de cierre", () => {
    const [reply] = decide({ id: "1", from: FROM, kind: "option", optionId: "ayuda" });
    assert.deepEqual(reply, { kind: "text", to: FROM, text: MAIN_OPTIONS[0].reply });
  });

  it("una opción desconocida vuelve a mostrar el menú", () => {
    const [reply] = decide({ id: "1", from: FROM, kind: "option", optionId: "xyz" });
    assert.equal(reply.kind, "menu");
  });
});

describe("parser del webhook", () => {
  it("lee mensajes de texto con el nombre del contacto", () => {
    const [m] = parseWebhook(webhook({ type: "text", text: { body: "hola" } }));
    assert.deepEqual(m, { id: "wamid.1", from: FROM, name: "Ana", kind: "text", text: "hola" });
  });

  it("lee la respuesta de la lista", () => {
    const [m] = parseWebhook(
      webhook({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "pedidos", title: "x" } } }),
    );
    assert.equal(m.kind, "option");
    assert.equal(m.kind === "option" && m.optionId, "pedidos");
  });

  it("otros tipos (imagen) se marcan como other", () => {
    const [m] = parseWebhook(webhook({ type: "image", image: { id: "img" } }));
    assert.equal(m.kind, "other");
  });

  it("ignora eventos de estado y payloads ajenos", () => {
    const statusOnly = webhook({});
    statusOnly.entry[0].changes[0].value = {
      messaging_product: "whatsapp",
      statuses: [{ id: "wamid.1", status: "read" }],
    } as never;
    assert.deepEqual(parseWebhook(statusOnly), []);
    assert.deepEqual(parseWebhook({ object: "page", entry: [] }), []);
    assert.deepEqual(parseWebhook("basura"), []);
  });
});

describe("firma y payload de salida", () => {
  it("valida X-Hub-Signature-256", () => {
    const body = JSON.stringify({ a: 1 });
    assert.equal(isValidSignature(body, sign(body, "secreto"), "secreto"), true);
    assert.equal(isValidSignature(body, sign(body, "otro"), "secreto"), false);
    assert.equal(isValidSignature(body, null, "secreto"), false);
    assert.equal(isValidSignature(body, "sha256=zz", "secreto"), false);
  });

  it("arma un mensaje de lista interactiva", () => {
    const [menu] = decide({ id: "1", from: FROM, kind: "text", text: "hola" });
    const payload = toGraphPayload(menu) as { type: string; interactive: { type: string; action: { sections: { rows: unknown[] }[] } } };
    assert.equal(payload.type, "interactive");
    assert.equal(payload.interactive.type, "list");
    assert.equal(payload.interactive.action.sections[0].rows.length, 4);
  });
});
