// Anomalies detected when a sale reaches the server. A flagged sale is still
// accepted — the money was already charged — but it shows up in the audit
// report so the owner can review it.
export type AuditFlag =
  | "PRICE_MISMATCH"
  | "DISCOUNT_MISMATCH"
  | "UNITS_LIMIT_EXCEEDED"
  | "WORKER_NOT_ACTIVE"
  | "DAILY_LIMIT_EXCEEDED"
  | "DISCOUNT_BELOW_MINIMUM"
  | "INVALID_VERIFICATION"
  | "GIFT_NOT_BIRTHDAY"
  | "GIFT_ALREADY_USED"
  | "GIFT_OVER_LIMIT"
  | "POINTS_OVERDRAWN"
  | "REDEEM_MISMATCH"
  // Legacy: only on sales from when there were a PIN, a monthly cap and
  // admin-approved courtesies.
  | "MONTHLY_LIMIT_EXCEEDED"
  | "OFFLINE_VERIFIED"
  | "COURTESY_NOT_APPROVED";

export const AUDIT_FLAGS: AuditFlag[] = [
  "PRICE_MISMATCH",
  "DISCOUNT_MISMATCH",
  "UNITS_LIMIT_EXCEEDED",
  "WORKER_NOT_ACTIVE",
  "DAILY_LIMIT_EXCEEDED",
  "DISCOUNT_BELOW_MINIMUM",
  "INVALID_VERIFICATION",
  "GIFT_NOT_BIRTHDAY",
  "GIFT_ALREADY_USED",
  "GIFT_OVER_LIMIT",
  "POINTS_OVERDRAWN",
  "REDEEM_MISMATCH",
  "MONTHLY_LIMIT_EXCEEDED",
  "OFFLINE_VERIFIED",
  "COURTESY_NOT_APPROVED",
];

export const AUDIT_FLAG_LABELS: Record<AuditFlag, string> = {
  PRICE_MISMATCH: "Precio distinto al catálogo",
  DISCOUNT_MISMATCH: "Descuento mayor al permitido",
  UNITS_LIMIT_EXCEEDED: "Más unidades con descuento",
  WORKER_NOT_ACTIVE: "Trabajador no activo",
  DAILY_LIMIT_EXCEEDED: "Superó el límite diario",
  DISCOUNT_BELOW_MINIMUM: "Descuento con menos de 3 productos",
  INVALID_VERIFICATION: "Trabajador desconocido",
  GIFT_NOT_BIRTHDAY: "Regalo fuera de su cumpleaños",
  GIFT_ALREADY_USED: "Regalo repetido este año",
  GIFT_OVER_LIMIT: "Regalo mayor al permitido",
  POINTS_OVERDRAWN: "Canjeó más puntos de los que tenía",
  REDEEM_MISMATCH: "Canje de puntos no válido",
  MONTHLY_LIMIT_EXCEEDED: "Superó el tope mensual",
  OFFLINE_VERIFIED: "Clave validada sin internet",
  COURTESY_NOT_APPROVED: "Cortesía sin aprobación",
};

// Plain-language explanation shown to the admin next to each flag.
export const AUDIT_FLAG_HELP: Record<AuditFlag, string> = {
  PRICE_MISMATCH:
    "Algún producto se cobró a un precio diferente al registrado en el catálogo.",
  DISCOUNT_MISMATCH:
    "Algún producto tuvo más descuento que el monto configurado para él, se aplicó descuento sin trabajador ni descuento %, o se combinaron el descuento de trabajador y un descuento %.",
  UNITS_LIMIT_EXCEEDED:
    "Se descontaron más de 3 productos en la compra.",
  WORKER_NOT_ACTIVE:
    "Se usó un trabajador pendiente, suspendido o rechazado. No sumó puntos.",
  DAILY_LIMIT_EXCEEDED:
    "El trabajador ya había usado su compra con descuento del día.",
  DISCOUNT_BELOW_MINIMUM:
    "Se aplicó el descuento a una compra con menos productos del mínimo (3): con 1 o 2 productos no hay descuento.",
  INVALID_VERIFICATION:
    "La venta menciona un trabajador que no existe en el sistema. No sumó puntos.",
  GIFT_NOT_BIRTHDAY:
    "Se regaló un producto a un trabajador que no estaba de cumpleaños ese día (o sin trabajador).",
  GIFT_ALREADY_USED:
    "El trabajador ya había recibido su regalo de cumpleaños este año.",
  GIFT_OVER_LIMIT:
    "El regalo de cumpleaños costaba más del tope o fue más de una unidad.",
  POINTS_OVERDRAWN:
    "El trabajador canjeó más puntos de los que tenía (p. ej. dos cajas sin internet canjearon a la vez). Su saldo quedó negativo y se recupera con sus próximas compras.",
  REDEEM_MISMATCH:
    "La venta trae un canje de puntos que no corresponde (sin trabajador activo, canje desactivado, monto que no cuadra con la tasa o menos del mínimo). Se cobró igual; revisa con el cajero.",
  MONTHLY_LIMIT_EXCEEDED:
    "El trabajador superó el monto máximo de descuento del mes.",
  OFFLINE_VERIFIED:
    "La clave se validó en la tablet sin internet. Es válida, pero con menor nivel de confianza.",
  COURTESY_NOT_APPROVED:
    "Se regalaron productos sin una aprobación válida del administrador.",
};

