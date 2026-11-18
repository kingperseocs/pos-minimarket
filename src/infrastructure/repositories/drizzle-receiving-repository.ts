import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  GoodsReceipt,
  NewGoodsReceipt,
  NewReception,
  ReceiptInvoice,
  NewStockTransfer,
  ReceiptDiscrepancy,
  ReceiptDocType,
  StockTransfer,
} from "@/domain/entities/receiving";
import { ValidationError } from "@/domain/errors";
import {
  checkTransfer,
  costAfterInvoice,
  type DiscrepancyResolution,
  invoiceGap,
  round4,
  weightedAverageCost,
} from "@/domain/services/receiving";
import type {
  ReceiptPaymentUpdate,
  ReceivingRepository,
} from "@/domain/repositories/receiving-repository";
import { db } from "@/infrastructure/db/client";
import {
  goodsReceiptItems,
  goodsReceipts,
  locations,
  productPresentations,
  products,
  receiptDiscrepancies,
  stockLevels,
  stockMovements,
  stockTransferItems,
  stockTransfers,
  suppliers,
  users,
  categories,
} from "@/infrastructure/db/schema";
import {
  addToLot,
  consumeLots,
  findLocationId,
  recordMovement,
  type Tx,
} from "./stock-ledger";

async function requireLocation(tx: Tx, kind: "warehouse" | "store") {
  const id = await findLocationId(tx, kind);
  if (!id) {
    throw new ValidationError(
      kind === "warehouse" ? "No hay un Almacén configurado" : "No hay una Tienda configurada",
    );
  }
  return id;
}

