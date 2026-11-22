"use client";

// Prints an electronic document's PDF (fetched through the POS, which holds
// the motor's credentials) on the default printer: at the till, the 80 mm
// thermal printer installed in Windows. Uses a hidden iframe so the cashier
// stays on the till; if the browser can't print from it, the PDF opens in a
// new tab to print from there.
export async function printDocumentPdf(
  documentId: number,
  format: "ticket" | "a4" | "a5" = "ticket",
): Promise<void> {
  const url = `/api/e-invoicing/documents/${documentId}/pdf?formato=${format}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo obtener el comprobante.");
  }
  const blobUrl = URL.createObjectURL(await response.blob());

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = blobUrl;
  document.body.appendChild(frame);

  await new Promise<void>((resolve) => {
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(blobUrl, "_blank");
      }
      resolve();
    };
  });
  // Give the print dialog time to read the document before cleaning up.
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}

// Opens the PDF in a new tab (to look at it, download or share it).
export function openDocumentPdf(documentId: number, format: "ticket" | "a4" | "a5" = "ticket") {
  window.open(`/api/e-invoicing/documents/${documentId}/pdf?formato=${format}`, "_blank");
}
