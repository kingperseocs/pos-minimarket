import type { ReceptionLine } from "@/domain/entities/receiving";
import { ValidationError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { ReceivingRepository } from "@/domain/repositories/receiving-repository";
import { receptionSchema } from "@/application/validation/receiving";

// Step 1 of a receipt, by the Almacén while the supplier unloads: what
// arrived, counted, goes into stock now; prices and payment terms come with
// the invoice, typed later by the admin (registerInvoiceUseCase).
export async function receiveShipmentUseCase(
  deps: {
    receiving: ReceivingRepository;
    products: ProductRepository;
    presentations: PresentationRepository;
    audit: AuditRepository;
  },
  input: unknown,
  actorId: number,
  now = new Date(),
) {
  const data = receptionSchema.parse(input);

  if (data.supplierId === null) {
    throw new ValidationError("Elige el proveedor que trajo la mercadería");
  }

  const presentations = await deps.presentations.listAll();
  const lines: ReceptionLine[] = [];
  for (const [index, line] of data.lines.entries()) {
    const label = `Línea ${index + 1}`;
    const product = await deps.products.findById(line.productId);
    if (!product) throw new ValidationError(`${label}: el producto no existe`);

    let unitsPerPresentation = 1;
    if (line.presentationId !== null) {
      const presentation = presentations.find(
        (p) => p.id === line.presentationId && p.productId === product.id,
      );
      if (!presentation?.isActive) {
        throw new ValidationError(`${label}: presentación no válida para ${product.name}`);
      }
      unitsPerPresentation = presentation.unitsTotal;
    }
    if (product.tracksExpiry && !line.expiresAt) {
      throw new ValidationError(
        `${label}: ${product.name} vence, escribe su fecha de vencimiento`,
      );
    }
    lines.push({
      productId: product.id,
      presentationId: line.presentationId,
      quantity: line.quantity,
      receivedUnits: line.quantity * unitsPerPresentation,
      expiresAt: product.tracksExpiry ? line.expiresAt : null,
      captureSource: line.captureSource,
    });
  }

  const result = await deps.receiving.createReception({
    supplierId: data.supplierId,
    note: data.note,
    invoicePhotoUrl: data.invoicePhotoUrl,
    lines,
    actorId,
  });
  await deps.audit.record({
    type: "goods_received",
    actorId,
    payload: {
      receiptId: result.id,
      supplierId: data.supplierId,
      lines: lines.length,
      units: lines.reduce((sum, line) => sum + line.receivedUnits, 0),
      scanned: lines.filter((line) => line.captureSource === "scan").length,
      invoicePhoto: data.invoicePhotoUrl !== null,
    },
    occurredAt: now,
  });
  return result;
}
