import type { PreparedReceiptLine } from "@/domain/entities/receiving";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import { ValidationError } from "@/domain/errors";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { ReceivingRepository } from "@/domain/repositories/receiving-repository";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { round2 } from "@/domain/value-objects/money";
import { storeDateKey } from "@/domain/value-objects/store-time";
import {
  discountedLineTotal,
  receiptDiscrepancy,
  receiptDueDate,
  receiptLineUnitCost,
  receiptLineUnits,
} from "@/domain/services/receiving";
import { receiptSchema } from "@/application/validation/receiving";

// Merchandise arriving at the Almacén: every line becomes units (2 Cajas of
// 24 = 48), keeps its expiry date and its cost per unit.
export async function receiveGoodsUseCase(
  repos: {
    receiving: ReceivingRepository;
    products: ProductRepository;
    presentations: PresentationRepository;
    suppliers: SupplierRepository;
    audit: AuditRepository;
  },
  input: unknown,
  actorId: number,
  now = new Date(),
) {
  const data = receiptSchema.parse(input);


  if (data.docType !== "ninguno" && !data.docNumber) {
    throw new ValidationError("Escribe la serie y número del documento");
  }
  if (
    data.docNumber &&
    (await repos.receiving.documentExists(data.supplierId, data.docType, data.docNumber))
  ) {
    throw new ValidationError(
      `El documento ${data.docNumber} ya fue ingresado. Revisa el historial de ingresos.`,
    );
  }

  const presentations = await repos.presentations.listAll();
  const lines: PreparedReceiptLine[] = [];
  for (const [index, line] of data.lines.entries()) {
    const label = `Línea ${index + 1}`;
    const product = await repos.products.findById(line.productId);
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
    if (!line.isBonus && line.lineTotal === null) {
      throw new ValidationError(`${label}: escribe cuánto pagaste por ${product.name}`);
    }

    // With a volume discount the typed amount is the invoice's before it;
    // what was paid (and goes into the cost) is recomputed here.
    const hasDiscount = !line.isBonus && line.discountPercent > 0;
    const typed = line.isBonus ? 0 : (line.lineTotal ?? 0);
    const prepared = {
      quantity: line.quantity,
      unitsPerPresentation,
      lineTotal: hasDiscount ? discountedLineTotal(typed, line.discountPercent) : typed,
      isBonus: line.isBonus,
    };
    const units = receiptLineUnits(prepared);
    const receivedUnits = line.receivedUnits ?? units;
    receiptDiscrepancy(units, receivedUnits);
    lines.push({
      productId: product.id,
      presentationId: line.presentationId,
      quantity: line.quantity,
      units,
      receivedUnits,
      lineTotal: prepared.lineTotal,
      listTotal: hasDiscount ? typed : null,
      discountPercent: hasDiscount ? line.discountPercent : 0,
      unitCost: receiptLineUnitCost(prepared),
      isBonus: line.isBonus,
      expiresAt: product.tracksExpiry ? line.expiresAt : null,
      captureSource: line.captureSource,
    });
  }

  // Due the day it arrives, or after the supplier's credit days.
  const supplier =
    data.supplierId !== null ? await repos.suppliers.findById(data.supplierId) : null;
  const dueDate = receiptDueDate(
    storeDateKey(now),
    supplier?.givesCredit ? supplier.creditDays : null,
  );

  const total = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const result = await repos.receiving.createReceipt({
    supplierId: data.supplierId,
    docType: data.docType,
    docNumber: data.docNumber,
    note: data.note,
    total,
    dueDate,
    lines,
    actorId,
  });
  // Received and invoiced at once (the admin did both steps).
  await repos.audit.record({
    type: "goods_received",
    actorId,
    payload: {
      receiptId: result.id,
      supplierId: data.supplierId,
      lines: lines.length,
      units: lines.reduce((sum, line) => sum + line.receivedUnits, 0),
      docNumber: data.docNumber,
      total,
      withInvoice: true,
    },
    occurredAt: now,
  });
  return result;
}

export function listReceiptsUseCase(repo: ReceivingRepository) {
  return repo.listReceipts(100);
}