// Flags that are informative only (not suspicious by themselves).
export const INFO_AUDIT_FLAGS: AuditFlag[] = ["OFFLINE_VERIFIED"];

// Flags that disqualify the sale from earning loyalty points.
export const BLOCKING_AUDIT_FLAGS: AuditFlag[] = [
  "WORKER_NOT_ACTIVE",
  "INVALID_VERIFICATION",
];

export type AuditEventType =
  | "worker_pin_failed"
  | "worker_registered"
  | "worker_birth_date_updated"
  | "worker_statement_failed"
  | "worker_pin_reset_requested"
  | "worker_approved"
  | "worker_rejected"
  | "worker_suspended"
  | "worker_reactivated"
  | "worker_name_updated"
  | "policy_changed"
  | "promo_discount_changed"
  | "goal_changed"
  | "courtesy_approved"
  | "courtesy_denied"
  | "sold_without_stock"
  | "sold_expired"
  | "stock_adjusted"
  | "attendance_clock_in"
  | "attendance_clock_in_blocked"
  | "attendance_clock_in_outside_window"
  | "attendance_clock_out"
  | "attendance_added"
  | "attendance_correction_requested"
  | "attendance_correction_approved"
  | "attendance_correction_rejected"
  | "work_schedule_changed"
  | "shift_opened_off_schedule"
  | "clock_out_with_open_till"
  | "receipt_paid"
  | "receipt_unpaid"
  | "goods_received"
  | "receipt_invoiced";

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  worker_pin_failed: "Clave incorrecta",
  worker_registered: "Trabajador registrado",
  worker_birth_date_updated: "Fecha de nacimiento corregida",
  worker_statement_failed: "Datos incorrectos en Mis puntos",
  worker_pin_reset_requested: "Cambio de clave solicitado",
  worker_approved: "Trabajador aprobado",
  worker_rejected: "Trabajador rechazado",
  worker_suspended: "Trabajador suspendido",
  worker_reactivated: "Trabajador reactivado",
  worker_name_updated: "Nombre corregido con RENIEC",
  policy_changed: "Descuento modificado",
  promo_discount_changed: "Descuento % modificado",
  goal_changed: "Meta mensual de ventas modificada",
  courtesy_approved: "Cortesía aprobada",
  courtesy_denied: "Cortesía rechazada (clave incorrecta)",
  sold_without_stock: "Vendido sin stock",
  sold_expired: "Vendido de un lote vencido",
  stock_adjusted: "Ajuste de stock por conteo",
  attendance_clock_in: "Marcó entrada",
  attendance_clock_in_blocked: "Intentó marcar entrada fuera de horario",
  attendance_clock_in_outside_window: "Marcó entrada sin conexión fuera de horario",
  attendance_clock_out: "Marcó salida",
  attendance_added: "Jornada agregada por el admin",
  attendance_correction_requested: "Pidió corregir su marca",
  attendance_correction_approved: "Corrección de marca aprobada",
  attendance_correction_rejected: "Corrección de marca rechazada",
  work_schedule_changed: "Horario modificado",
  shift_opened_off_schedule: "Abrió caja fuera de su horario",
  clock_out_with_open_till: "Marcó salida con la caja abierta",
  receipt_paid: "Factura de proveedor pagada",
  receipt_unpaid: "Pago de factura deshecho",
  goods_received: "Mercadería recibida en Almacén",
  receipt_invoiced: "Factura de proveedor registrada",
};

export const ATTENDANCE_AUDIT_EVENTS: AuditEventType[] = [
  "attendance_clock_in",
  "attendance_clock_in_blocked",
  "attendance_clock_in_outside_window",
  "attendance_clock_out",
  "attendance_added",
  "attendance_correction_requested",
  "attendance_correction_approved",
  "attendance_correction_rejected",
  "work_schedule_changed",
  "shift_opened_off_schedule",
  "clock_out_with_open_till",
];

export interface AuditEventInput {
  type: AuditEventType;
  actorId: number | null;
  workerId?: number | null;
  // sales.uuid of the sale the event refers to (it may not be synced yet).
  saleUuid?: string | null;
  payload?: Record<string, unknown>;
  occurredAt: Date;
}

export interface AuditEvent extends Required<Omit<AuditEventInput, "payload">> {
  id: number;
  actorName: string | null;
  workerName: string | null;
  workerDni: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

// Per-cashier aggregates for the anti-fraud report.
export interface CashierAuditSummary {
  cashierId: number;
  cashierName: string;
  sales: number;
  discountedSales: number;
  discountTotal: number;
  // Sales with a birthday gift (or, on older sales, a courtesy).
  giftSales: number;
  giftTotal: number;
  flaggedSales: number;
}

export interface FlaggedSale {
  saleId: number;
  clientCreatedAt: Date;
  cashierName: string;
  workerName: string | null;
  workerDni: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  auditFlags: AuditFlag[];
}
