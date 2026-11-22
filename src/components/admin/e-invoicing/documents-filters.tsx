"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SALE_DOCUMENT_STATUS_LABELS,
  SALE_DOCUMENT_TYPE_LABELS,
  type SaleDocumentStatus,
  type SaleDocumentType,
} from "@/domain/entities/sale-document";
import { addDays } from "@/domain/services/attendance";

export interface DocumentFilterValues {
  date: string;
  status?: SaleDocumentStatus;
  docType?: SaleDocumentType;
}

function href(values: DocumentFilterValues) {
  const params = new URLSearchParams({ date: values.date });
  if (values.status) params.set("estado", values.status);
  if (values.docType) params.set("tipo", values.docType);
  return `/admin/comprobantes?${params}`;
}

const STATUS_ITEMS = [{ value: "all", label: "Todos los estados" }].concat(
  (Object.keys(SALE_DOCUMENT_STATUS_LABELS) as SaleDocumentStatus[]).map((s) => ({
    value: s,
    label: SALE_DOCUMENT_STATUS_LABELS[s],
  })),
);
const TYPE_ITEMS = [
  { value: "all", label: "Boletas y facturas" },
  { value: "boleta", label: SALE_DOCUMENT_TYPE_LABELS.boleta },
  { value: "factura", label: SALE_DOCUMENT_TYPE_LABELS.factura },
];

// ‹ day › + status + type, all in the URL (shareable, back button works).
export function DocumentsFilters({ values, today }: { values: DocumentFilterValues; today: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const go = (next: Partial<DocumentFilterValues>) =>
    startTransition(() => router.push(href({ ...values, ...next })));

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={isPending}>
      <Button size="icon" variant="outline" aria-label="Día anterior" onClick={() => go({ date: addDays(values.date, -1) })}>
        <ChevronLeftIcon />
      </Button>
      <Input
        type="date"
        aria-label="Fecha"
        value={values.date}
        max={today}
        onChange={(e) => e.target.value && go({ date: e.target.value })}
        className="w-40"
      />
      <Button
        size="icon"
        variant="outline"
        aria-label="Día siguiente"
        disabled={values.date >= today}
        onClick={() => go({ date: addDays(values.date, 1) })}
      >
        <ChevronRightIcon />
      </Button>
      {values.date !== today && (
        <Button size="sm" variant="ghost" onClick={() => go({ date: today })}>
          Hoy
        </Button>
      )}
      <Select
        items={STATUS_ITEMS}
        value={values.status ?? "all"}
        onValueChange={(next) => go({ status: next && next !== "all" ? (next as SaleDocumentStatus) : undefined })}
      >
        <SelectTrigger className="w-44" aria-label="Estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={TYPE_ITEMS}
        value={values.docType ?? "all"}
        onValueChange={(next) => go({ docType: next && next !== "all" ? (next as SaleDocumentType) : undefined })}
      >
        <SelectTrigger className="w-44" aria-label="Tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
