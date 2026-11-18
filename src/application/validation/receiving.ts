import { z } from "zod";
import { RECEIPT_DOC_TYPES } from "@/domain/entities/receiving";
import { CAPTURE_SOURCES } from "@/domain/value-objects/capture-source";
import { MAX_RECEIPT_DISCOUNT_PERCENT } from "@/domain/services/receiving";
import { isInvoicePhotoUrl } from "@/application/use-cases/inventory/upload-invoice-photo";
import { idSchema } from "./id";

const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const quantity = z.coerce
  .number("Escribe la cantidad")
  .int("La cantidad debe ser un número entero")
  .positive("La cantidad debe ser mayor a 0");

// How the product was identified (reader or by hand). Optional: clients
// from before the reader send none.
const captureSource = z.enum(CAPTURE_SOURCES).nullable().default(null);

export const receiptSchema = z.object({
  supplierId: z.preprocess(blankToNull, idSchema.nullable()),
  docType: z.enum(RECEIPT_DOC_TYPES).default("ninguno"),
  docNumber: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(30, "Máximo 30 caracteres")
      .transform((value) => value.toUpperCase())
      .nullable(),
  ),
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  lines: z
    .array(
      z.object({
        productId: idSchema,
        // null = bought by the unit.
        presentationId: z.preprocess(blankToNull, idSchema.nullable()),
        quantity,
        // What was paid for the line (ignored when it is a bonus).
        lineTotal: z.preprocess(
          blankToNull,
          z.coerce
            .number("Escribe el costo")
            .nonnegative("El costo no puede ser negativo")
            .nullable(),
        ),
        // Supplier's volume discount on the line (Coca-Cola: 8% for 10
        // packages). With it, lineTotal is the amount before the discount.
        discountPercent: z.preprocess(
          (value) => (value === "" || value === null || value === undefined ? 0 : value),
          z.coerce
            .number("Escribe el descuento en %")
            .min(0, "El descuento no puede ser negativo")
            .max(MAX_RECEIPT_DISCOUNT_PERCENT, `El descuento máximo es ${MAX_RECEIPT_DISCOUNT_PERCENT}%`),
        ),
        isBonus: z.boolean().default(false),
        // Units that actually arrived; null = everything on the invoice.
        receivedUnits: z.preprocess(
          blankToNull,
          z.coerce
            .number("Escribe cuántas unidades llegaron")
            .int("Debe ser un número entero")
            .min(0, "No puede ser negativo")
            .nullable(),
        ),
        expiresAt: z.preprocess(
          blankToNull,
          z.iso.date("Fecha de vencimiento inválida").nullable(),
        ),
        captureSource,
      }),
    )
    .min(1, "Agrega al menos un producto")
    .max(100, "Máximo 100 líneas por ingreso"),
});

const docNumber = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(30, "Máximo 30 caracteres")
    .transform((value) => value.toUpperCase())
    .nullable(),
);

const discountPercent = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? 0 : value),
  z.coerce
    .number("Escribe el descuento en %")
    .min(0, "El descuento no puede ser negativo")
    .max(MAX_RECEIPT_DISCOUNT_PERCENT, `El descuento máximo es ${MAX_RECEIPT_DISCOUNT_PERCENT}%`),
);

const NO_PRICES = "El almacén registra cantidades, no precios";

// Step 1, by the Almacén: what arrived, counted. No money on purpose: the
// one who counts doesn't type what the invoice charges (strict: a price sent
// anyway is refused, not silently ignored).
export const receptionSchema = z.strictObject(
  {
    supplierId: z.preprocess(blankToNull, idSchema.nullable()),
    note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
    invoicePhotoUrl: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .refine(isInvoicePhotoUrl, "Foto de factura inválida")
        .nullable(),
    ),
    lines: z
      .array(
        z.strictObject(
          {
            productId: idSchema,
            // null = by the unit.
            presentationId: z.preprocess(blankToNull, idSchema.nullable()),
            // Presentations counted (2 Cajas).
            quantity,
            expiresAt: z.preprocess(
              blankToNull,
              z.iso.date("Fecha de vencimiento inválida").nullable(),
            ),
            captureSource,
          },
          { error: NO_PRICES },
        ),
      )
      .min(1, "Agrega al menos un producto")
      .max(100, "Máximo 100 líneas por recepción"),
  },
  { error: NO_PRICES },
);

// Step 2, by the admin: the invoice over a reception. One line per received
// line (itemId), plus lines invoiced that never arrived (itemId null).
export const invoiceSchema = z.object({
  receiptId: idSchema,
  docType: z.enum(RECEIPT_DOC_TYPES).default("factura"),
  docNumber,
  lines: z
    .array(
      z.object({
        itemId: z.preprocess(blankToNull, idSchema.nullable()),
        productId: idSchema,
        presentationId: z.preprocess(blankToNull, idSchema.nullable()),
        // Invoiced presentations; 0 = it arrived but wasn't invoiced.
        quantity: z.coerce
          .number("Escribe la cantidad facturada")
          .int("La cantidad debe ser un número entero")
          .min(0, "La cantidad no puede ser negativa"),
        lineTotal: z.preprocess(
          blankToNull,
          z.coerce
            .number("Escribe el total de la línea")
            .nonnegative("El total no puede ser negativo")
            .nullable(),
        ),
        discountPercent,
        isBonus: z.boolean().default(false),
      }),
    )
    .min(1, "La factura no tiene líneas")
    .max(100, "Máximo 100 líneas por factura"),
});

export const transferSchema = z.object({
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  lines: z
    .array(
      z.object({
        productId: idSchema,
        presentationId: z.preprocess(blankToNull, idSchema.nullable()),
        quantity,
        captureSource,
      }),
    )
    .min(1, "Agrega al menos un producto")
    .max(100, "Máximo 100 líneas por traslado"),
});

export const resolveDiscrepancySchema = z.object({
  id: idSchema,
  status: z.enum(["replenished", "credited", "written_off", "kept", "returned"]),
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  // When the supplier brings the missing units of a product that expires.
  expiresAt: z.preprocess(
    blankToNull,
    z.iso.date("Fecha de vencimiento inválida").nullable(),
  ),
});
