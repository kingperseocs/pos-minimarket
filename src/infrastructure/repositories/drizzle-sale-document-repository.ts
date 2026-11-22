import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import type {
  CustomerDocType,
  IgvAffectation,
  ReviewReason,
  SaleDocument,
  SaleDocumentFilters,
  SaleDocumentListItem,
} from "@/domain/entities/sale-document";
import type { MotorDocument } from "@/domain/repositories/e-invoicing-gateway";
import type {
  IssueContext,
  RequeuePatch,
  SaleDocumentRepository,
} from "@/domain/repositories/sale-document-repository";
import { db } from "@/infrastructure/db/client";
import {
  eInvoicingSettings,
  products,
  saleDocumentNotes,
  saleDocuments,
  saleItems,
  sales,
  users,
} from "@/infrastructure/db/schema";

// A refused document is not retried on its own: its next turn never comes.
const NEVER = new Date("9999-12-31T00:00:00.000Z");

type Row = typeof saleDocuments.$inferSelect;

export function toSaleDocument(row: Row): SaleDocument {
  return {
    id: row.id,
    saleId: row.saleId,
    saleUuid: row.saleUuid,
    docType: row.docType,
    series: row.series,
    customerDocType: row.customerDocType as CustomerDocType,
    customerDocNumber: row.customerDocNumber,
    customerName: row.customerName,
    customerAddress: row.customerAddress,
    status: row.status,
    reviewReasons: row.reviewReasons as ReviewReason[],
    motorId: row.motorId,
    number: row.number,
    motorStatus: row.motorStatus,
    sunatCode: row.sunatCode,
    sunatDescription: row.sunatDescription,
    idempotencyKey: row.idempotencyKey,
    attempts: row.attempts,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt,
    issuedAt: row.issuedAt,
    createdAt: row.createdAt,
  };
}

// Whether a credit note cancels the whole sale (01, 02, 06; not rejected).
const cancelledByNote = sql<boolean>`exists (
  select 1 from ${saleDocumentNotes}
  where ${saleDocumentNotes.saleDocumentId} = ${saleDocuments.id}
    and ${saleDocumentNotes.kind} = 'credit_note'
    and ${saleDocumentNotes.reasonCode} in ('01', '02', '06')
    and coalesce(${saleDocumentNotes.motorStatus}, '') <> 'RECHAZADO'
)`;

// Due: queued or failed (or "sending" whose worker died), its turn has come,
// below the attempt limit, and automatic emission is on.
function due(maxAttempts: number) {
  return and(
    or(
      inArray(saleDocuments.status, ["queued", "failed"]),
      and(eq(saleDocuments.status, "sending"), lt(saleDocuments.lockedUntil, sql`now()`)),
    ),
    lte(saleDocuments.nextAttemptAt, sql`now()`),
    lt(saleDocuments.attempts, maxAttempts),
    or(sql`${saleDocuments.lockedUntil} is null`, lt(saleDocuments.lockedUntil, sql`now()`)),
    sql`exists (select 1 from ${eInvoicingSettings} where ${eInvoicingSettings.id} = 1 and ${eInvoicingSettings.autoEmitEnabled})`,
  );
}

