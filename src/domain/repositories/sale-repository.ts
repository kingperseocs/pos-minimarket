import type { Sale, SaleRecord } from "../entities/sale";
import type { NewSaleDocument } from "../entities/sale-document";

export interface SaleRepository {
  // Idempotent: retrying with the same SaleRecord.uuid must not create a
  // duplicate sale, duplicate line items, award loyalty points twice or
  // take tracked products off the shop floor twice (see the Drizzle
  // implementation). `inserted` is false on a retry. The sale's electronic
  // document (the invoicing outbox row) is inserted in the same transaction.
  insertWithItems(
    record: SaleRecord,
    document?: NewSaleDocument,
  ): Promise<{ id: number; uuid: string; total: number; inserted: boolean }>;
  existsByUuid(uuid: string): Promise<boolean>;
  findByDateRange(from: Date, to: Date): Promise<Sale[]>;
  findById(id: number): Promise<Sale | null>;
}
