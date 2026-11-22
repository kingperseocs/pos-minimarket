"use client";

import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SALE_DOCUMENT_TYPE_LABELS,
  type SaleDocumentRequest,
  type SaleDocumentType,
} from "@/domain/entities/sale-document";
import { BOLETA_ANONYMOUS_MAX, documentRequestErrors } from "@/domain/services/e-invoice";

type Lookup = { status: "found"; name: string; address: string | null } | { status: "not_found" } | { status: "unavailable" };

// Boleta (default; DNI optional up to S/ 700) or factura (RUC). The name is
// looked up online and stays editable: offline, the cashier types it.
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
  const customer = value.customer ?? null;
  const docType = value.type === "factura" ? "6" : "1";
  const errors = documentRequestErrors(value, total);
  const needsCustomer = value.type === "factura" || total > BOLETA_ANONYMOUS_MAX || customer !== null;

  function setType(type: SaleDocumentType) {
    setHint(null);
    onChange({ type, customer: type === "factura" ? { docType: "6", number: "", name: "" } : null });
  }

  function setCustomer(patch: Partial<NonNullable<SaleDocumentRequest["customer"]>>) {
    const base = customer ?? { docType, number: "", name: "" };
    onChange({ ...value, customer: { ...base, docType, ...patch } });
  }

  async function lookup() {
    if (!customer?.number) return;
    setLooking(true);
    setHint(null);
    try {
      const response = await fetch("/api/e-invoicing/customer-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType, number: customer.number }),
      });
      const result = (await response.json()) as Lookup;
      if (result.status === "found") {
        setCustomer({ name: result.name, address: result.address });
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

      {!needsCustomer ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setCustomer({})}>
          + Agregar DNI del cliente (opcional)
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="doc-number">{docType === "6" ? "RUC" : "DNI"}</Label>
              <Input
                id="doc-number"
                inputMode="numeric"
                maxLength={docType === "6" ? 11 : 8}
                value={customer?.number ?? ""}
                onChange={(e) => setCustomer({ number: e.target.value.replace(/\D/g, "") })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void lookup();
                  }
                }}
              />
            </div>
            <Button variant="outline" onClick={() => void lookup()} disabled={looking || !customer?.number}>
              {looking ? <LoaderCircleIcon className="animate-spin" /> : <SearchIcon />}
              Buscar
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="doc-name">{docType === "6" ? "Razón social" : "Nombre"}</Label>
            <Input id="doc-name" value={customer?.name ?? ""} onChange={(e) => setCustomer({ name: e.target.value })} />
          </div>
          {docType === "6" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="doc-address">Dirección</Label>
              <Input
                id="doc-address"
                value={customer?.address ?? ""}
                onChange={(e) => setCustomer({ address: e.target.value })}
              />
            </div>
          )}
          {value.type === "boleta" && total <= BOLETA_ANONYMOUS_MAX && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onChange({ type: "boleta", customer: null })}
            >
              Quitar cliente
            </Button>
          )}
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors.length > 0 && <p className="text-xs text-destructive">{errors[0]}</p>}
    </div>
  );
}
