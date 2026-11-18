import type { CaptureSource } from "@/domain/value-objects/capture-source";
import type {
  ReceiptPresentationOption,
  ReceiptProductOption,
  ReceiptSupplierOption,
} from "@/components/admin/inventory/receipt-form";

// One truck being unloaded: kept on the phone until "Terminar recepción".
export type ReceptionLine = {
  key: string;
  productId: number;
  // null = loose units.
  presentationId: number | null;
  counted: number;
  expiresAt: string;
  captureSource: CaptureSource;
};

export type OpenReception = {
  id: string;
  supplierId: number;
  invoicePhotoUrl: string | null;
  note: string;
  lines: ReceptionLine[];
  startedAt: number;
};

export type ReceptionCatalog = {
  products: ReceiptProductOption[];
  presentations: ReceiptPresentationOption[];
  suppliers: ReceiptSupplierOption[];
  supplierProductIds: Record<number, number[]>;
  // To expand a supplier's main categories to their subcategories.
  categories: { id: number; parentId: number | null }[];
};

export function newLineKey() {
  return crypto.randomUUID();
}
