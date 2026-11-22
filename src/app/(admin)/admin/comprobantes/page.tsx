import { BanIcon, ChartColumnIcon, CircleCheckBigIcon, SendIcon, SettingsIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listSaleDocumentsUseCase } from "@/application/use-cases/e-invoicing/list-sale-documents";
import { DocumentsFilters, type DocumentFilterValues } from "@/components/admin/e-invoicing/documents-filters";
import { toCardRow } from "@/components/e-invoicing/card-row";
import { DocumentCardList } from "@/components/e-invoicing/document-card-list";
import { TableSkeleton } from "@/components/layout/page-skeleton";
import { Button } from "@/components/ui/button";
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
    {
      title: "Emitidos",
      value: valid.length,
      note: formatSoles(valid.reduce((s, d) => s + d.row.total, 0)),
      icon: CircleCheckBigIcon,
      tone: "bg-emerald-50 ring-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:ring-emerald-900 dark:text-emerald-100",
      accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    },
    {
      title: "Anulados",
      value: cancelled.length,
      note: formatSoles(cancelled.reduce((s, d) => s + d.row.total, 0)),
      icon: BanIcon,
      tone: "bg-red-50 ring-red-200 text-red-900 dark:bg-red-950/40 dark:ring-red-900 dark:text-red-100",
      accent: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    },
    {
      title: "En revisión",
      value: review,
      note: "Esperan corrección o al contador",
      icon: TriangleAlertIcon,
      tone: "bg-yellow-50 ring-yellow-200 text-yellow-900 dark:bg-yellow-950/40 dark:ring-yellow-900 dark:text-yellow-100",
      accent: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300",
    },
    {
      title: "Por emitir o con error",
      value: pending,
      note: "Se reintentan solos",
      icon: SendIcon,
      tone: "bg-sky-50 ring-sky-200 text-sky-900 dark:bg-sky-950/40 dark:ring-sky-900 dark:text-sky-100",
      accent: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
    },
  ];

  return (
    <>
      {/* Pastel summary cards, the same colours as the document cards. */}
      <div className="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, note, icon: Icon, tone, accent }) => (
          <div key={title} className={`flex items-center gap-4 rounded-xl p-4 shadow-sm ring-1 ${tone}`}>
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${accent}`}>
              <Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-3xl leading-tight font-bold tabular-nums">{value}</p>
              <p className="truncate text-sm font-semibold opacity-80">{note}</p>
            </div>
          </div>
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
          <Button variant="outline" size="icon" aria-label="Configuración" nativeButton={false} render={<Link href="/admin/comprobantes/configuracion" />}>
            <SettingsIcon />
          </Button>
        </div>
      </div>
      <Suspense key={`${filters.date}-${filters.status}-${filters.docType}`} fallback={<TableSkeleton />}>
        <DocumentsReport filters={filters} live={filters.date === today} />
      </Suspense>
    </div>
  );
}
