// Pure rules of electronic invoicing at the till: which sales are emitted
// automatically, what customer data each document needs, and the request the
// billing engine ("motor") receives. No I/O here.

import type { SaleItemInput, SaleRecord } from "../entities/sale";
import type {
  CustomerDocType,
  EInvoicingSettings,
  IgvAffectation,
  ReviewReason,
  SaleDocumentRequest,
} from "../entities/sale-document";
import { round2 } from "../value-objects/money";
import { isValidRuc } from "./ruc";

// A boleta above this total must identify the buyer (motor rule, RS 097-2012
// as amended: "clientes varios" only up to S/ 700).
export const BOLETA_ANONYMOUS_MAX = 700;

const DNI_PATTERN = /^\d{8}$/;

// Why a sale goes to review instead of being emitted. Sales with discounts,
// gifts, redeemed points or rounding wait for the accountant (D-19 to D-22):
// the motor does not express them yet.
export function reviewReasons(sale: SaleRecord): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (sale.discountTotal > 0 || sale.promoDiscountId !== null) reasons.push("discount");
  if (sale.giftTotal > 0 || sale.items.some((item) => item.isGift)) reasons.push("gift");
  if (sale.redeemTotal > 0) reasons.push("redeem");
  if (sale.rounding !== 0) reasons.push("rounding");
  if (reasons.length === 0 && !totalsMatch(sale.items, sale.total)) {
    reasons.push("total_mismatch");
  }
  return reasons;
}

// The motor recomputes the total from quantity × price: it must equal what
// the customer paid, or the document would not match the sale.
export function totalsMatch(items: SaleItemInput[], total: number): boolean {
  const sum = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  return Math.abs(round2(sum) - round2(total)) < 0.005;
}

// Problems with the document the cashier chose, in Spanish, ready to show.
// Empty when it can be issued.
export function documentRequestErrors(
  request: SaleDocumentRequest,
  total: number,
): string[] {
  const errors: string[] = [];
  const customer = request.customer ?? null;

  if (request.type === "factura") {
    if (!customer || customer.docType !== "6") {
      errors.push("La factura necesita el RUC del cliente.");
      return errors;
    }
  } else if (!customer && total > BOLETA_ANONYMOUS_MAX) {
    errors.push(
      `Una boleta de más de S/ ${BOLETA_ANONYMOUS_MAX} necesita el DNI o RUC del cliente.`,
    );
    return errors;
  }
  if (!customer) return errors;

  const number = customer.number.trim();
  if (customer.docType === "1" && !DNI_PATTERN.test(number)) {
    errors.push("El DNI debe tener 8 dígitos.");
  }
  if (customer.docType === "6" && !isValidRuc(number)) {
    errors.push("El RUC no es válido.");
  }
  if (!customer.name.trim()) {
    errors.push("Falta el nombre o la razón social del cliente.");
  }
  return errors;
}

// The customer as stored on the document ("clientes varios" when none).
export function documentCustomerFields(request: SaleDocumentRequest): {
  customerDocType: CustomerDocType;
  customerDocNumber: string | null;
  customerName: string | null;
  customerAddress: string | null;
} {
  const customer = request.customer ?? null;
  if (!customer) {
    return { customerDocType: "0", customerDocNumber: null, customerName: null, customerAddress: null };
  }
  return {
    customerDocType: customer.docType,
    customerDocNumber: customer.number.trim(),
    customerName: customer.name.trim().toUpperCase(),
    customerAddress: customer.address?.trim() || null,
  };
}

export function seriesFor(
  type: SaleDocumentRequest["type"],
  settings: Pick<EInvoicingSettings, "boletaSeries" | "facturaSeries">,
): string {
  return type === "factura" ? settings.facturaSeries : settings.boletaSeries;
}

// Affectation of a line: the global override wins (the accountant's answer
// applied to everything), else the product's own.
export function lineAffectation(
  product: IgvAffectation | undefined,
  globalOverride: IgvAffectation | null,
): IgvAffectation {
  return globalOverride ?? product ?? "10";
}

export interface MotorItem {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  afectacion_igv: IgvAffectation;
}

export interface MotorCustomer {
  tipo_documento: "1" | "6";
  numero_documento: string;
  razon_social: string;
  direccion?: string;
}

export interface MotorIssueRequest {
  serie: string;
  cajero?: string;
  cliente?: MotorCustomer;
  items: MotorItem[];
}

export interface DocumentForPayload {
  series: string;
  customerDocType: CustomerDocType;
  customerDocNumber: string | null;
  customerName: string | null;
  customerAddress: string | null;
}

// The body of POST /boletas or /facturas. Amounts go as strings so no float
// rounding reaches the motor (it reads them as decimals). Prices include IGV,
// as charged at the till; the motor computes the tax.
export function buildIssueRequest(input: {
  document: DocumentForPayload;
  items: SaleItemInput[];
  affectations: Map<number, IgvAffectation>;
  globalOverride: IgvAffectation | null;
  cashierName?: string | null;
}): MotorIssueRequest {
  const { document } = input;
  const request: MotorIssueRequest = {
    serie: document.series,
    items: input.items.map((item) => ({
      codigo: String(item.productId),
      descripcion: item.productName,
      unidad: "NIU",
      cantidad: String(item.quantity),
      precio_unitario: item.unitPrice.toFixed(2),
      afectacion_igv: lineAffectation(input.affectations.get(item.productId), input.globalOverride),
    })),
  };
  const cashier = input.cashierName?.trim();
  if (cashier) request.cajero = cashier.slice(0, 100);
  if (document.customerDocType !== "0" && document.customerDocNumber && document.customerName) {
    request.cliente = {
      tipo_documento: document.customerDocType,
      numero_documento: document.customerDocNumber,
      razon_social: document.customerName,
    };
    if (document.customerAddress) request.cliente.direccion = document.customerAddress;
  }
  return request;
}