export class DrizzleSaleDocumentRepository implements SaleDocumentRepository {
  async claim(saleUuid: string, lockMs: number, maxAttempts: number): Promise<IssueContext | null> {
    // One statement: two tills racing for the same document can't both win.
    const [row] = await db
      .update(saleDocuments)
      .set({
        status: "sending",
        lockedUntil: sql`now() + make_interval(secs => ${lockMs / 1000})`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(saleDocuments.saleUuid, saleUuid), due(maxAttempts)))
      .returning();
    if (!row) return null;

    const lines = await db
      .select({
        productId: saleItems.productId,
        productName: saleItems.productName,
        unitPrice: saleItems.unitPrice,
        quantity: saleItems.quantity,
        lineTotal: saleItems.lineTotal,
        affectation: products.igvAffectation,
      })
      .from(saleItems)
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(eq(saleItems.saleId, row.saleId))
      .orderBy(asc(saleItems.id));

    const [extra] = await db
      .select({ cashierName: users.name, override: eInvoicingSettings.globalIgvOverride })
      .from(sales)
      .innerJoin(users, eq(users.id, sales.cashierId))
      .leftJoin(eInvoicingSettings, eq(eInvoicingSettings.id, 1))
      .where(eq(sales.id, row.saleId));

    return {
      document: toSaleDocument(row),
      items: lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        unitPrice: Number(l.unitPrice),
        quantity: l.quantity,
        lineTotal: Number(l.lineTotal),
      })),
      affectations: new Map(lines.map((l) => [l.productId, l.affectation as IgvAffectation])),
      globalOverride: (extra?.override ?? null) as IgvAffectation | null,
      cashierName: extra?.cashierName ?? null,
    };
  }

  async dueForIssue(limit: number, maxAttempts: number): Promise<string[]> {
    const rows = await db
      .select({ saleUuid: saleDocuments.saleUuid })
      .from(saleDocuments)
      .where(due(maxAttempts))
      .orderBy(asc(saleDocuments.createdAt))
      .limit(limit);
    return rows.map((r) => r.saleUuid);
  }

  async markIssued(id: number, doc: MotorDocument): Promise<void> {
    await db
      .update(saleDocuments)
      .set({
        status: "issued",
        motorId: doc.id,
        number: doc.number,
        motorStatus: doc.status,
        sunatCode: doc.sunatCode,
        sunatDescription: doc.sunatDescription,
        attempts: sql`${saleDocuments.attempts} + 1`,
        lastError: null,
        lockedUntil: null,
        issuedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(saleDocuments.id, id));
  }

  async markRetry(id: number, error: string, nextAttemptAt: Date): Promise<void> {
    await db
      .update(saleDocuments)
      .set({
        status: "failed",
        attempts: sql`${saleDocuments.attempts} + 1`,
        lastError: error.slice(0, 1000),
        nextAttemptAt,
        lockedUntil: null,
        updatedAt: sql`now()`,
      })
      .where(eq(saleDocuments.id, id));
  }

  async markRejected(id: number, error: string): Promise<void> {
    await db
      .update(saleDocuments)
      .set({
        status: "failed",
        attempts: sql`${saleDocuments.attempts} + 1`,
        lastError: error.slice(0, 1000),
        nextAttemptAt: NEVER,
        lockedUntil: null,
        updatedAt: sql`now()`,
      })
      .where(eq(saleDocuments.id, id));
  }

  async list(filters: SaleDocumentFilters): Promise<SaleDocumentListItem[]> {
    const conditions = [gte(sales.clientCreatedAt, filters.from), lte(sales.clientCreatedAt, filters.to)];
    if (filters.cashierId !== undefined) conditions.push(eq(sales.cashierId, filters.cashierId));
    if (filters.status) conditions.push(eq(saleDocuments.status, filters.status));
    if (filters.docType) conditions.push(eq(saleDocuments.docType, filters.docType));
    const rows = await db
      .select({
        doc: saleDocuments,
        total: sales.total,
        soldAt: sales.clientCreatedAt,
        cashierId: sales.cashierId,
        cancelledByNote,
        cashierName: users.name,
      })
      .from(saleDocuments)
      .innerJoin(sales, eq(sales.id, saleDocuments.saleId))
      .leftJoin(users, eq(users.id, sales.cashierId))
      .where(and(...conditions))
      .orderBy(desc(sales.clientCreatedAt));
    return rows.map((r) => ({
      ...toSaleDocument(r.doc),
      saleTotal: Number(r.total),
      cashierId: r.cashierId,
      cancelledByNote: r.cancelledByNote,
      soldAt: r.soldAt,
      cashierName: r.cashierName,
    }));
  }

  async findById(id: number): Promise<SaleDocumentListItem | null> {
    const [row] = await db
      .select({
        doc: saleDocuments,
        total: sales.total,
        soldAt: sales.clientCreatedAt,
        cashierId: sales.cashierId,
        cancelledByNote,
        cashierName: users.name,
      })
      .from(saleDocuments)
      .innerJoin(sales, eq(sales.id, saleDocuments.saleId))
      .leftJoin(users, eq(users.id, sales.cashierId))
      .where(eq(saleDocuments.id, id));
    return row
      ? {
          ...toSaleDocument(row.doc),
          saleTotal: Number(row.total),
          cashierId: row.cashierId,
          cancelledByNote: row.cancelledByNote,
          soldAt: row.soldAt,
          cashierName: row.cashierName,
        }
      : null;
  }

  async updateMotorStatus(id: number, doc: MotorDocument): Promise<void> {
    await db
      .update(saleDocuments)
      .set({
        motorStatus: doc.status,
        sunatCode: doc.sunatCode,
        sunatDescription: doc.sunatDescription,
        // The motor marks it ANULADO once the annulment batch is accepted.
        ...(doc.status === "ANULADO" ? { status: "voided" as const } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(saleDocuments.id, id));
  }

  async requeue(id: number, patch: RequeuePatch): Promise<void> {
    await db
      .update(saleDocuments)
      .set({
        status: "queued",
        nextAttemptAt: sql`now()`,
        attempts: 0,
        lastError: null,
        lockedUntil: null,
        ...(patch.customer ?? {}),
        ...(patch.clearReview ? { reviewReasons: [] } : {}),
        ...(patch.idempotencyKey ? { idempotencyKey: patch.idempotencyKey } : {}),
        ...(patch.resetMotor
          ? { motorId: null, number: null, motorStatus: null, sunatCode: null, sunatDescription: null, issuedAt: null }
          : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(saleDocuments.id, id));
  }

  async findBySaleUuid(saleUuid: string): Promise<SaleDocument | null> {
    const [row] = await db.select().from(saleDocuments).where(eq(saleDocuments.saleUuid, saleUuid));
    return row ? toSaleDocument(row) : null;
  }
}
