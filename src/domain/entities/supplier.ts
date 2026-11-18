// A company (or person) the minimarket buys from. A supplier delivers one or
// more categories and a category can be delivered by several suppliers
// (Bebidas: Backus, AJE, Lindley…), hence a many-to-many relation.
export interface SupplierCategoryRef {
  id: number;
  name: string;
}

// An account to pay the supplier by transfer.
export interface SupplierBankAccount {
  bank: string;
  accountNumber: string;
  // Código de cuenta interbancario (20 digits).
  cci: string | null;
}

// How the supplier delivers and gets paid (shared by Supplier and SupplierData).
interface DeliveryAndPayment {
  // Weekdays the order arrives (0 = Sunday … 6 = Saturday), sorted.
  deliveryDays: number[];
  // Usual delivery window, "HH:MM".
  deliveryTimeFrom: string | null;
  deliveryTimeTo: string | null;
  driverName: string | null;
  driverPhone: string | null;
  acceptsYapePlin: boolean;
  // Number to pay by Yape/Plin; null unless acceptsYapePlin.
  yapePlinPhone: string | null;
  givesCredit: boolean;
  // Days of credit; null unless givesCredit.
  creditDays: number | null;
  // Empty = the supplier has no bank accounts.
  bankAccounts: SupplierBankAccount[];
}

export interface Supplier extends DeliveryAndPayment {
  id: number;
  // 11-digit SUNAT RUC; null for small suppliers without one.
  ruc: string | null;
  // Razón social, as on the invoice.
  businessName: string;
  // Nombre comercial / brand the staff knows them by.
  tradeName: string | null;
  // Salesperson who takes the orders, and their phone.
  contactName: string | null;
  phone: string | null;
  // Correo corporativo.
  email: string | null;
  // Dirección fiscal.
  address: string | null;
  website: string | null;
  // Who to call with complaints (expired, missing or damaged goods).
  claimsContactName: string | null;
  claimsPhone: string | null;
  // Link to the up-to-date catalog / price list.
  catalogUrl: string | null;
  notes: string | null;
  isActive: boolean;
  categories: SupplierCategoryRef[];
}

export interface SupplierData extends DeliveryAndPayment {
  ruc: string | null;
  businessName: string;
  tradeName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  claimsContactName: string | null;
  claimsPhone: string | null;
  catalogUrl: string | null;
  notes: string | null;
  categoryIds: number[];
}

// Monday first, as the week is read in Peru.
export const WEEKDAYS: { value: number; short: string; letter: string }[] = [
  { value: 1, short: "Lun", letter: "L" },
  { value: 2, short: "Mar", letter: "M" },
  { value: 3, short: "Mié", letter: "M" },
  { value: 4, short: "Jue", letter: "J" },
  { value: 5, short: "Vie", letter: "V" },
  { value: 6, short: "Sáb", letter: "S" },
  { value: 0, short: "Dom", letter: "D" },
];

export const MAX_BANK_ACCOUNTS = 5;

// Suggestions for the bank of an account (any other name can be typed).
export const PERU_BANKS = [
  "BCP",
  "Interbank",
  "BBVA",
  "Scotiabank",
  "BanBif",
  "Banco de la Nación",
  "Banco Pichincha",
  "Caja Arequipa",
  "Caja Huancayo",
  "Caja Piura",
];

// "Lun, Jue · 09:00–11:00"; null when nothing is set.
export function formatDeliverySchedule(
  days: number[],
  from: string | null,
  to: string | null,
): string | null {
  const dayText = WEEKDAYS.filter((d) => days.includes(d.value))
    .map((d) => d.short)
    .join(", ");
  const timeText =
    from && to ? `${from}–${to}` : from ? `desde ${from}` : to ? `hasta ${to}` : "";
  const parts = [dayText, timeText].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// "Yape/Plin · 2 cuentas · Crédito 15 días"; null when it takes none of them.
export function formatPaymentMethods(
  supplier: Pick<
    Supplier,
    "acceptsYapePlin" | "bankAccounts" | "givesCredit" | "creditDays"
  >,
): string | null {
  const count = supplier.bankAccounts.length;
  const parts = [
    supplier.acceptsYapePlin && "Yape/Plin",
    count > 0 && `${count} ${count === 1 ? "cuenta" : "cuentas"}`,
    supplier.givesCredit &&
      (supplier.creditDays ? `Crédito ${supplier.creditDays} días` : "Crédito"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
