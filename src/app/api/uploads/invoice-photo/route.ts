import { NextResponse } from "next/server";
import { uploadInvoicePhotoUseCase } from "@/application/use-cases/inventory/upload-invoice-photo";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/application/use-cases/products/upload-product-image";
import { InvalidImageError } from "@/domain/errors";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { imageStorage } from "@/infrastructure/storage";

// The Almacén photographs the supplier's invoice on arrival, so the admin
// can type it later. A Route Handler: Server Actions cap bodies at 1 MB.
export async function POST(request: Request) {
  if (!(await userWithPermission("stock"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return NextResponse.json({ error: "La foto supera los 2 MB" }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadInvoicePhotoUseCase(imageStorage, bytes);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Invoice photo upload failed", error);
    return NextResponse.json({ error: "No se pudo subir la foto" }, { status: 500 });
  }
}
