import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type {
  PromoDiscount,
  PromoDiscountData,
} from "@/domain/entities/promo-discount";
import type { PromoDiscountRepository } from "@/domain/repositories/promo-discount-repository";
import { db } from "@/infrastructure/db/client";
import { promoDiscounts, users } from "@/infrastructure/db/schema";

type PromoRow = typeof promoDiscounts.$inferSelect;

function toPromo(row: PromoRow, createdByName: string | null = null): PromoDiscount {
  return {
    id: row.id,
    name: row.name,
    percent: row.percent,
    isActive: row.isActive,
    createdById: row.createdBy,
    createdByName,
    createdAt: row.createdAt,
  };
}

export class DrizzlePromoDiscountRepository implements PromoDiscountRepository {
  async listAll() {
    const rows = await db
      .select({ promo: promoDiscounts, createdByName: users.name })
      .from(promoDiscounts)
      .leftJoin(users, eq(promoDiscounts.createdBy, users.id))
      .orderBy(desc(promoDiscounts.isActive), asc(promoDiscounts.percent), asc(promoDiscounts.name));
    return rows.map((row) => toPromo(row.promo, row.createdByName));
  }

  async listActive() {
    const rows = await db
      .select()
      .from(promoDiscounts)
      .where(eq(promoDiscounts.isActive, true))
      .orderBy(asc(promoDiscounts.percent), asc(promoDiscounts.name));
    return rows.map((row) => toPromo(row));
  }

  async findById(id: number) {
    const [row] = await db
      .select()
      .from(promoDiscounts)
      .where(eq(promoDiscounts.id, id))
      .limit(1);
    return row ? toPromo(row) : null;
  }

  async existsByName(name: string, excludeId?: number) {
    // Mirrors the lower(name) unique index.
    const sameName = sql`lower(${promoDiscounts.name}) = lower(${name})`;
    const [row] = await db
      .select({ id: promoDiscounts.id })
      .from(promoDiscounts)
      .where(excludeId ? and(sameName, ne(promoDiscounts.id, excludeId)) : sameName)
      .limit(1);
    return row !== undefined;
  }

  async create(data: PromoDiscountData, actorId: number) {
    const [row] = await db
      .insert(promoDiscounts)
      .values({ name: data.name, percent: data.percent, createdBy: actorId })
      .returning();
    return toPromo(row);
  }

  async rename(id: number, name: string) {
    await db
      .update(promoDiscounts)
      .set({ name, updatedAt: new Date() })
      .where(eq(promoDiscounts.id, id));
  }

  async setActive(id: number, isActive: boolean) {
    await db
      .update(promoDiscounts)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(promoDiscounts.id, id));
  }
}
