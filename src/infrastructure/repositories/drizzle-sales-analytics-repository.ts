import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import type { PaymentType } from "@/domain/entities/sale";
import type { SalesTotals } from "@/domain/entities/sales-analytics";
import type { SalesAnalyticsRepository } from "@/domain/repositories/sales-analytics-repository";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { db } from "@/infrastructure/db/client";
import { categories, products, saleItems, sales } from "@/infrastructure/db/schema";

function inRange(from: Date, to: Date) {
  return and(
    ne(sales.status, "voided"),
    gte(sales.clientCreatedAt, from),
    lte(sales.clientCreatedAt, to),
  );
}

// The sale time on the store's clock, for grouping by day and hour.
const localTime = sql`(${sales.clientCreatedAt} at time zone ${sql.raw(`'${STORE_TIME_ZONE}'`)})`;

// What the customer paid for a line: given-away lines (birthday gift, old
// courtesies) bring in nothing.
const lineNet = sql`case when ${saleItems.isGift} then 0 else ${saleItems.lineTotal} - ${saleItems.discountAmount} end`;

export class DrizzleSalesAnalyticsRepository implements SalesAnalyticsRepository {
  async totals(from: Date, to: Date): Promise<SalesTotals> {
    const [saleRow] = await db
      .select({
        revenue: sql<string>`coalesce(sum(${sales.total}), 0)`,
        orders: sql<number>`count(*)`.mapWith(Number),
        workerDiscount: sql<string>`coalesce(sum(${sales.discountTotal}), 0)`,
        birthdayGifts: sql<string>`coalesce(sum(${sales.giftTotal}), 0)`,
        workerRevenue: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.workerId} is not null), 0)`,
      })
      .from(sales)
      .where(inRange(from, to));

    // Profit only over lines whose cost was known when sold.
    const [itemRow] = await db
      .select({
        units: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`.mapWith(Number),
        costedUnits: sql<number>`coalesce(sum(${saleItems.quantity}) filter (where ${saleItems.unitCost} is not null), 0)`.mapWith(
          Number,
        ),
        profit: sql<string | null>`sum(${lineNet} - ${saleItems.unitCost} * ${saleItems.quantity}) filter (where ${saleItems.unitCost} is not null)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(inRange(from, to));

    const units = itemRow?.units ?? 0;
    return {
      revenue: Number(saleRow?.revenue ?? 0),
      orders: saleRow?.orders ?? 0,
      units,
      workerDiscount: Number(saleRow?.workerDiscount ?? 0),
      birthdayGifts: Number(saleRow?.birthdayGifts ?? 0),
      workerRevenue: Number(saleRow?.workerRevenue ?? 0),
      profit: itemRow?.profit == null ? null : Number(itemRow.profit),
      costCoverage: units > 0 ? (itemRow?.costedUnits ?? 0) / units : 0,
    };
  }

  async daily(from: Date, to: Date) {
    const day = sql<string>`to_char(${localTime}, 'YYYY-MM-DD')`;
    const rows = await db
      .select({
        dateKey: day,
        revenue: sql<string>`sum(${sales.total})`,
        orders: sql<number>`count(*)`.mapWith(Number),
      })
      .from(sales)
      .where(inRange(from, to))
      .groupBy(day)
      .orderBy(day);
    return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
  }

  async hourly(from: Date, to: Date) {
    const hour = sql<number>`extract(hour from ${localTime})::int`;
    const rows = await db
      .select({
        hour: hour.mapWith(Number),
        revenue: sql<string>`sum(${sales.total})`,
        orders: sql<number>`count(*)`.mapWith(Number),
      })
      .from(sales)
      .where(inRange(from, to))
      .groupBy(hour)
      .orderBy(hour);
    return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
  }

  async topProducts(from: Date, to: Date, limit: number) {
    const revenue = sql<string>`sum(${lineNet})`;
    const rows = await db
      .select({
        productId: saleItems.productId,
        // Today's name; the sale keeps its own snapshot for the receipt.
        name: sql<string>`max(${products.name})`,
        units: sql<number>`sum(${saleItems.quantity})`.mapWith(Number),
        revenue,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(inRange(from, to))
      .groupBy(saleItems.productId)
      .orderBy(desc(revenue))
      .limit(limit);
    return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
  }

  async byCategory(from: Date, to: Date) {
    const revenue = sql<string>`sum(${lineNet})`;
    const rows = await db
      .select({
        categoryId: categories.id,
        name: categories.name,
        revenue,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(inRange(from, to))
      .groupBy(categories.id, categories.name)
      .orderBy(desc(revenue));
    return rows.map((row) => ({ ...row, revenue: Number(row.revenue) }));
  }

  async byPayment(from: Date, to: Date) {
    const revenue = sql<string>`sum(${sales.total})`;
    const rows = await db
      .select({
        paymentType: sales.paymentType,
        revenue,
        orders: sql<number>`count(*)`.mapWith(Number),
      })
      .from(sales)
      .where(inRange(from, to))
      .groupBy(sales.paymentType)
      .orderBy(desc(revenue));
    return rows.map((row) => ({
      paymentType: row.paymentType as PaymentType,
      revenue: Number(row.revenue),
      orders: row.orders,
    }));
  }
}
