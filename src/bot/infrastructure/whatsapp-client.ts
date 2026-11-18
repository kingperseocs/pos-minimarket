// Cliente mínimo de la WhatsApp Cloud API (Graph API de Meta).

import type { OutgoingMessage } from "../domain/types";
import type { WhatsAppConfig } from "./config";

export function toGraphPayload(message: OutgoingMessage): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to: message.to };

  if (message.kind === "text") {
    return { ...base, type: "text", text: { preview_url: false, body: message.text } };
  }

  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      ...(message.header ? { header: { type: "text", text: message.header } } : {}),
      body: { text: message.body },
      ...(message.footer ? { footer: { text: message.footer } } : {}),
      action: {
        button: message.buttonLabel,
        sections: [
          {
            title: message.sectionTitle,
            rows: message.rows.map((r) => ({
              id: r.id,
              title: r.title,
              ...(r.description ? { description: r.description } : {}),
            })),
          },
        ],
      },
    },
  };
}

async function post(config: WhatsAppConfig, body: Record<string, unknown>): Promise<void> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  }
}

export function sendMessage(config: WhatsAppConfig, message: OutgoingMessage): Promise<void> {
  return post(config, toGraphPayload(message));
}

/** Marca el mensaje como leído (doble check azul). */
export function markAsRead(config: WhatsAppConfig, messageId: string): Promise<void> {
  return post(config, { messaging_product: "whatsapp", status: "read", message_id: messageId });
}
