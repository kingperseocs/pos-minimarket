import type {
  PromoDiscount,
  PromoDiscountData,
} from "../entities/promo-discount";

export interface PromoDiscountRepository {
  // Every discount (active first), for the admin panel.
  listAll(): Promise<PromoDiscount[]>;
  // What the cashier can choose from, lowest percent first.
  listActive(): Promise<PromoDiscount[]>;
  // Found even when inactive: an offline sale may use one deactivated since.
  findById(id: number): Promise<PromoDiscount | null>;
  existsByName(name: string, excludeId?: number): Promise<boolean>;
  create(data: PromoDiscountData, actorId: number): Promise<PromoDiscount>;
  // Only the name: the percent never changes (see PromoDiscount).
  rename(id: number, name: string): Promise<void>;
  setActive(id: number, isActive: boolean): Promise<void>;
}
