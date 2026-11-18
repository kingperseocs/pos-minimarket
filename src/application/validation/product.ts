import { z } from "zod";
import {
  MAX_PACK_FORMATS,
  MAX_PACK_LEVELS,
  NET_UNITS,
} from "@/domain/services/packaging";
import { barcodeSchema } from "./barcode";
import { idSchema, idWithMessage } from "./id";
import { supplierCodeSchema } from "./supplier-code";

// Only URLs produced by our own upload endpoint are accepted, so a product
// can't be pointed at an arbitrary external host.
const productImageUrl = z
  .string()
  .regex(
    /^\/api\/images\/products\/[0-9a-f-]{36}\.(jpg|png|webp)$/,
    "Imagen inválida",
  );

const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

// One supplier format turned into presentations, outermost first:
// [{ Caja, 16 }, { Paquete, 6 }] = Caja of 16 Paquete, Paquete of 6 units,
// with the code to order the outermost one.
const packFormatSchema = z
  .object({
    supplierCode: supplierCodeSchema,
    levels: z
      .array(
        z.object({
          name: z
            .string()
            .trim()
            .min(1, "Cada nivel del empaque necesita un nombre")
            .max(40, "Nombre del empaque muy largo")
            .refine((name) => name.toLowerCase() !== "unidad", {
              message: "La unidad ya existe: es lo que se vende en caja",
            }),
          qtyOfParent: z.coerce
            .number()
            .int("Las cantidades del empaque son números enteros")
            .min(2, "Cada nivel del empaque debe traer 2 o más")
            .max(10_000, "Cantidad del empaque muy grande"),
        }),
      )
      .min(1)
      .max(MAX_PACK_LEVELS, `Máximo ${MAX_PACK_LEVELS} niveles de empaque`),
  })
  .refine(
    ({ levels }) =>
      new Set(levels.map((l) => l.name.toLowerCase())).size === levels.length,
    { message: "Cada nivel del empaque debe tener un nombre distinto" },
  );

// Every way the supplier ships the product (Crackelet 47 g: 36 x 47 g and
// 6 x 6 x 47 g), each with its code.
export const packagingSchema = z.object({
  formats: z
    .array(packFormatSchema)
    .min(1, "Agrega al menos un formato")
    .max(MAX_PACK_FORMATS, `Máximo ${MAX_PACK_FORMATS} formatos por producto`),
});

const productFields = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  // The unit's code, scanned at the till.
  barcode: barcodeSchema,
  description: z.string().optional(),
  categoryId: idWithMessage("Selecciona una categoría"),
  priceSale: z.coerce.number().positive("El precio debe ser mayor a 0"),
  // Precio de compra per unit. Optional: blank = not known yet. Selling below
  // it is allowed (the form warns), e.g. to clear old stock.
  priceCost: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce
      .number("El precio de compra debe ser un número")
      .nonnegative("El precio de compra no puede ser negativo")
      .nullable(),
  ),
  // null = same as the category (most products).
  tracksExpiry: z.boolean().nullable().default(null),
  // null removes the image; omitted leaves it unchanged on update.
  imageUrl: productImageUrl.nullable().optional(),
  // What one unit holds ("31.5 g"). Blank = not entered.
  netContent: z.preprocess(
    blankToNull,
    z.coerce
      .number("El contenido neto debe ser un número")
      .positive("El contenido neto debe ser mayor a 0")
      .max(100_000, "Contenido neto muy grande")
      .nullable(),
  ),
  netContentUnit: z.preprocess(blankToNull, z.enum(NET_UNITS).nullable()),
  // Presentations to create from the catalog format; omitted = none.
  packaging: packagingSchema.nullable().optional(),
});

// A content without its unit (or the reverse) is meaningless.
const contentHasUnit = (data: {
  netContent: number | null;
  netContentUnit: string | null;
}) => (data.netContent === null) === (data.netContentUnit === null);
const contentUnitIssue = {
  message: "Elige la unidad del contenido neto (g, kg, ml o L)",
  path: ["netContentUnit"],
};

export const productCreateSchema = productFields.refine(
  contentHasUnit,
  contentUnitIssue,
);

export const productUpdateSchema = productFields
  .extend({ id: idSchema })
  .refine(contentHasUnit, contentUnitIssue);

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
