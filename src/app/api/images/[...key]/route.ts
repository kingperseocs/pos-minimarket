import { INVOICE_PHOTO_PREFIX } from "@/application/use-cases/inventory/upload-invoice-photo";
import { PRODUCT_IMAGE_PREFIX } from "@/application/use-cases/products/upload-product-image";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { imageStorage } from "@/infrastructure/storage";

// Streams images out of the (private) bucket. Only these prefixes are
// exposed, and keys are validated so this can't be used to read arbitrary
// objects from the bucket.
const PRODUCT_KEY = /^products\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const INVOICE_KEY = /^invoices\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/images/[...key]">,
) {
  const key = (await ctx.params).key.join("/");
  const isProduct = key.startsWith(PRODUCT_IMAGE_PREFIX) && PRODUCT_KEY.test(key);
  const isInvoice = key.startsWith(INVOICE_PHOTO_PREFIX) && INVOICE_KEY.test(key);
  if (!isProduct && !isInvoice) return new Response("Not found", { status: 404 });

  // Invoices show prices and tax ids: only the admin and the Almacén.
  if (isInvoice && !(await userWithPermission("stock"))) {
    return new Response("Not found", { status: 404 });
  }

  const image = await imageStorage.get(key);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(image.body, {
    headers: {
      "Content-Type": image.contentType,
      ...(image.contentLength
        ? { "Content-Length": String(image.contentLength) }
        : {}),
      // Keys are random and never overwritten, so the bytes never change.
      // Invoices stay out of shared caches.
      "Cache-Control": isInvoice
        ? "private, max-age=31536000, immutable"
        : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
