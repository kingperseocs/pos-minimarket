// Phone photos are several MB; downscale + re-encode to WebP in the browser
// so uploads stay small and fast (and well under the server's 2 MB limit).
export async function compressImage(file: File, maxDimension: number, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))),
      "image/webp",
      quality,
    ),
  );

  return {
    blob,
    original: { width, height },
    result: { width: canvas.width, height: canvas.height },
  };
}
