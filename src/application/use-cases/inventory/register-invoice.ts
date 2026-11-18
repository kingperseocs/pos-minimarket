import type { InvoicedLine } from "@/domain/entities/receiving";
import { ValidationError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { ReceivingRepository } from "@/domain/repositories/receiving-repository";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import {
  discountedLineTotal,
  invoiceGap,
  receiptDueDate,
  round4,
} from "@/domain/services/receiving";
import { round2 } from "@/domain/value-objects/money";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { invoiceSchema } from "@/application/validation/receiving";

type Deps = {
  receiving: ReceivingRepository;
  products: ProductRepository;
  presentations: PresentationRepository;
  suppliers: SupplierRepository;
  audit: AuditRepository;
};

// Step 2 of a receipt counted by the Almacén: the admin types the supplier's
// invoice over it. What was invoiced but didn't arrive (or arrived without
// being invoiced) becomes a discrepancy to claim; the cost of what arrived
// updates the products' average cost; the invoice is then due for payment.
export async function registerInvoiceUseCase(
  deps: Deps,
  input: unknown,
  actorId: number,
  now = new Date(),
) {
  const data = invoiceSchema.parse(input);
  const receipt = await deps.receiving.findReceiptForInvoice(data.receiptId);
  if (!receipt) throw new ValidationError("El ingreso no existe");
  if (receipt.invoiceStatus === "registered") {
    throw new ValidationError(`La factura del ingreso #${receipt.id} ya fue registrada`);
  }

  if (data.docType !== "ninguno" && !data.docNumber) {
    throw new ValidationError("Escribe la serie y número de la factura");
  }
  if (
    data.docNumber &&
    (await deps.receiving.documentExists(receipt.supplierId, data.docType, data.docNumber))
  ) {
    throw new ValidationError(
      `El documento ${data.docNumber} ya fue registrado en otro ingreso`,
    );
  }

  // Every received line once: the invoice can't drop what was counted.
  const received = new Map(receipt.lines.map((line) => [line.itemId, line]));
  const seen = new Set<number>();
  for (const line of data.lines) {
    if (line.itemId === null) continue;
    if (!received.has(line.itemId) || seen.has(line.itemId)) {
      throw new ValidationError("Las líneas de la factura no coinciden con lo recibido");
    }
    seen.add(line.itemId);
  }
  if (seen.size !== received.size) {
    throw new ValidationError("Falta facturar alguna línea de lo recibido");
  }

  const presentations = await deps.presentations.listAll();
  const lines: InvoicedLine[] = [];
  for (const [index, line] of data.lines.entries()) {
    const label = `Línea ${index + 1}`;
    const counted = line.itemId === null ? null : received.get(line.itemId)!;

    let productId = line.productId;
    let presentationId = line.presentationId;
    let unitsPerPresentation = 1;
    let name: string;
    if (counted) {
      // A received line keeps its product and pack: only the invoice changes.
      productId = counted.productId;
      presentationId = counted.presentationId;
      unitsPerPresentation = counted.unitsPerPresentation;
      name = counted.productName;
    } else {
      const product = await deps.products.findById(productId);
      if (!product) throw new ValidationError(`${label}: el producto no existe`);
      name = product.name;
      if (presentationId !== null) {
        const presentation = presentations.find(
          (p) => p.id === presentationId && p.productId === product.id,
        );
        if (!presentation) {
          throw new ValidationError(`${label}: presentación no válida para ${product.name}`);
        }
        unitsPerPresentation = presentation.unitsTotal;
      }
      if (line.quantity === 0) {
        throw new ValidationError(`${label}: escribe cuánto facturaron de ${name}`);
      }
    }

    // Nothing invoiced (it arrived as extra) costs nothing on this invoice.
    const free = line.isBonus || line.quantity === 0;
    if (!free && line.lineTotal === null) {
      throw new ValidationError(`${label}: escribe el total facturado de ${name}`);
    }
    const typed = free ? 0 : (line.lineTotal ?? 0);
    const hasDiscount = !free && line.discountPercent > 0;
    const lineTotal = hasDiscount ? discountedLineTotal(typed, line.discountPercent) : typed;
    const units = line.quantity * unitsPerPresentation;

    lines.push({
      itemId: line.itemId,
      productId,
      presentationId,
      quantity: line.quantity,
      units,
      receivedUnits: counted?.receivedUnits ?? 0,
      lineTotal,
      listTotal: hasDiscount ? typed : null,
      discountPercent: hasDiscount ? line.discountPercent : 0,
      unitCost: free || units === 0 ? 0 : round4(lineTotal / units),
      isBonus: line.isBonus,
    });
  }

  // Due the day it arrived, or after the supplier's credit days.
  const supplier =
    receipt.supplierId !== null ? await deps.suppliers.findById(receipt.supplierId) : null;
  const dueDate = receiptDueDate(
    storeDateKey(receipt.receivedAt),
    supplier?.givesCredit ? supplier.creditDays : null,
  );
  const total = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));

  const result = await deps.receiving.applyInvoice({
    receiptId: receipt.id,
    docType: data.docType,
    docNumber: data.docNumber,
    total,
    dueDate,
    lines,
    actorId,
    at: now,
  });

  const gaps = lines.flatMap((line) => {
    const gap = invoiceGap(line);
    return gap ? [{ productId: line.productId, ...gap }] : [];
  });
  await deps.audit.record({
    type: "receipt_invoiced",
    actorId,
    payload: {
      receiptId: receipt.id,
      docType: data.docType,
      docNumber: data.docNumber,
      total,
      dueDate,
      gaps,
    },
    occurredAt: now,
  });
  return { id: receipt.id, gaps: result.gaps, total };
}
