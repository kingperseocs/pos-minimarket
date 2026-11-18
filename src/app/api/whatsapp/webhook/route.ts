import { after, NextResponse } from "next/server";
import { decide } from "@/bot/domain/engine";
import { whatsappConfig } from "@/bot/infrastructure/config";
import { isValidSignature } from "@/bot/infrastructure/signature";
import { parseWebhook } from "@/bot/infrastructure/webhook-parser";
import { markAsRead, sendMessage } from "@/bot/infrastructure/whatsapp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Meta reintenta si no recibe 200 a tiempo; esto evita responder dos veces al
// mismo mensaje mientras la instancia siga viva (mitigación, no garantía).
const recentIds = new Set<string>();
function alreadySeen(id: string): boolean {
  if (recentIds.has(id)) return true;
  recentIds.add(id);
  if (recentIds.size > 500) recentIds.delete(recentIds.values().next().value!);
  return false;
}

// Verificación del webhook: Meta llama con hub.mode, hub.verify_token y hub.challenge.
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { verifyToken } = whatsappConfig();

  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken) {
    return new Response(params.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

// Eventos entrantes (mensajes y estados).
export async function POST(request: Request) {
  const config = whatsappConfig();
  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const messages = parseWebhook(payload).filter((m) => !alreadySeen(m.id));

  // Se responde 200 de inmediato y los envíos corren después de la respuesta.
  after(async () => {
    for (const message of messages) {
      try {
        await markAsRead(config, message.id).catch(() => undefined);
        for (const reply of decide(message)) {
          await sendMessage(config, reply);
        }
      } catch (error) {
        console.error("[whatsapp-bot] error al responder", message.id, error);
      }
    }
  });

  return NextResponse.json({ ok: true });
}
