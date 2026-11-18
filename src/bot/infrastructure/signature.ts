import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida el encabezado X-Hub-Signature-256 que Meta envía en cada POST:
 * "sha256=" + HMAC-SHA256(cuerpo crudo, App Secret) en hexadecimal.
 */
export function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  let received: Buffer;
  try {
    received = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  } catch {
    return false;
  }

  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function sign(rawBody: string, appSecret: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}
