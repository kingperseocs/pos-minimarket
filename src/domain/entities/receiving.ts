import type { CaptureSource } from "../value-objects/capture-source";
import type { DiscrepancyResolution } from "../services/receiving";

export type ReceiptDocType = "factura" | "boleta" | "guia" | "ninguno";

export const RECEIPT_DOC_TYPES: ReceiptDocType[] = [
  "factura",
  "boleta",
  "guia",
  "ninguno",
];

export const RECEIPT_DOC_TYPE_LABELS: Record<ReceiptDocType, string> = {
  factura: "Factura",
  boleta: "Boleta",
  guia: "Guía de remisión",
  ninguno: "Sin documento",
};

// The supplier's invoice of a receipt: reviewed on arrival, paid later.
export type ReceiptPaymentStatus = "pending" | "paid";
export type SupplierPaymentMethod = "cash" | "yape" | "transfer";

export const SUPPLIER_PAYMENT_METHODS: SupplierPaymentMethod[] = [
  "cash",
  "yape",
  "transfer",
];

export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  cash: "Efectivo",
  yape: "Yape/Plin",
  transfer: "Transferencia",
};

// Step 2 of a receipt entered by the Almacén: its invoice, typed by the admin.
export type ReceiptInvoiceStatus = "pending" | "registered";

// A receipt line already converted to units and cost per unit.
export interface PreparedReceiptLine {
  productId: number;
  presentationId: number | null;
  quantity: number;
  // What the invoice says / what actually arrived (both in units).
  units: number;
  receivedUnits: number;
  // Paid for the line, after the supplier's discount.
  lineTotal: number;
  // Invoice amount before the discount, and the discount (null / 0: none).
  listTotal: number | null;
  discountPercent: number;
  unitCost: number;
  isBonus: boolean;
  expiresAt: string | null;
  captureSource: CaptureSource | null;
}

export interface NewGoodsReceipt {
  supplierId: number | null;
  docType: ReceiptDocType;
  docNumber: string | null;
  note: string | null;
  total: number;
  // When the invoice has to be paid (arrival day + supplier's credit days).
  dueDate: string;
  lines: PreparedReceiptLine[];
  actorId: number;
}

// What the Almacén counted on arrival, without prices: the invoice comes
// later (registerInvoice).
export interface ReceptionLine {
  productId: number;
  presentationId: number | null;
  // Presentations counted (2 Cajas) and the units they hold (2 × 36).
  quantity: number;
  receivedUnits: number;
  expiresAt: string | null;
  captureSource: CaptureSource | null;
}

export interface NewReception {
  supplierId: number | null;
  note: string | null;
  invoicePhotoUrl: string | null;
  lines: ReceptionLine[];
  actorId: number;
}

// A received line as the admin sees it when typing the invoice.
export interface ReceivedLineForInvoice {
  itemId: number;
  productId: number;
  productName: string;
  presentationId: number | null;
  presentationName: string | null;
  supplierCode: string | null;
  unitsPerPresentation: number;
  quantity: number;
  receivedUnits: number;
  expiresAt: string | null;
  priceSale: number;
}

export interface ReceiptForInvoice {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  receivedAt: Date;
  createdByName: string | null;
  note: string | null;
  invoiceStatus: ReceiptInvoiceStatus;
  invoicePhotoUrl: string | null;
  lines: ReceivedLineForInvoice[];
}

// An invoiced line: an existing received line (itemId) or one the supplier
// invoiced that never arrived (itemId null, nothing received).
export interface InvoicedLine {
  itemId: number | null;
  productId: number;
  presentationId: number | null;
  quantity: number;
  units: number;
  receivedUnits: number;
  lineTotal: number;
  listTotal: number | null;
  discountPercent: number;
  unitCost: number;
  isBonus: boolean;
}

export interface ReceiptInvoice {
  receiptId: number;
  docType: ReceiptDocType;
  docNumber: string | null;
  total: number;
  dueDate: string;
  lines: InvoicedLine[];
  actorId: number;
  at: Date;
}

export interface GoodsReceiptLine {
  productName: string;
  presentationName: string | null;
  quantity: number;
  units: number;
  receivedUnits: number;
  // null while the invoice isn't registered.
  lineTotal: number | null;
  listTotal: number | null;
  discountPercent: number;
  isBonus: boolean;
  expiresAt: string | null;
}

export interface GoodsReceipt {
  id: number;
  receivedAt: Date;
  supplierName: string | null;
  docType: ReceiptDocType;
  docNumber: string | null;
  // null while the invoice isn't registered.
  total: number | null;
  note: string | null;
  createdByName: string | null;
  invoiceStatus: ReceiptInvoiceStatus;
  invoicePhotoUrl: string | null;
  paymentStatus: ReceiptPaymentStatus;
  dueDate: string | null;
  paidAt: Date | null;
  paidMethod: SupplierPaymentMethod | null;
  paidByName: string | null;
  paymentNote: string | null;
  lines: GoodsReceiptLine[];
}

export interface NewStockTransfer {
  // Units per product (already converted from presentations).
  lines: { productId: number; units: number; captureSource: CaptureSource | null }[];
  note: string | null;
  actorId: number;
}

export interface StockTransfer {
  id: number;
  createdAt: Date;
  fromName: string;
  toName: string;
  note: string | null;
  createdByName: string | null;
  lines: { productName: string; units: number }[];
}

export type DiscrepancyStatus = "open" | DiscrepancyResolution;

export const DISCREPANCY_STATUS_LABELS: Record<DiscrepancyStatus, string> = {
  open: "Por resolver",
  replenished: "El proveedor lo trajo",
  credited: "El proveedor lo descontó",
  written_off: "Se asumió la pérdida",
  kept: "Nos quedamos con lo extra",
  returned: "Se devolvió al proveedor",
};

// A receipt line where what arrived didn't match the invoice.
export interface ReceiptDiscrepancy {
  id: number;
  receiptId: number;
  receivedAt: Date;
  supplierName: string | null;
  docNumber: string | null;
  productId: number;
  productName: string;
  tracksExpiry: boolean;
  invoiceUnits: number;
  receivedUnits: number;
  // < 0 missing, > 0 extra.
  units: number;
  amount: number;
  status: DiscrepancyStatus;
  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: Date | null;
}
