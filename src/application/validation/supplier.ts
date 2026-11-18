import { z } from "zod";
import { MAX_BANK_ACCOUNTS } from "@/domain/entities/supplier";
import { isValidRuc } from "@/domain/services/ruc";
import { idSchema } from "./id";

// Optional text field: blank means "not provided" (stored as null).
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((value) => value || null)
    .nullable()
    .default(null);

// Required text field, with the message shown when it is blank.
const requiredText = (max: number, message: string) =>
  z.string(message).trim().min(1, message).max(max, `Máximo ${max} caracteres`);

const requiredPhone = (message: string) =>
  z
    .string(message)
    .trim()
    .min(1, message)
    .regex(/^\+?[\d\s-]{6,15}$/, "Teléfono inválido");

const requiredTime = (message: string) =>
  z
    .string(message)
    .trim()
    .min(1, message)
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

const optionalPhone = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\+?[\d\s-]{6,15}$/.test(value), {
    message: "Teléfono inválido",
  })
  .transform((value) => value || null)
  .nullable()
  .default(null);

// A real web address: parses and has a domain ("backus.pe", not "backus").
function isWebUrl(value: string) {
  if (!URL.canParse(value)) return false;
  const { protocol, hostname } = new URL(value);
  return (protocol === "https:" || protocol === "http:") && hostname.includes(".");
}

// "backus.pe" is accepted and stored as "https://backus.pe".
const optionalUrl = z
  .string()
  .trim()
  .max(300, "Máximo 300 caracteres")
  .transform((value) =>
    value === "" ? "" : /^https?:\/\//i.test(value) ? value : `https://${value}`,
  )
  .refine((value) => value === "" || isWebUrl(value), {
    message: "Enlace inválido (ej. https://www.proveedor.pe)",
  })
  .transform((value) => value || null)
  .nullable()
  .default(null);

// Digits only: spaces and dashes typed from the voucher are dropped.
const digitsOnly = (value: string) => value.replace(/[\s-]/g, "");

const bankAccountSchema = z.object({
  bank: requiredText(40, "Escribe el banco de la cuenta"),
  accountNumber: z
    .string("Escribe el número de cuenta")
    .transform(digitsOnly)
    .pipe(
      z
        .string()
        .min(1, "Escribe el número de cuenta")
        .regex(/^\d{6,20}$/, "Número de cuenta inválido: de 6 a 20 dígitos"),
    ),
  cci: z
    .string()
    .default("")
    .transform(digitsOnly)
    .refine((value) => value === "" || /^\d{20}$/.test(value), {
      message: "El CCI tiene 20 dígitos",
    })
    .transform((value) => value || null),
});

const supplierFields = z.object({
  ruc: z
    .string("Escribe el RUC")
    .trim()
    .min(1, "Escribe el RUC")
    .refine(isValidRuc, { message: "RUC inválido: revisa los 11 dígitos" }),
  businessName: z
    .string()
    .trim()
    .min(2, "Escribe la razón social")
    .max(150, "Máximo 150 caracteres"),
  tradeName: requiredText(80, "Escribe el nombre comercial"),
  contactName: requiredText(80, "Escribe el nombre del vendedor"),
  phone: requiredPhone("Escribe el celular del vendedor"),
  email: z
    .union([z.literal(""), z.email("Correo inválido")])
    .transform((value) => value || null)
    .nullable()
    .default(null),
  address: requiredText(200, "Escribe la dirección fiscal"),
  website: optionalUrl,
  claimsContactName: optionalText(80),
  claimsPhone: optionalPhone,
  deliveryDays: z
    .array(z.coerce.number().int().min(0).max(6))
    .default([])
    .refine((days) => days.length > 0, { message: "Elige al menos un día de reparto" })
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  deliveryTimeFrom: requiredTime("Escribe desde qué hora entrega"),
  deliveryTimeTo: requiredTime("Escribe hasta qué hora entrega"),
  driverName: optionalText(80),
  driverPhone: optionalPhone,
  acceptsYapePlin: z.boolean().default(false),
  yapePlinPhone: optionalPhone,
  givesCredit: z.boolean().default(false),
  creditDays: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce
      .number()
      .int("Los días de crédito son un número entero")
      .min(1, "Entre 1 y 180 días de crédito")
      .max(180, "Entre 1 y 180 días de crédito")
      .nullable(),
  ),
  // Only how the form asks; "No" is stored as no accounts.
  hasBankAccounts: z.boolean().default(false),
  bankAccounts: z
    .array(bankAccountSchema)
    .max(MAX_BANK_ACCOUNTS, `Máximo ${MAX_BANK_ACCOUNTS} cuentas`)
    .default([]),
  catalogUrl: optionalUrl,
  notes: optionalText(500),
  categoryIds: z
    .array(idSchema)
    .default([])
    .refine((ids) => ids.length > 0, { message: "Elige al menos una categoría que te provee" }),
});

// A "No" answer wins over whatever was typed under it before switching.
function clearUnanswered(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const data = { ...(input as Record<string, unknown>) };
  if (!data.acceptsYapePlin) data.yapePlinPhone = "";
  if (!data.givesCredit) data.creditDays = "";
  if (!data.hasBankAccounts) data.bankAccounts = [];
  return data;
}

type Fields = z.infer<typeof supplierFields>;

// The rules between fields: the delivery window, and the details each "Sí"
// asks for.
function checkSupplier(data: Fields, ctx: z.RefinementCtx) {
  // "HH:MM" strings compare correctly as text.
  if (data.deliveryTimeFrom >= data.deliveryTimeTo) {
    ctx.addIssue({
      code: "custom",
      message: "La hora de inicio debe ser antes que la de fin",
      path: ["deliveryTimeTo"],
    });
  }
  if (data.acceptsYapePlin && !data.yapePlinPhone) {
    ctx.addIssue({
      code: "custom",
      message: "Escribe el número de Yape/Plin",
      path: ["yapePlinPhone"],
    });
  }
  if (data.givesCredit && data.creditDays === null) {
    ctx.addIssue({
      code: "custom",
      message: "¿A cuántos días da crédito?",
      path: ["creditDays"],
    });
  }
  if (data.hasBankAccounts && data.bankAccounts.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Agrega al menos una cuenta bancaria",
      path: ["bankAccounts"],
    });
  }
}

const withoutFormAnswers = ({ hasBankAccounts, ...data }: Fields) => {
  void hasBankAccounts;
  return data;
};

export const supplierSchema = z.preprocess(
  clearUnanswered,
  supplierFields.superRefine(checkSupplier).transform(withoutFormAnswers),
);

export const supplierUpdateSchema = z.preprocess(
  clearUnanswered,
  supplierFields
    .extend({ id: idSchema })
    .superRefine(checkSupplier)
    .transform(({ id, ...data }) => ({ id, ...withoutFormAnswers(data) })),
);

export type SupplierInput = z.infer<typeof supplierSchema>;
