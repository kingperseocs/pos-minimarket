import type { ImageStorage } from "@/domain/repositories/image-storage";
import { storeUploadedImage } from "@/application/use-cases/products/upload-product-image";

// Photos of supplier invoices: kept apart from product photos, and served
// only to signed-in staff (they show prices and the store's tax id).
export const INVOICE_PHOTO_PREFIX = "invoices/";

const INVOICE_PHOTO_URL_PATTERN =
  /^\/api\/images\/invoices\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;

export function isInvoicePhotoUrl(url: string) {
  return INVOICE_PHOTO_URL_PATTERN.test(url);
}

export function uploadInvoicePhotoUseCase(storage: ImageStorage, bytes: Uint8Array) {
  return storeUploadedImage(storage, bytes, INVOICE_PHOTO_PREFIX);
}
