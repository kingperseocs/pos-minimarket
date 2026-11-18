import { z } from "zod";

const schema = z.object({
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_API_VERSION: z.string().default("v23.0"),
});

export type WhatsAppConfig = {
  token: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
  apiVersion: string;
};

/** Lee y valida las variables de entorno del bot. Lanza un error si falta alguna. */
export function whatsappConfig(env: NodeJS.ProcessEnv = process.env): WhatsAppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuración de WhatsApp incompleta: ${missing}`);
  }
  const e = parsed.data;
  return {
    token: e.WHATSAPP_TOKEN,
    phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: e.WHATSAPP_VERIFY_TOKEN,
    appSecret: e.WHATSAPP_APP_SECRET,
    apiVersion: e.WHATSAPP_API_VERSION,
  };
}
