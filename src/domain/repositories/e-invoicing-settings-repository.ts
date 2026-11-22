import type { EInvoicingSettings } from "../entities/sale-document";

export interface EInvoicingSettingsRepository {
  get(): Promise<EInvoicingSettings>;
  update(settings: EInvoicingSettings): Promise<void>;
}