// Units of the product across every location, before this receipt.
async function unitsOnHand(tx: Tx, productId: number) {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${stockLevels.quantity}), 0)`.mapWith(Number) })
    .from(stockLevels)
    .where(eq(stockLevels.productId, productId));
  return row?.total ?? 0;
}

export class DrizzleReceivingRepository implements ReceivingRepository {
  async createReceipt(data: NewGoodsReceipt) {
    return db.transaction(async (tx) => {
      const warehouseId = await requireLocation(tx, "warehouse");
      const now = new Date();

      const [receipt] = await tx
        .insert(goodsReceipts)
        .values({
          supplierId: data.supplierId,
          locationId: warehouseId,
          docType: data.docType,
          docNumber: data.docNumber,
          total: data.total.toFixed(2),
          note: data.note,
          createdBy: data.actorId,
          receivedAt: now,
          dueDate: data.dueDate,
          invoicedAt: now,
          invoicedBy: data.actorId,
        })
        .returning({ id: goodsReceipts.id, uuid: goodsReceipts.uuid });

      const items = await tx
        .insert(goodsReceiptItems)
        .values(
        data.lines.map((line) => ({
          receiptId: receipt.id,
          productId: line.productId,
          presentationId: line.presentationId,
          quantity: line.quantity,
          units: line.units,
          receivedUnits: line.receivedUnits,
          lineTotal: line.lineTotal.toFixed(2),
          listTotal: line.listTotal === null ? null : line.listTotal.toFixed(2),
          discountPercent: line.discountPercent.toFixed(2),
          unitCost: line.unitCost.toFixed(4),
          isBonus: line.isBonus,
          expiresAt: line.expiresAt,
          captureSource: line.captureSource,
        })),
        )
        .returning({ id: goodsReceiptItems.id });

      // What didn't match the invoice waits for the admin to resolve it.
      const gaps = data.lines.flatMap((line, index) => {
        const units = line.receivedUnits - line.units;
        if (units === 0) return [];
        return [
          {
            receiptId: receipt.id,
            receiptItemId: items[index].id,
            productId: line.productId,
            units,
            amount: (Math.abs(units) * line.unitCost).toFixed(2),
          },
        ];
      });
      if (gaps.length > 0) await tx.insert(receiptDiscrepancies).values(gaps);

      // One Kardex movement per product (its lines may differ in date,
      // presentation or bonus), then its lots and its new average cost.
      const productIds = [...new Set(data.lines.map((line) => line.productId))];
      for (const productId of productIds) {
        const lines = data.lines.filter((line) => line.productId === productId);
        // Stock and average cost follow what arrived; missing units are a
        // claim to the supplier (receipt_discrepancies), not stock.
        const units = lines.reduce((sum, line) => sum + line.receivedUnits, 0);
        const cost = lines.reduce(
          (sum, line) => sum + line.unitCost * line.receivedUnits,
          0,
        );
        if (units === 0) continue;

        const [product] = await tx
          .select({ priceCost: products.priceCost })
          .from(products)
          .where(eq(products.id, productId))
          .for("update");
        const newCost = weightedAverageCost({
          currentUnits: await unitsOnHand(tx, productId),
          currentCost: product.priceCost === null ? null : Number(product.priceCost),
          inUnits: units,
          inTotal: cost,
        });

        await recordMovement(tx, {
          productId,
          locationId: warehouseId,
          qtyDelta: units,
          type: "purchase_receipt",
          refId: receipt.uuid,
          unitCost: round4(cost / units).toFixed(4),
          note: data.docNumber,
          actorId: data.actorId,
          occurredAt: now,
        });

        for (const line of lines) {
          if (line.expiresAt && line.receivedUnits > 0) {
            await addToLot(tx, productId, warehouseId, line.expiresAt, line.receivedUnits);
          }
        }

        await tx
          .update(products)
          .set({
            priceCost: newCost === null ? null : newCost.toFixed(4),
            trackStock: true,
            updatedAt: now,
          })
          .where(eq(products.id, productId));
      }


      return { id: receipt.id };
    });
  }

  async createReception(data: NewReception) {
    return db.transaction(async (tx) => {
      const warehouseId = await requireLocation(tx, "warehouse");
      const now = new Date();

      const [receipt] = await tx
        .insert(goodsReceipts)
        .values({
          supplierId: data.supplierId,
          locationId: warehouseId,
          total: null,
          note: data.note,
          createdBy: data.actorId,
          receivedAt: now,
          invoiceStatus: "pending",
          invoicePhotoUrl: data.invoicePhotoUrl,
        })
        .returning({ id: goodsReceipts.id, uuid: goodsReceipts.uuid });

      // Until the invoice says otherwise, what was counted is what is billed.
      await tx.insert(goodsReceiptItems).values(
        data.lines.map((line) => ({
          receiptId: receipt.id,
          productId: line.productId,
          presentationId: line.presentationId,
          quantity: line.quantity,
          units: line.receivedUnits,
          receivedUnits: line.receivedUnits,
          lineTotal: null,
          unitCost: null,
          expiresAt: line.expiresAt,
          captureSource: line.captureSource,
        })),
      );

      // Stock and lots now, so the store can sell it; the cost waits.
      const productIds = [...new Set(data.lines.map((line) => line.productId))];
      for (const productId of productIds) {
        const lines = data.lines.filter((line) => line.productId === productId);
        const units = lines.reduce((sum, line) => sum + line.receivedUnits, 0);
        if (units === 0) continue;
        await recordMovement(tx, {
          productId,
          locationId: warehouseId,
          qtyDelta: units,
          type: "purchase_receipt",
          refId: receipt.uuid,
          unitCost: null,
          note: "Recepción sin factura",
          actorId: data.actorId,
          occurredAt: now,
        });
        for (const line of lines) {
          if (line.expiresAt && line.receivedUnits > 0) {
            await addToLot(tx, productId, warehouseId, line.expiresAt, line.receivedUnits);
          }
        }
        await tx
          .update(products)
          .set({ trackStock: true, updatedAt: now })
          .where(eq(products.id, productId));
      }

      return { id: receipt.id };
    });
  }

  async findReceiptForInvoice(id: number) {
    const [row] = await db
      .select({
        receipt: goodsReceipts,
        supplierName: sql<string | null>`coalesce(${suppliers.tradeName}, ${suppliers.businessName})`,
        createdByName: users.name,
      })
      .from(goodsReceipts)
      .leftJoin(suppliers, eq(suppliers.id, goodsReceipts.supplierId))
      .leftJoin(users, eq(users.id, goodsReceipts.createdBy))
      .where(eq(goodsReceipts.id, id))
      .limit(1);
    if (!row) return null;

    const lines = await db
      .select({
        itemId: goodsReceiptItems.id,
        productId: goodsReceiptItems.productId,
        productName: products.name,
        presentationId: goodsReceiptItems.presentationId,
        presentationName: productPresentations.name,
        supplierCode: productPresentations.supplierCode,
        unitsTotal: productPresentations.unitsTotal,
        quantity: goodsReceiptItems.quantity,
        receivedUnits: goodsReceiptItems.receivedUnits,
        expiresAt: goodsReceiptItems.expiresAt,
        priceSale: products.priceSale,
      })
      .from(goodsReceiptItems)
      .innerJoin(products, eq(products.id, goodsReceiptItems.productId))
      .leftJoin(
        productPresentations,
        eq(productPresentations.id, goodsReceiptItems.presentationId),
      )
      .where(eq(goodsReceiptItems.receiptId, id))
      .orderBy(goodsReceiptItems.id);

    const { receipt } = row;
    return {
      id: receipt.id,
      supplierId: receipt.supplierId,
      supplierName: row.supplierName,
      receivedAt: receipt.receivedAt,
      createdByName: row.createdByName,
      note: receipt.note,
      invoiceStatus: receipt.invoiceStatus,
      invoicePhotoUrl: receipt.invoicePhotoUrl,
      lines: lines.map(({ unitsTotal, priceSale, ...line }) => ({
        ...line,
        unitsPerPresentation: unitsTotal ?? 1,
        priceSale: Number(priceSale),
      })),
    };
  }

  async applyInvoice(data: ReceiptInvoice) {
    return db.transaction(async (tx) => {
      const [receipt] = await tx
        .select({
          uuid: goodsReceipts.uuid,
          invoiceStatus: goodsReceipts.invoiceStatus,
        })
        .from(goodsReceipts)
        .where(eq(goodsReceipts.id, data.receiptId))
        .for("update");
      if (!receipt) throw new ValidationError("El ingreso no existe");
      if (receipt.invoiceStatus === "registered") {
        throw new ValidationError(`La factura del ingreso #${data.receiptId} ya fue registrada`);
      }

      // The received lines get what the invoice says; lines invoiced that
      // never arrived are added with nothing received.
      const itemIds: number[] = [];
      for (const line of data.lines) {
        const values = {
          quantity: line.quantity,
          units: line.units,
          lineTotal: line.lineTotal.toFixed(2),
          listTotal: line.listTotal === null ? null : line.listTotal.toFixed(2),
          discountPercent: line.discountPercent.toFixed(2),
          unitCost: line.unitCost.toFixed(4),
          isBonus: line.isBonus,
        };
        if (line.itemId !== null) {
          await tx
            .update(goodsReceiptItems)
            .set(values)
            .where(
              and(
                eq(goodsReceiptItems.id, line.itemId),
                eq(goodsReceiptItems.receiptId, data.receiptId),
              ),
            );
          itemIds.push(line.itemId);
        } else {
          const [item] = await tx
            .insert(goodsReceiptItems)
            .values({
              ...values,
              receiptId: data.receiptId,
              productId: line.productId,
              presentationId: line.presentationId,
              receivedUnits: 0,
            })
            .returning({ id: goodsReceiptItems.id });
          itemIds.push(item.id);
        }
      }

      const gaps = data.lines.flatMap((line, index) => {
        const gap = invoiceGap(line);
        return gap
          ? [
              {
                receiptId: data.receiptId,
                receiptItemId: itemIds[index],
                productId: line.productId,
                units: gap.units,
                amount: gap.amount.toFixed(2),
              },
            ]
          : [];
      });
      if (gaps.length > 0) await tx.insert(receiptDiscrepancies).values(gaps);

      // The cost of what arrived: on its Kardex movement and in the
      // product's weighted average.
      const productIds = [...new Set(data.lines.map((line) => line.productId))];
      for (const productId of productIds) {
        const lines = data.lines.filter((line) => line.productId === productId);
        const units = lines.reduce((sum, line) => sum + line.receivedUnits, 0);
        if (units === 0) continue;
        const cost = lines.reduce((sum, line) => sum + line.unitCost * line.receivedUnits, 0);

        const [product] = await tx
          .select({ priceCost: products.priceCost })
          .from(products)
          .where(eq(products.id, productId))
          .for("update");
        const newCost = costAfterInvoice({
          currentCost: product.priceCost === null ? null : Number(product.priceCost),
          onHand: await unitsOnHand(tx, productId),
          receivedUnits: units,
          receivedTotal: cost,
        });

        await tx
          .update(stockMovements)
          .set({ unitCost: round4(cost / units).toFixed(4), note: data.docNumber })
          .where(
            and(
              eq(stockMovements.type, "purchase_receipt"),
              eq(stockMovements.refId, receipt.uuid),
              eq(stockMovements.productId, productId),
            ),
          );
        await tx
          .update(products)
          .set({
            priceCost: newCost === null ? null : newCost.toFixed(4),
            updatedAt: data.at,
          })
          .where(eq(products.id, productId));
      }

      await tx
        .update(goodsReceipts)
        .set({
          docType: data.docType,
          docNumber: data.docNumber,
          total: data.total.toFixed(2),
          dueDate: data.dueDate,
          invoiceStatus: "registered",
          invoicedAt: data.at,
          invoicedBy: data.actorId,
        })
        .where(eq(goodsReceipts.id, data.receiptId));

      return { gaps: gaps.length };
    });
  }

  async productIdsBySupplier() {
    const rows = await db
      .selectDistinct({
        supplierId: goodsReceipts.supplierId,
        productId: goodsReceiptItems.productId,
      })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceipts.id, goodsReceiptItems.receiptId));
    const bySupplier: Record<number, number[]> = {};
    for (const row of rows) {
      if (row.supplierId === null) continue;
      (bySupplier[row.supplierId] ??= []).push(row.productId);
    }
    return bySupplier;
  }

  async countPendingInvoices() {
    const [row] = await db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(goodsReceipts)
      .where(eq(goodsReceipts.invoiceStatus, "pending"));
    return row?.total ?? 0;
  }

  async documentExists(
    supplierId: number | null,
    docType: ReceiptDocType,
    docNumber: string,
  ) {
    const [row] = await db
      .select({ id: goodsReceipts.id })
      .from(goodsReceipts)
      .where(
        and(
          supplierId === null
            ? isNull(goodsReceipts.supplierId)
            : eq(goodsReceipts.supplierId, supplierId),
          eq(goodsReceipts.docType, docType),
          eq(goodsReceipts.docNumber, docNumber),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async findReceiptPayment(id: number) {
    const [row] = await db
      .select({
        id: goodsReceipts.id,
        total: goodsReceipts.total,
        docNumber: goodsReceipts.docNumber,
        invoiceStatus: goodsReceipts.invoiceStatus,
        paymentStatus: goodsReceipts.paymentStatus,
        paidMethod: goodsReceipts.paidMethod,
      })
      .from(goodsReceipts)
      .where(eq(goodsReceipts.id, id))
      .limit(1);
    return row ? { ...row, total: row.total === null ? null : Number(row.total) } : null;
  }

  async setReceiptPayment(data: ReceiptPaymentUpdate) {
    await db
      .update(goodsReceipts)
      .set(
        data.paid
          ? {
              paymentStatus: "paid",
              paidAt: data.at,
              paidMethod: data.method,
              paidBy: data.actorId,
              paymentNote: data.note,
            }
          : {
              paymentStatus: "pending",
              paidAt: null,
              paidMethod: null,
              paidBy: null,
              paymentNote: null,
            },
      )
      .where(eq(goodsReceipts.id, data.id));
  }

  async listReceipts(limit: number): Promise<GoodsReceipt[]> {
    const paidBy = alias(users, "paid_by");
    const rows = await db
      .select({
        receipt: goodsReceipts,
        supplierName: sql<string | null>`coalesce(${suppliers.tradeName}, ${suppliers.businessName})`,
        createdByName: users.name,
        paidByName: paidBy.name,
      })
      .from(goodsReceipts)
      .leftJoin(suppliers, eq(suppliers.id, goodsReceipts.supplierId))
      .leftJoin(users, eq(users.id, goodsReceipts.createdBy))
      .leftJoin(paidBy, eq(paidBy.id, goodsReceipts.paidBy))
      .orderBy(desc(goodsReceipts.receivedAt))
      .limit(limit);
    if (rows.length === 0) return [];

    const items = await db
      .select({
        receiptId: goodsReceiptItems.receiptId,
        productName: products.name,
        presentationName: productPresentations.name,
        quantity: goodsReceiptItems.quantity,
        units: goodsReceiptItems.units,
        receivedUnits: goodsReceiptItems.receivedUnits,
        lineTotal: goodsReceiptItems.lineTotal,
        listTotal: goodsReceiptItems.listTotal,
        discountPercent: goodsReceiptItems.discountPercent,
        isBonus: goodsReceiptItems.isBonus,
        expiresAt: goodsReceiptItems.expiresAt,
      })
      .from(goodsReceiptItems)
      .innerJoin(products, eq(products.id, goodsReceiptItems.productId))
      .leftJoin(
        productPresentations,
        eq(productPresentations.id, goodsReceiptItems.presentationId),
      )
      .where(
        inArray(
          goodsReceiptItems.receiptId,
          rows.map((row) => row.receipt.id),
        ),
      )
      .orderBy(goodsReceiptItems.id);

    return rows.map(({ receipt, supplierName, createdByName, paidByName }) => ({
      id: receipt.id,
      receivedAt: receipt.receivedAt,
      supplierName,
      docType: receipt.docType,
      docNumber: receipt.docNumber,
      total: receipt.total === null ? null : Number(receipt.total),
      note: receipt.note,
      createdByName,
      invoiceStatus: receipt.invoiceStatus,
      invoicePhotoUrl: receipt.invoicePhotoUrl,
      paymentStatus: receipt.paymentStatus,
      dueDate: receipt.dueDate,
      paidAt: receipt.paidAt,
      paidMethod: receipt.paidMethod,
      paidByName,
      paymentNote: receipt.paymentNote,
      lines: items
        .filter((item) => item.receiptId === receipt.id)
        .map(({ receiptId, lineTotal, listTotal, discountPercent, ...item }) => {
          void receiptId;
          return {
            ...item,
            lineTotal: lineTotal === null ? null : Number(lineTotal),
            listTotal: listTotal === null ? null : Number(listTotal),
            discountPercent: Number(discountPercent),
          };
        }),
    }));
  }

  async createTransfer(data: NewStockTransfer) {
    return db.transaction(async (tx) => {
      const fromId = await requireLocation(tx, "warehouse");
      const toId = await requireLocation(tx, "store");
      const now = new Date();

      const [transfer] = await tx
        .insert(stockTransfers)
        .values({
          fromLocationId: fromId,
          toLocationId: toId,
          note: data.note,
          createdBy: data.actorId,
          createdAt: now,
        })
        .returning({ id: stockTransfers.id, uuid: stockTransfers.uuid });

      for (const line of data.lines) {
        // Locked: two transfers at once can't both take the last units.
        const [level] = await tx
          .select({ quantity: stockLevels.quantity })
          .from(stockLevels)
          .where(
            and(
              eq(stockLevels.productId, line.productId),
              eq(stockLevels.locationId, fromId),
            ),
          )
          .for("update");
        checkTransfer(level?.quantity ?? 0, line.units);

        const movement = {
          productId: line.productId,
          refId: transfer.uuid,
          actorId: data.actorId,
          occurredAt: now,
        };
        await recordMovement(tx, {
          ...movement,
          locationId: fromId,
          qtyDelta: -line.units,
          type: "transfer_out",
        });
        await recordMovement(tx, {
          ...movement,
          locationId: toId,
          qtyDelta: line.units,
          type: "transfer_in",
        });

        // Dated lots travel with the units, soonest expiry first.
        const taken = await consumeLots(tx, line.productId, fromId, line.units);
        for (const lot of taken) {
          await addToLot(tx, line.productId, toId, lot.expiresAt, lot.quantity);
        }

        await tx.insert(stockTransferItems).values({
          transferId: transfer.id,
          productId: line.productId,
          units: line.units,
          captureSource: line.captureSource,
        });
      }

      return { id: transfer.id };
    });
  }

  async listTransfers(limit: number): Promise<StockTransfer[]> {
    const fromLocation = alias(locations, "from_location");
    const toLocation = alias(locations, "to_location");
    const rows = await db
      .select({
        transfer: stockTransfers,
        fromName: fromLocation.name,
        toName: toLocation.name,
        createdByName: users.name,
      })
      .from(stockTransfers)
      .innerJoin(fromLocation, eq(fromLocation.id, stockTransfers.fromLocationId))
      .innerJoin(toLocation, eq(toLocation.id, stockTransfers.toLocationId))
      .leftJoin(users, eq(users.id, stockTransfers.createdBy))
      .orderBy(desc(stockTransfers.createdAt))
      .limit(limit);
    if (rows.length === 0) return [];

    const items = await db
      .select({
        transferId: stockTransferItems.transferId,
        productName: products.name,
        units: stockTransferItems.units,
      })
      .from(stockTransferItems)
      .innerJoin(products, eq(products.id, stockTransferItems.productId))
      .where(
        inArray(
          stockTransferItems.transferId,
          rows.map((row) => row.transfer.id),
        ),
      )
      .orderBy(stockTransferItems.id);

    return rows.map(({ transfer, fromName, toName, createdByName }) => ({
      id: transfer.id,
      createdAt: transfer.createdAt,
      fromName,
      toName,
      note: transfer.note,
      createdByName,
      lines: items
        .filter((item) => item.transferId === transfer.id)
        .map(({ productName, units }) => ({ productName, units })),
    }));
  }

  async listDiscrepancies(limit: number) {
    const rows = await selectDiscrepancies()
      .orderBy(
        // Open first, then the latest.
        sql`${receiptDiscrepancies.status} = 'open' desc`,
        desc(receiptDiscrepancies.createdAt),
      )
      .limit(limit);
    return rows.map(toDiscrepancy);
  }

  async findDiscrepancy(id: number) {
    const [row] = await selectDiscrepancies()
      .where(eq(receiptDiscrepancies.id, id))
      .limit(1);
    return row ? toDiscrepancy(row) : null;
  }

  async resolveDiscrepancy(data: {
    id: number;
    status: DiscrepancyResolution;
    note: string | null;
    expiresAt: string | null;
    actorId: number;
  }) {
    await db.transaction(async (tx) => {
      const [gap] = await tx
        .select()
        .from(receiptDiscrepancies)
        .where(eq(receiptDiscrepancies.id, data.id))
        .for("update");
      // Resolved meanwhile by someone else: nothing to do twice.
      if (!gap || gap.status !== "open") {
        throw new ValidationError("Esta diferencia ya fue resuelta");
      }
      const warehouseId = await requireLocation(tx, "warehouse");
      const now = new Date();
      const [item] = await tx
        .select({ unitCost: goodsReceiptItems.unitCost })
        .from(goodsReceiptItems)
        .where(eq(goodsReceiptItems.id, gap.receiptItemId));

      if (data.status === "replenished") {
        // The missing units finally arrived at the Almacén.
        const units = -gap.units;
        await recordMovement(tx, {
          productId: gap.productId,
          locationId: warehouseId,
          qtyDelta: units,
          type: "purchase_receipt",
          refId: gap.uuid,
          unitCost: item?.unitCost ?? null,
          note: "Repuesto por el proveedor",
          actorId: data.actorId,
          occurredAt: now,
        });
        if (data.expiresAt) {
          await addToLot(tx, gap.productId, warehouseId, data.expiresAt, units);
        }
      } else if (data.status === "returned") {
        // The extra units went back to the supplier.
        await recordMovement(tx, {
          productId: gap.productId,
          locationId: warehouseId,
          qtyDelta: -gap.units,
          type: "supplier_return",
          refId: gap.uuid,
          unitCost: item?.unitCost ?? null,
          note: "Devuelto al proveedor",
          actorId: data.actorId,
          occurredAt: now,
        });
        await consumeLots(tx, gap.productId, warehouseId, gap.units);
      }

      await tx
        .update(receiptDiscrepancies)
        .set({
          status: data.status,
          resolutionNote: data.note,
          resolvedBy: data.actorId,
          resolvedAt: now,
        })
        .where(eq(receiptDiscrepancies.id, data.id));
    });
  }
}

function selectDiscrepancies() {
  return db
    .select({
      gap: receiptDiscrepancies,
      receivedAt: goodsReceipts.receivedAt,
      docNumber: goodsReceipts.docNumber,
      supplierName: sql<string | null>`coalesce(${suppliers.tradeName}, ${suppliers.businessName})`,
      productName: products.name,
      tracksExpiry: sql<boolean>`coalesce(${products.tracksExpiry}, ${categories.tracksExpiry})`,
      invoiceUnits: goodsReceiptItems.units,
      receivedUnits: goodsReceiptItems.receivedUnits,
      resolvedByName: users.name,
    })
    .from(receiptDiscrepancies)
    .innerJoin(goodsReceipts, eq(goodsReceipts.id, receiptDiscrepancies.receiptId))
    .innerJoin(
      goodsReceiptItems,
      eq(goodsReceiptItems.id, receiptDiscrepancies.receiptItemId),
    )
    .innerJoin(products, eq(products.id, receiptDiscrepancies.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(suppliers, eq(suppliers.id, goodsReceipts.supplierId))
    .leftJoin(users, eq(users.id, receiptDiscrepancies.resolvedBy));
}

function toDiscrepancy(
  row: Awaited<ReturnType<typeof selectDiscrepancies>>[number],
): ReceiptDiscrepancy {
  return {
    id: row.gap.id,
    receiptId: row.gap.receiptId,
    receivedAt: row.receivedAt,
    supplierName: row.supplierName,
    docNumber: row.docNumber,
    productId: row.gap.productId,
    productName: row.productName,
    tracksExpiry: row.tracksExpiry,
    invoiceUnits: row.invoiceUnits,
    receivedUnits: row.receivedUnits,
    units: row.gap.units,
    amount: Number(row.gap.amount),
    status: row.gap.status,
    resolutionNote: row.gap.resolutionNote,
    resolvedByName: row.resolvedByName,
    resolvedAt: row.gap.resolvedAt,
  };
}
