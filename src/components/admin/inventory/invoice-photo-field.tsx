"use client";

import { CameraIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/application/use-cases/products/upload-product-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { compressImage } from "@/lib/compress-image";

// Big enough to read the small print of an invoice.
const TARGET_DIMENSION = 1600;

// A photo of the supplier's invoice, taken on arrival with the phone's
// camera, so the admin can type it later.
export function InvoicePhotoField({
  value,
  onChange,
  onUploadingChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setBusy(busy: boolean) {
    setUploading(busy);
    onUploadingChange?.(busy);
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Elige una foto (JPG, PNG o WebP).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { blob } = await compressImage(file, TARGET_DIMENSION, 0.8);
      if (blob.size > MAX_PRODUCT_IMAGE_BYTES) {
        throw new Error("La foto sigue siendo muy pesada. Tómala de nuevo más de cerca.");
      }
      const body = new FormData();
      body.append("file", blob, "factura.webp");
      const response = await fetch("/api/uploads/invoice-photo", { method: "POST", body });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error);
      onChange(json.url);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "No se pudo subir la foto. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="invoice-photo" optional>
        Foto de la factura
      </Label>
      <input
        ref={inputRef}
        id="invoice-photo"
        type="file"
        accept="image/*"
        // Opens the back camera on phones; a file picker on computers.
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {value ? (
        <div className="flex items-center gap-3">
          <a href={value} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by our own image route */}
            <img
              src={value}
              alt="Foto de la factura"
              className="h-20 w-16 rounded-md border object-cover"
            />
          </a>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">El administrador la verá al registrar la factura.</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <CameraIcon data-icon="inline-start" />
                Tomar otra
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={uploading}
                onClick={() => onChange(null)}
              >
                <XIcon data-icon="inline-start" />
                Quitar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-12 self-start"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : (
            <CameraIcon data-icon="inline-start" />
          )}
          {uploading ? "Subiendo foto..." : "Tomar foto de la factura"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
