"use client";

import { PlusIcon, SearchIcon, TruckIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ScanHint, useScanFlash } from "@/components/scanner/scanner-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  createAlertDialogHandle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildBarcodeIndex } from "@/domain/services/barcode-scan";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useScanner } from "@/hooks/use-scanner";
import { cn } from "@/lib/utils";
import { ReceptionSheet, supplierTone } from "./reception-sheet";
import {
  newLineKey,
  type OpenReception,
  type ReceptionCatalog,
} from "./reception-types";

type Saved = { receptions: OpenReception[]; activeId: string | null };

const startedFormat = new Intl.DateTimeFormat("es-PE", { timeStyle: "short" });
const EMPTY: Saved = { receptions: [], activeId: null };

// The Almacén's receiving desk: one tab per truck being unloaded (Backus,
// Costa…), each with its own count, kept on the phone until it is finished.
// The reader adds to the tab on screen.
export function ReceptionWorkspace(catalog: ReceptionCatalog) {
  const { products, presentations, suppliers } = catalog;
  const [receptions, setReceptions] = useState<OpenReception[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // "¿Quién llegó?" is showing (always when nothing is open).
  const [picking, setPicking] = useState(false);

  // Survives a reload or a closed tab, on this phone.
  const draft = useFormDraft<Saved>({
    key: "receptions:open",
    values: { receptions, activeId },
    baseline: EMPTY,
    enabled: true,
    onRestore: (saved) => {
      const valid = (saved.receptions ?? []).filter((r) =>
        suppliers.some((s) => s.id === r.supplierId),
      );
      setReceptions(valid);
      setActiveId(valid.some((r) => r.id === saved.activeId) ? saved.activeId : (valid[0]?.id ?? null));
    },
  });
  void draft;

  const active = receptions.find((r) => r.id === activeId) ?? null;
  const showPicker = picking || active === null;

  function updateReception(id: string, update: (r: OpenReception) => OpenReception) {
    setReceptions((prev) => prev.map((r) => (r.id === id ? update(r) : r)));
  }

  function start(supplierId: number) {
    const reception: OpenReception = {
      id: crypto.randomUUID(),
      supplierId,
      invoicePhotoUrl: null,
      note: "",
      lines: [],
      startedAt: Date.now(),
    };
    setReceptions((prev) => [...prev, reception]);
    setActiveId(reception.id);
    setPicking(false);
  }

  // The X of a tab: straight away if nothing was counted, else confirm.
  const [confirmClose] = useState(createAlertDialogHandle);
  const [closing, setClosing] = useState<OpenReception | null>(null);
  const closingName = suppliers.find((s) => s.id === closing?.supplierId)?.name ?? "proveedor";
  const closingCount = closing?.lines.reduce((sum, l) => sum + l.counted, 0) ?? 0;
  function askClose(reception: OpenReception) {
    if (reception.lines.every((l) => l.counted === 0)) {
      close(reception.id);
      return;
    }
    setClosing(reception);
    confirmClose.open(null);
  }

  function close(id: string) {
    const rest = receptions.filter((r) => r.id !== id);
    setReceptions(rest);
    setActiveId(rest[0]?.id ?? null);
  }

  const barcodes = useMemo(
    () =>
      buildBarcodeIndex({
        units: products.map((p) => ({ productId: p.id, barcode: p.barcode })),
        presentations,
      }),
    [products, presentations],
  );
  const feedback = useScanFlash();
  const [scannedKey, setScannedKey] = useState<string | null>(null);

  // Each trigger on a pack adds 1 pack to the truck on screen.
  const { lastScanAt } = useScanner((code, source) => {
    if (!active || showPicker) {
      feedback.fail();
      toast.error("Primero elige quién llegó", { id: "scan-no-truck" });
      return;
    }
    const target = barcodes.get(code);
    const product = target && products.find((p) => p.id === target.productId);
    if (!target || !product) {
      feedback.fail();
      toast.error("Código no registrado", {
        id: "scan-unknown",
        description: `${code}. Agrégalo desde la lista y pide al administrador que registre el código.`,
      });
      return;
    }
    const presentationId = target.kind === "presentation" ? target.presentationId : null;
    const existing = active.lines.find(
      (l) => l.productId === product.id && l.presentationId === presentationId,
    );
    const key = existing?.key ?? newLineKey();
    updateReception(active.id, (r) => ({
      ...r,
      lines: existing
        ? r.lines.map((l) =>
            l.key === key
              ? {
                  ...l,
                  counted: l.counted + 1,
                  captureSource: l.counted === 0 || l.captureSource === "scan" ? source : "manual",
                }
              : l,
          )
        : [
            ...r.lines,
            {
              key,
              productId: product.id,
              presentationId,
              counted: 1,
              expiresAt: "",
              captureSource: source,
            },
          ],
    }));
    setScannedKey(key);
    feedback.ok();
    requestAnimationFrame(() =>
      document.getElementById(`line-${key}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {receptions.length > 0 && (
        // Scrolls sideways on a phone instead of wrapping into a mess.
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <div className="flex w-max items-stretch gap-2" role="tablist" aria-label="Camiones en curso">
            {receptions.map((r) => {
              const supplier = suppliers.find((s) => s.id === r.supplierId);
              const counted = r.lines.reduce((sum, l) => sum + l.counted, 0);
              const selected = r.id === activeId && !showPicker;
              const name = supplier?.name ?? "Proveedor";
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex min-h-13 items-stretch overflow-hidden rounded-lg border-2 transition-colors",
                    selected ? supplierTone(r.supplierId).tab : "border-border bg-card",
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setActiveId(r.id);
                      setPicking(false);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 py-1.5 pr-2 pl-3 text-left",
                      !selected && "hover:bg-muted",
                    )}
                  >
                    <TruckIcon className="size-5 shrink-0" aria-hidden />
                    <span className="flex flex-col leading-tight">
                      <span className="max-w-40 truncate font-semibold">{name}</span>
                      <span className={cn("text-xs", selected ? "opacity-85" : "text-muted-foreground")}>
                        desde {startedFormat.format(r.startedAt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "min-w-7 rounded-md px-1.5 py-0.5 text-center text-sm font-semibold tabular-nums",
                        selected ? "bg-background/90 text-foreground" : "bg-muted",
                      )}
                      aria-label={`${counted} contados`}
                    >
                      {counted}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Cerrar recepción de ${name}`}
                    onClick={() => askClose(r)}
                    className={cn(
                      "flex size-auto min-w-11 items-center justify-center border-l-2",
                      selected
                        ? "border-background/30 hover:bg-black/15"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <XIcon className="size-5" />
                  </button>
                </div>
              );
            })}
            {!showPicker && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex min-h-13 items-center gap-2 rounded-lg border-2 border-dashed px-4 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                <PlusIcon className="size-5" />
                Nuevo camión
              </button>
            )}
          </div>
        </div>
      )}

      <AlertDialog handle={confirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar la recepción de {closingName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra lo contado ({closingCount} {closingCount === 1 ? "bulto" : "bultos"}) en este
              celular. No entra nada al Almacén.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir contando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => closing && close(closing.id)}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScanHint lastScanAt={lastScanAt} flash={feedback.flash}>
        {showPicker
          ? "Elige quién llegó y luego dispara el lector sobre cada paquete."
          : "Dispara el lector sobre cada paquete o caja: suma 1 por disparo al camión de arriba."}
      </ScanHint>

      {showPicker ? (
        <SupplierPicker
          catalog={catalog}
          openSupplierIds={receptions.map((r) => r.supplierId)}
          onPick={start}
          onResume={(supplierId) => {
            const open = receptions.find((r) => r.supplierId === supplierId);
            if (open) {
              setActiveId(open.id);
              setPicking(false);
            }
          }}
          onCancel={receptions.length > 0 ? () => setPicking(false) : undefined}
        />
      ) : (
        active && (
          <ReceptionSheet
            key={active.id}
            reception={active}
            catalog={catalog}
            scannedKey={scannedKey}
            onChange={(update) => updateReception(active.id, update)}
            onDone={() => close(active.id)}
          />
        )
      )}
    </div>
  );
}

// Step 1: who arrived? Picking the supplier opens its reception.
function SupplierPicker({
  catalog,
  openSupplierIds,
  onPick,
  onResume,
  onCancel,
}: {
  catalog: ReceptionCatalog;
  openSupplierIds: number[];
  onPick: (supplierId: number) => void;
  onResume: (supplierId: number) => void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const suppliers = catalog.suppliers.filter((s) => s.name.toLowerCase().includes(needle));

  function choose(id: number) {
    if (openSupplierIds.includes(id)) onResume(id);
    else onPick(id);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">¿Quién llegó?</h2>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Volver al camión en curso
          </Button>
        )}
      </div>
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar proveedor"
          className="pl-8"
        />
      </div>
      {suppliers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay proveedores con ese nombre. Pide al administrador que lo registre.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => {
          const open = openSupplierIds.includes(s.id);
          return (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary"
            >
              <button
                type="button"
                onClick={() => choose(s.id)}
                className="flex items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl font-heading text-lg font-semibold",
                    supplierTone(s.id).avatar,
                  )}
                  aria-hidden
                >
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-heading font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {open ? "Recepción en curso: toca para continuar" : "Toca para empezar a contar"}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
