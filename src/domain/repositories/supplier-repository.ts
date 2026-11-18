import type { Supplier, SupplierData } from "../entities/supplier";

export interface SupplierRepository {
  findAll(): Promise<Supplier[]>;
  findById(id: number): Promise<Supplier | null>;
  // excludeId lets an update keep its own RUC.
  existsByRuc(ruc: string, excludeId?: number): Promise<boolean>;
  // Display name (trade name, else business name) of the supplier with that RUC.
  findNameByRuc(ruc: string, excludeId?: number): Promise<string | null>;
  // Supplier and its categories are written together.
  create(data: SupplierData): Promise<void>;
  update(id: number, data: SupplierData): Promise<void>;
  setActive(id: number, isActive: boolean): Promise<void>;
  // From the category's side: exactly these suppliers deliver it (the
  // suppliers' other categories are left as they are).
  setCategorySuppliers(categoryId: number, supplierIds: number[]): Promise<void>;
}
