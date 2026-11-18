// Convierte el payload del webhook de WhatsApp Cloud API en mensajes del dominio.
// Los eventos de estado (enviado, entregado, leído) se descartan.

import { z } from "zod";
import type { IncomingMessage } from "../domain/types";

const messageSchema = z.looseObject({
  id: z.string(),
  from: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .looseObject({
      type: z.string(),
      list_reply: z.object({ id: z.string() }).loose().optional(),
      button_reply: z.object({ id: z.string() }).loose().optional(),
    })
    .optional(),
});

const payloadSchema = z.looseObject({
  object: z.string(),
  entry: z.array(
    z.looseObject({
      changes: z.array(
        z.looseObject({
          field: z.string(),
          value: z.looseObject({
            contacts: z
              .array(
                z.looseObject({
                  wa_id: z.string().optional(),
                  profile: z.looseObject({ name: z.string().optional() }).optional(),
                }),
              )
              .optional(),
            messages: z.array(messageSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});

export function parseWebhook(payload: unknown): IncomingMessage[] {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.object !== "whatsapp_business_account") return [];

  const result: IncomingMessage[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const { contacts = [], messages = [] } = change.value;

      for (const m of messages) {
        const contact = contacts.find((c) => c.wa_id === m.from) ?? contacts[0];
        const base = { id: m.id, from: m.from, name: contact?.profile?.name?.trim() || undefined };

        const optionId = m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id;
        if (m.type === "interactive" && optionId) {
          result.push({ ...base, kind: "option", optionId });
        } else if (m.type === "text" && m.text) {
          result.push({ ...base, kind: "text", text: m.text.body });
        } else {
          result.push({ ...base, kind: "other" });
        }
      }
    }
  }
  return result;
}
