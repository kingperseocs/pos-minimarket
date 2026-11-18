import type { DiscrepancyResolution } from "../services/receiving";
import type {
  GoodsReceipt,
  NewGoodsReceipt,
  NewReception,
  ReceiptForInvoice,
  ReceiptInvoice,
  ReceiptInvoiceStatus,
  ReceiptPaymentStatus,
  SupplierPaymentMethod,
  NewStockTransfer,
  ReceiptDiscrepancy,
  ReceiptDocType,
  StockTransfer,
} from "../entities/receiving";

// Marking a receipt's invoice paid (with how), or back to unpaid.
export type ReceiptPaymentUpdate =
  | {
      id: number;
      paid: true;
      method: SupplierPaymentMethod;
      note: string | null;
      actorId: number;
      at: Date;
    }
  | { id: number; paid: false };

export interface ReceivingRepository {
  // Into the Almacén, in one transaction: the receipt, its Kardex movements,
  // the dated lots and the products' new average cost.
  createReceipt(data: NewGoodsReceipt): Promise<{ id: number }>;
  // Step 1 by the Almacén: what arrived goes into stock (and its lots) now,
  // without cost; the receipt waits for its invoice.
  createReception(data: NewReception): Promise<{ id: number }>;
  findReceiptForInvoice(id: number): Promise<ReceiptForInvoice | null>;
  // Step 2 by the admin, in one transaction: the invoiced lines and their
  // cost (also on the receipt's Kardex movements), the products' new
  // average cost, the gaps against what arrived, the total and due date.
  // ValidationError if the invoice was registered meanwhile.
  applyInvoice(data: ReceiptInvoice): Promise<{ gaps: number }>;
  countPendingInvoices(): Promise<number>;
  // Products ever received from each supplier (to list them first when its
  // truck arrives).
  productIdsBySupplier(): Promise<Record<number, number[]>>;
  documentExists(
    supplierId: number | null,
    docType: ReceiptDocType,
    docNumber: string,
  ): Promise<boolean>;
  listReceipts(limit: number): Promise<GoodsReceipt[]>;
  findReceiptPayment(id: number): Promise<{
    id: number;
    total: number | null;
    docNumber: string | null;
    invoiceStatus: ReceiptInvoiceStatus;
    paymentStatus: ReceiptPaymentStatus;
    paidMethod: SupplierPaymentMethod | null;
  } | null>;
  setReceiptPayment(data: ReceiptPaymentUpdate): Promise<void>;
  // Almacén → Tienda. Locks the Almacén balances and refuses to move more
  // than there is (ValidationError).
  createTransfer(data: NewStockTransfer): Promise<{ id: number }>;
  listTransfers(limit: number): Promise<StockTransfer[]>;
  // Open ones first, then the latest resolved.
  listDiscrepancies(limit: number): Promise<ReceiptDiscrepancy[]>;
  findDiscrepancy(id: number): Promise<ReceiptDiscrepancy | null>;
  // Closes it; "replenished" puts the units into the Almacén and "returned"
  // takes the extra units out, in the same transaction.
  resolveDiscrepancy(data: {
    id: number;
    status: DiscrepancyResolution;
    note: string | null;
    expiresAt: string | null;
    actorId: number;
  }): Promise<void>;
}
