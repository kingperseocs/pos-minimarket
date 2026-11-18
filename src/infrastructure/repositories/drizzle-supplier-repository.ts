import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type {
  Supplier,
  SupplierBankAccount,
  SupplierData,
} from "@/domain/entities/supplier";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { db } from "@/infrastructure/db/client";
import {
  categories,
  supplierBankAccounts,
  supplierCategories,
  suppliers,
} from "@/infrastructure/db/schema";
import type { Tx } from "./stock-ledger";

type SupplierRow = typeof suppliers.$inferSelect;

// Attaches each supplier's categories and bank accounts (one extra query
// each, not one per row).
async function withCategories(rows: SupplierRow[]): Promise<Supplier[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const accounts = await db
    .select()
    .from(supplierBankAccounts)
    .where(inArray(supplierBankAccounts.supplierId, ids))
    .orderBy(asc(supplierBankAccounts.sortOrder), asc(supplierBankAccounts.id));
  const links = await db
    .select({
      supplierId: supplierCategories.supplierId,
      id: categories.id,
      name: categories.name,
    })
    .from(supplierCategories)
    .innerJoin(categories, eq(categories.id, supplierCategories.categoryId))
    .where(
      inArray(supplierCategories.supplierId, ids),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return rows.map((row) => ({
    id: row.id,
    ruc: row.ruc,
    businessName: row.businessName,
    tradeName: row.tradeName,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    website: row.website,
    claimsContactName: row.claimsContactName,
    claimsPhone: row.claimsPhone,
    deliveryDays: [...row.deliveryDays].sort((a, b) => a - b),
    deliveryTimeFrom: row.deliveryTimeFrom,
    deliveryTimeTo: row.deliveryTimeTo,
    driverName: row.driverName,
    driverPhone: row.driverPhone,
    acceptsYapePlin: row.acceptsYapePlin,
    yapePlinPhone: row.yapePlinPhone,
    givesCredit: row.givesCredit,
    creditDays: row.creditDays,
    bankAccounts: accounts
      .filter((account) => account.supplierId === row.id)
      .map(({ bank, accountNumber, cci }) => ({ bank, accountNumber, cci })),
    catalogUrl: row.catalogUrl,
    notes: row.notes,
    isActive: row.isActive,
    categories: links
      .filter((link) => link.supplierId === row.id)
      .map(({ id, name }) => ({ id, name })),
  }));
}

function toColumns(data: SupplierData) {
  const { categoryIds, bankAccounts, ...columns } = data;
  void categoryIds;
  void bankAccounts;
  return columns;
}

async function replaceBankAccounts(
  tx: Tx,
  supplierId: number,
  accounts: SupplierBankAccount[],
) {
  await tx
    .delete(supplierBankAccounts)
    .where(eq(supplierBankAccounts.supplierId, supplierId));
  if (accounts.length > 0) {
    await tx.insert(supplierBankAccounts).values(
      accounts.map((account, sortOrder) => ({
        supplierId,
        ...account,
        sortOrder,
      })),
    );
  }
}

async function replaceCategories(
  tx: Tx,
  supplierId: number,
  categoryIds: number[],
) {
  await tx
    .delete(supplierCategories)
    .where(eq(supplierCategories.supplierId, supplierId));
  const unique = [...new Set(categoryIds)];
  if (unique.length > 0) {
    await tx
      .insert(supplierCategories)
      .values(unique.map((categoryId) => ({ supplierId, categoryId })));
  }
}

export class DrizzleSupplierRepository implements SupplierRepository {
  async setCategorySuppliers(categoryId: number, supplierIds: number[]) {
    await db.transaction(async (tx) => {
      await tx
        .delete(supplierCategories)
        .where(eq(supplierCategories.categoryId, categoryId));
      const unique = [...new Set(supplierIds)];
      if (unique.length > 0) {
        await tx
          .insert(supplierCategories)
          .values(unique.map((supplierId) => ({ supplierId, categoryId })));
      }
    });
  }

  async findAll() {
    const rows = await db
      .select()
      .from(suppliers)
      .orderBy(asc(suppliers.businessName));
    return withCategories(rows);
  }

  async findById(id: number) {
    const rows = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);
    return (await withCategories(rows))[0] ?? null;
  }

  async existsByRuc(ruc: string, excludeId?: number) {
    const sameRuc = eq(suppliers.ruc, ruc);
    const [row] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(excludeId ? and(sameRuc, ne(suppliers.id, excludeId)) : sameRuc)
      .limit(1);
    return row !== undefined;
  }

  async findNameByRuc(ruc: string, excludeId?: number) {
    const sameRuc = eq(suppliers.ruc, ruc);
    const [row] = await db
      .select({
        tradeName: suppliers.tradeName,
        businessName: suppliers.businessName,
      })
      .from(suppliers)
      .where(excludeId ? and(sameRuc, ne(suppliers.id, excludeId)) : sameRuc)
      .limit(1);
    return row ? (row.tradeName ?? row.businessName) : null;
  }

  // The supplier, its categories and accounts are saved together or not at all.
  async create(data: SupplierData) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(suppliers)
        .values(toColumns(data))
        .returning({ id: suppliers.id });
      await replaceCategories(tx, row.id, data.categoryIds);
      await replaceBankAccounts(tx, row.id, data.bankAccounts);
    });
  }

  async update(id: number, data: SupplierData) {
    await db.transaction(async (tx) => {
      await tx
        .update(suppliers)
        .set({ ...toColumns(data), updatedAt: new Date() })
        .where(eq(suppliers.id, id));
      await replaceCategories(tx, id, data.categoryIds);
      await replaceBankAccounts(tx, id, data.bankAccounts);
    });
  }

  async setActive(id: number, isActive: boolean) {
    await db
      .update(suppliers)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(suppliers.id, id));
  }
}
