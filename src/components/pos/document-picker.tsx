"use client";

import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SALE_DOCUMENT_TYPE_LABELS,
  type DocumentCustomer,
  type SaleDocumentRequest,
  type SaleDocumentType,
} from "@/domain/entities/sale-document";
import { BOLETA_ANONYMOUS_MAX, documentRequestErrors } from "@/domain/services/e-invoice";
import { isValidRuc } from "@/domain/services/ruc";

type Lookup =
  | { status: "found"; name: string; address: string | null }
  | { status: "not_found" }
  | { status: "unavailable" };

// A complete document number, ready to look up.
function isComplete(docType: "1" | "6", number: string): boolean {
  return docType === "1" ? /^\d{8}$/.test(number) : isValidRuc(number);
}

// Boleta (default) or factura. The DNI / RUC field is always there: empty
// means "clientes varios" (boleta up to S/ 700). The name is looked up as soon
// as the last digit is typed, and stays editable: offline, the cashier types it.
export function DocumentPicker({
  value,
  total,
  onChange,
}: {
  value: SaleDocumentRequest;
  total: number;
  onChange: (value: SaleDocumentRequest) => void;
}) {
  const [looking, setLooking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  // The lookup answers after the cashier may have kept typing: it must merge
  // into the latest value, not the one it started from.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const customer = value.customer ?? null;
  const docType = value.type === "factura" ? "6" : "1";
  const errors = documentRequestErrors(value, total);

  function setType(type: SaleDocumentType) {
    setHint(null);
    onChange({ type, customer: null });
  }

  // An empty boleta customer is "clientes varios" (no customer at all).
  function emit(next: DocumentCustomer) {
    const empty = !next.number && !next.name.trim() && !next.address?.trim();
    onChange({ type: latest.current.type, customer: empty && latest.current.type === "boleta" ? null : next });
  }

  function update(patch: Partial<DocumentCustomer>) {
    const base = latest.current.customer ?? { docType, number: "", name: "", address: null };
    emit({ ...base, docType, ...patch });
  }

  async function lookup(number: string) {
    setLooking(true);
    setHint(null);
    try {
      const response = await fetch("/api/e-invoicing/customer-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType, number }),
      });
      const result = (await response.json()) as Lookup;
      // Typed something else meanwhile: this answer is for an old number.
      if (latest.current.customer?.number !== number) return;
      if (result.status === "found") {
        update({ name: result.name, address: result.address });
      } else if (result.status === "not_found") {
        setHint(docType === "6" ? "RUC no encontrado: escribe la razón social." : "DNI no encontrado: escribe el nombre.");
      } else {
        setHint("La consulta no responde: escribe el nombre.");
      }
    } catch {
      setHint("Sin conexión: escribe el nombre.");
    } finally {
      setLooking(false);
    }
  }

  function onNumberChange(raw: string) {
    const number = raw.replace(/\D/g, "").slice(0, docType === "6" ? 11 : 8);
    // A new number clears the name looked up for the previous one.
    const changed = number !== (customer?.number ?? "");
    update(changed ? { number, name: "", address: null } : { number });
    setHint(null);
    if (changed && isComplete(docType, number)) void lookup(number);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
      <ToggleGroup
        aria-label="Comprobante"
        value={[value.type]}
        onValueChange={(next) => {
          const [selected] = next as SaleDocumentType[];
          if (selected) setType(selected);
        }}
        spacing={2}
        className="grid w-full grid-cols-2"
      >
        {(["boleta", "factura"] as const).map((type) => (
          <ToggleGroupItem
            key={type}
            value={type}
            variant="outline"
            className="h-10 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {SALE_DOCUMENT_TYPE_LABELS[type]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="doc-number">
            {docType === "6"
              ? "RUC"
              : total > BOLETA_ANONYMOUS_MAX
                ? "DNI (obligatorio, más de S/ 700)"
                : "DNI (opcional)"}
          </Label>
          <Input
            id="doc-number"
            inputMode="numeric"
            autoComplete="off"
            placeholder={docType === "6" ? "11 dígitos" : "8 dígitos · vacío = clientes varios"}
            value={customer?.number ?? ""}
            onChange={(e) => onNumberChange(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          aria-label="Buscar"
          onClick={() => customer?.number && void lookup(customer.number)}
          disabled={looking || !customer?.number || !isComplete(docType, customer.number)}
        >
          {looking ? <LoaderCircleIcon className="animate-spin" /> : <SearchIcon />}
        </Button>
      </div>

      {(customer !== null || docType === "6") && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-name">{docType === "6" ? "Razón social" : "Nombre"}</Label>
          <Input
            id="doc-name"
            value={customer?.name ?? ""}
            placeholder={looking ? "Buscando…" : undefined}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
      )}
      {docType === "6" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-address">Dirección</Label>
          <Input
            id="doc-address"
            value={customer?.address ?? ""}
            onChange={(e) => update({ address: e.target.value })}
          />
        </div>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors.length > 0 && <p className="text-xs text-destructive">{errors[0]}</p>}
    </div>
  );
}
