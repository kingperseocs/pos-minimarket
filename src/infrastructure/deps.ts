import {
  companyLookup,
  DNI_LOOKUP_TIMEOUT_MS,
  identityLookup,
  RUC_LOOKUP_TIMEOUT_MS,
} from "./identity";
import type { AttendanceDeps } from "@/application/use-cases/attendance/deps";
import {
  attendanceRepository,
  auditRepository,
  cashShiftRepository,
  discountPolicyRepository,
  productRepository,
  promoDiscountRepository,
  saleRepository,
  salesAnalyticsRepository,
  salesGoalRepository,
  supplierRepository,
  userRepository,
  workerRepository,
  workScheduleRepository,
  workShiftRepository,
} from "./repositories";

// Composition root for the use cases that need several adapters.
export const saleDeps = {
  sales: saleRepository,
  users: userRepository,
  products: productRepository,
  workers: workerRepository,
  policies: discountPolicyRepository,
  promos: promoDiscountRepository,
};

export const promoDiscountDeps = {
  promos: promoDiscountRepository,
  audit: auditRepository,
};

export const workerDeps = {
  workers: workerRepository,
  audit: auditRepository,
  identity: identityLookup,
  policies: discountPolicyRepository,
};

export const rucLookupDeps = {
  suppliers: supplierRepository,
  companies: companyLookup,
};

export const attendanceDeps: AttendanceDeps = {
  attendance: attendanceRepository,
  schedules: workScheduleRepository,
  workShifts: workShiftRepository,
  audit: auditRepository,
  shifts: cashShiftRepository,
};

export const goalDeps = {
  goals: salesGoalRepository,
  analytics: salesAnalyticsRepository,
  audit: auditRepository,
};

export { DNI_LOOKUP_TIMEOUT_MS, RUC_LOOKUP_TIMEOUT_MS };
