import { ValidationError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { PromoDiscountRepository } from "@/domain/repositories/promo-discount-repository";
import {
  promoDiscountRenameSchema,
  promoDiscountSchema,
} from "@/application/validation/promo-discount";

export interface PromoDiscountDeps {
  promos: PromoDiscountRepository;
  audit: AuditRepository;
}

export function listPromoDiscountsUseCase(repo: PromoDiscountRepository) {
  return repo.listAll();
}

export function listActivePromoDiscountsUseCase(repo: PromoDiscountRepository) {
  return repo.listActive();
}

// Every change is logged: who offered which discount, and when.
function logChange(
  deps: PromoDiscountDeps,
  actorId: number,
  payload: Record<string, unknown>,
) {
  return deps.audit.record({
    type: "promo_discount_changed",
    actorId,
    payload,
    occurredAt: new Date(),
  });
}

export async function createPromoDiscountUseCase(
  deps: PromoDiscountDeps,
  input: unknown,
  actorId: number,
) {
  const data = promoDiscountSchema.parse(input);
  if (await deps.promos.existsByName(data.name)) {
    throw new ValidationError(`Ya existe el descuento "${data.name}"`);
  }
  const created = await deps.promos.create(data, actorId);
  await logChange(deps, actorId, {
    action: "created",
    promoDiscountId: created.id,
    name: created.name,
    percent: created.percent,
  });
  return created;
}

export async function renamePromoDiscountUseCase(
  deps: PromoDiscountDeps,
  input: unknown,
  actorId: number,
) {
  const { id, name } = promoDiscountRenameSchema.parse(input);
  const current = await deps.promos.findById(id);
  if (!current) throw new ValidationError("El descuento no existe");
  if (await deps.promos.existsByName(name, id)) {
    throw new ValidationError(`Ya existe el descuento "${name}"`);
  }
  if (current.name === name) return;
  await deps.promos.rename(id, name);
  await logChange(deps, actorId, {
    action: "renamed",
    promoDiscountId: id,
    from: current.name,
    to: name,
    percent: current.percent,
  });
}

// Never hard-deleted: past sales point at it. Deactivating hides it from the
// POS; a till offline with the old list can still use it, and the server
// accepts that sale with the percent stored here.
export async function setPromoDiscountActiveUseCase(
  deps: PromoDiscountDeps,
  id: number,
  isActive: boolean,
  actorId: number,
) {
  const current = await deps.promos.findById(id);
  if (!current) throw new ValidationError("El descuento no existe");
  if (current.isActive === isActive) return;
  await deps.promos.setActive(id, isActive);
  await logChange(deps, actorId, {
    action: isActive ? "activated" : "deactivated",
    promoDiscountId: id,
    name: current.name,
    percent: current.percent,
  });
}
