import { ChartColumnIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listSaleDocumentsUseCase } from "@/application/use-cases/e-invoicing/list-sale-documents";
import { DocumentsFilters, type DocumentFilterValues } from "@/components/admin/e-invoicing/documents-filters";
import { toCardRow } from "@/components/e-invoicing/card-row";
import { DocumentCardList } from "@/components/e-invoicing/document-card-list";
import { TableSkeleton } from "@/components/layout/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SALE_DOCUMENT_STATUS_LABELS,
  type SaleDocumentStatus,
  type SaleDocumentType,
} from "@/domain/entities/sale-document";
import { storeDateKey, storeDayRange } from "@/domain/value-objects/store-time";
import { formatDayHeading } from "@/lib/day-heading";
import { formatSoles } from "@/lib/money";
import { saleDocumentRepository } from "@/infrastructure/repositories";

function parseFilters(params: Record<string, string | string[] | undefined>, today: string): DocumentFilterValues {
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const status =
    typeof params.estado === "string" && params.estado in SALE_DOCUMENT_STATUS_LABELS
      ? (params.estado as SaleDocumentStatus)
      : undefined;
  const docType = params.tipo === "boleta" || params.tipo === "factura" ? (params.tipo as SaleDocumentType) : undefined;
  return { date: date > today ? today : date, status, docType };
}

// Header (title, filters, summary cards) stays put; only the cards scroll.
async function DocumentsReport({ filters, live }: { filters: DocumentFilterValues; live: boolean }) {
  const { from, to } = storeDayRange(filters.date);
  const all = (await listSaleDocumentsUseCase(saleDocumentRepository, { from, to, docType: filters.docType })).map(
    (d) => ({ raw: d, row: toCardRow(d) }),
  );
  const documents = filters.status ? all.filter((d) => d.raw.status === filters.status) : all;

  const valid = all.filter((d) => d.raw.status === "issued" && !d.row.cancelled);
  const cancelled = all.filter((d) => d.row.cancelled);
  const review = all.filter((d) => d.raw.status === "review").length;
  const pending = all.filter((d) => d.raw.status === "queued" || d.raw.status === "failed").length;
  const cards = [
    { title: "Emitidos", value: String(valid.length), note: formatSoles(valid.reduce((s, d) => s + d.row.total, 0)) },
    { title: "Anulados", value: String(cancelled.length), note: formatSoles(cancelled.reduce((s, d) => s + d.row.total, 0)) },
    { title: "En revisión", value: String(review), note: "Esperan corrección o al contador" },
    { title: "Por emitir o con error", value: String(pending), note: "Se reintentan solos" },
  ];

  return (
    <>
      <div className="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} size="sm">
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{card.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{card.note}</CardContent>
          </Card>
        ))}
      </div>
      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto rounded-lg bg-muted/40 px-2 py-3 md:-mx-3 md:px-3">
        <DocumentCardList live={live} showCashier documents={documents.map((d) => d.row)} />
      </div>
    </>
  );
}

export default async function AdminDocumentsPage({ searchParams }: PageProps<"/admin/comprobantes">) {
  const today = storeDateKey(new Date());
  const filters = parseFilters(await searchParams, today);

  return (
    <div className="flex flex-col gap-4 md:h-[calc(100dvh-3.5rem-var(--app-footer-h)-3rem)]">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Comprobantes</h1>
          <p className="text-sm font-medium tracking-wide text-muted-foreground">
            {filters.date === today ? "HOY · " : ""}
            {formatDayHeading(filters.date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DocumentsFilters values={filters} today={today} />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/admin/comprobantes/reporte?date=${filters.date}`} />}
          >
            <ChartColumnIcon data-icon="inline-start" />
            Reporte del día
          </Button>
        </div>
      </div>
      <Suspense key={`${filters.date}-${filters.status}-${filters.docType}`} fallback={<TableSkeleton />}>
        <DocumentsReport filters={filters} live={filters.date === today} />
      </Suspense>
    </div>
  );
}
