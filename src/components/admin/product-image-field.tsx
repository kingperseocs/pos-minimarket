"use client";

import {
  CheckIcon,
  CircleAlertIcon,
  ImageUpIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/application/use-cases/products/upload-product-image";
import { ProductImagePlaceholder } from "@/components/pos/product-image-placeholder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PopoverDescription } from "@/components/ui/popover";
import { compressImage } from "@/lib/compress-image";
import { cn } from "@/lib/utils";
import { InfoPopover } from "./price-info";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Limit on the original file picked by the admin. It gets compressed before
// upload, so this can be generous: it covers any phone photo.
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
// Product cards render at ~200–300 px; 800 px covers retina screens.
const TARGET_DIMENSION = 800;
// Below this the photo looks blurry on the POS cards — warn, don't block.
const MIN_RECOMMENDED_SIDE = 400;

const formatKB = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;


type Notice =
  | { kind: "error"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "success"; message: string };

export function ProductImageField({
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
  const [notice, setNotice] = useState<Notice | null>(null);

  function setBusy(busy: boolean) {
    setUploading(busy);
    onUploadingChange?.(busy);
  }

  async function handleFile(file: File) {
    // Checked before doing any work, so the admin gets an immediate answer.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setNotice({
        kind: "error",
        message: `"${file.name}" no es JPG, PNG ni WebP.`,
      });
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      setNotice({
        kind: "error",
        message: `La imagen pesa ${formatKB(file.size)}. El máximo es ${formatKB(MAX_ORIGINAL_BYTES)}.`,
      });
      return;
    }

    setNotice(null);
    setBusy(true);
    try {
      const { blob, original, result } = await compressImage(file, TARGET_DIMENSION);
      if (blob.size > MAX_PRODUCT_IMAGE_BYTES) {
        throw new Error("La imagen sigue siendo demasiado pesada tras optimizarla.");
      }

      const body = new FormData();
      body.append("file", blob, "product.webp");
      const response = await fetch("/api/uploads/product-image", {
        method: "POST",
        body,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error);

      onChange(json.url);

      const optimized = `${formatKB(file.size)} → ${formatKB(blob.size)} (${result.width}×${result.height} px)`;
      setNotice(
        Math.min(original.width, original.height) < MIN_RECOMMENDED_SIDE
          ? {
              kind: "warning",
              message: `La foto mide ${original.width}×${original.height} px y puede verse borrosa. Se recomienda al menos ${MIN_RECOMMENDED_SIDE}×${MIN_RECOMMENDED_SIDE} px. Optimizada: ${optimized}.`,
            }
          : { kind: "success", message: `Foto optimizada: ${optimized}.` },
      );
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "No se pudo subir la imagen. Inténtalo de nuevo.",
      });
    } finally {
      setBusy(false);
      // Allow picking the same file again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Label htmlFor="product-image">Foto</Label>
        <InfoPopover label="Requisitos de la foto" title="Requisitos de la foto" align="start">
          <PopoverDescription className="text-xs" render={<div />}>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Formatos: JPG, PNG o WebP.</li>
              <li>Peso máximo: {formatKB(MAX_ORIGINAL_BYTES)}.</li>
              <li>
                Recomendado: foto cuadrada de 800×800 px, con el producto
                centrado y fondo claro.
              </li>
              <li>Se optimiza sola antes de subir (≈ 50–150 KB).</li>
            </ul>
          </PopoverDescription>
        </InfoPopover>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        id="product-image"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <div
        className={cn(
          "relative overflow-hidden rounded-lg",
          !value && "border-2 border-dashed transition-colors",
          !value && (dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"),
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !uploading) void handleFile(file);
        }}
      >
        {value ? (
          <>
            <ProductImagePlaceholder src={value} alt="Foto del producto" className="rounded-none" />
            {!uploading && (
              <div className="absolute right-2 bottom-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shadow-sm"
                  onClick={() => inputRef.current?.click()}
                >
                  <ImageUpIcon data-icon="inline-start" />
                  Cambiar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="text-destructive shadow-sm hover:text-destructive"
                  onClick={() => {
                    setNotice(null);
                    onChange(null);
                  }}
                >
                  <XIcon data-icon="inline-start" />
                  Quitar
                </Button>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImageUpIcon className="size-6" aria-hidden />
            </span>
            <span className="text-sm font-medium text-foreground">
              {uploading ? "Subiendo..." : "Toca para subir una foto"}
            </span>
            <span className="hidden text-xs sm:block">o arrástrala aquí · JPG, PNG o WebP</span>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2Icon className="size-6 animate-spin" aria-hidden />
          </div>
        )}
      </div>

      {notice?.kind === "error" ? (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlertIcon />
          <AlertTitle>No se pudo usar esta imagen</AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : notice?.kind === "warning" ? (
        <Alert
          aria-live="polite"
          className="border-amber-500/40 text-amber-800 dark:text-amber-300"
        >
          <TriangleAlertIcon />
          <AlertTitle>Resolución baja</AlertTitle>
          <AlertDescription className="text-amber-800/90 dark:text-amber-300/90">
            {notice.message}
          </AlertDescription>
        </Alert>
      ) : notice?.kind === "success" ? (
        <p aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5 text-primary" aria-hidden />
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}
