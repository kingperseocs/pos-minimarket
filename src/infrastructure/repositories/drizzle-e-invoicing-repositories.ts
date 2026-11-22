import { asc, eq, sql } from "drizzle-orm";
import type { EInvoicingSettings, IgvAffectation, SaleDocumentNote } from "@/domain/entities/sale-document";
import type { EInvoicingSettingsRepository } from "@/domain/repositories/e-invoicing-settings-repository";
import type {
  NewSaleDocumentNote,
  SaleDocumentNoteRepository,
} from "@/domain/repositories/sale-document-note-repository";
import { db } from "@/infrastructure/db/client";
import { eInvoicingSettings, saleDocumentNotes, users } from "@/infrastructure/db/schema";

export class DrizzleSaleDocumentNoteRepository implements SaleDocumentNoteRepository {
  async create(note: NewSaleDocumentNote): Promise<void> {
    await db.insert(saleDocumentNotes).values(note);
  }

  async updateStatus(id: number, motorStatus: string): Promise<void> {
    await db.update(saleDocumentNotes).set({ motorStatus }).where(eq(saleDocumentNotes.id, id));
  }

  async findById(id: number): Promise<SaleDocumentNote | null> {
    const [row] = await db
      .select({ note: saleDocumentNotes, createdByName: users.name })
      .from(saleDocumentNotes)
      .leftJoin(users, eq(users.id, saleDocumentNotes.createdBy))
      .where(eq(saleDocumentNotes.id, id));
    return row ? { ...row.note, createdByName: row.createdByName } : null;
  }

  async listByDocument(saleDocumentId: number): Promise<SaleDocumentNote[]> {
    const rows = await db
      .select({ note: saleDocumentNotes, createdByName: users.name })
      .from(saleDocumentNotes)
      .leftJoin(users, eq(users.id, saleDocumentNotes.createdBy))
      .where(eq(saleDocumentNotes.saleDocumentId, saleDocumentId))
      .orderBy(asc(saleDocumentNotes.createdAt));
    return rows.map(({ note, createdByName }) => ({ ...note, createdByName }));
  }
}

const DEFAULTS: EInvoicingSettings = {
  boletaSeries: "B001",
  facturaSeries: "F001",
  creditNoteBoletaSeries: "BC01",
  creditNoteFacturaSeries: "FC01",
  debitNoteBoletaSeries: "BD01",
  debitNoteFacturaSeries: "FD01",
  globalIgvOverride: null,
  autoEmitEnabled: true,
};

export class DrizzleEInvoicingSettingsRepository implements EInvoicingSettingsRepository {
  async get(): Promise<EInvoicingSettings> {
    const [row] = await db.select().from(eInvoicingSettings).where(eq(eInvoicingSettings.id, 1));
    if (!row) return DEFAULTS;
    return {
      boletaSeries: row.boletaSeries,
      facturaSeries: row.facturaSeries,
      creditNoteBoletaSeries: row.creditNoteBoletaSeries,
      creditNoteFacturaSeries: row.creditNoteFacturaSeries,
      debitNoteBoletaSeries: row.debitNoteBoletaSeries,
      debitNoteFacturaSeries: row.debitNoteFacturaSeries,
      globalIgvOverride: (row.globalIgvOverride ?? null) as IgvAffectation | null,
      autoEmitEnabled: row.autoEmitEnabled,
    };
  }

  async update(settings: EInvoicingSettings): Promise<void> {
    await db
      .insert(eInvoicingSettings)
      .values({ id: 1, ...settings })
      .onConflictDoUpdate({ target: eInvoicingSettings.id, set: { ...settings, updatedAt: sql`now()` } });
  }
}
