import Link from "next/link";
import { Suspense } from "react";
import { listSaleDocumentsUseCase } from "@/application/use-cases/e-invoicing/list-sale-documents";
import { DocumentsFilters, type DocumentFilterValues } from "@/components/admin/e-invoicing/documents-filters";
import { RetryPendingButton } from "@/components/admin/e-invoicing/retry-pending-button";
import { PageHeader } from "@/components/admin/page-header";
import { DocumentStatusBadge } from "@/components/e-invoicing/document-status-badge";
import { TableSkeleton } from "@/components/layout/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  REVIEW_REASON_LABELS,
  SALE_DOCUMENT_STATUS_LABELS,
  SALE_DOCUMENT_TYPE_LABELS,
  type SaleDocumentStatus,
  type SaleDocumentType,
} from "@/domain/entities/sale-document";
import { STORE_TIME_ZONE, storeDateKey, storeDayRange } from "@/domain/value-objects/store-time";
import { formatSoles } from "@/lib/money";
import { saleDocumentRepository } from "@/infrastructure/repositories";

const time = new Intl.DateTimeFormat("es-PE", { timeStyle: "short", timeZone: STORE_TIME_ZONE });

function parseFilters(params: Record<string, string | string[] | undefined>, today: string): DocumentFilterValues {
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const status = typeof params.estado === "string" && params.estado in SALE_DOCUMENT_STATUS_LABELS
    ? (params.estado as SaleDocumentStatus)
    : undefined;
  const docType = params.tipo === "boleta" || params.tipo === "factura" ? (params.tipo as SaleDocumentType) : undefined;
  return { date: date > today ? today : date, status, docType };
}

async function DocumentsReport({ filters }: { filters: DocumentFilterValues }) {
  const { from, to } = storeDayRange(filters.date);
  const all = await listSaleDocumentsUseCase(saleDocumentRepository, { from, to, docType: filters.docType });
  const documents = filters.status ? all.filter((d) => d.status === filters.status) : all;

  const issued = all.filter((d) => d.status === "issued");
  const review = all.filter((d) => d.status === "review").length;
  const pending = all.filter((d) => d.status === "queued" || d.status === "failed").length;
  const cards = [
    { title: "Emitidos", value: String(issued.length), note: formatSoles(issued.reduce((s, d) => s + d.saleTotal, 0)) },
    { title: "En revisión", value: String(review), note: "Esperan corrección o al contador" },
    { title: "Por emitir o con error", value: String(pending), note: "Se reintentan solos" },
    { title: "Ventas del día", value: String(all.length), note: formatSoles(all.reduce((s, d) => s + d.saleTotal, 0)) },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{card.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{card.note}</CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <RetryPendingButton pending={pending} />
      </div>
      {documents.length === 0 ? (
        <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">No hay comprobantes con estos filtros.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cajero</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{time.format(d.soldAt)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/comprobantes/${d.id}`} className="font-medium underline-offset-4 hover:underline">
                      {SALE_DOCUMENT_TYPE_LABELS[d.docType]} {d.number ?? "(sin número)"}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-56 truncate">
                    {d.customerName ? `${d.customerName} · ${d.customerDocNumber}` : "Clientes varios"}
                  </TableCell>
                  <TableCell>{d.cashierName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSoles(d.saleTotal)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <DocumentStatusBadge status={d.status} motorStatus={d.motorStatus} />
                      {d.status === "review" && (
                        <span className="text-xs text-muted-foreground">
                          {d.reviewReasons.map((r) => REVIEW_REASON_LABELS[r]).join(", ")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

export default async function AdminDocumentsPage({ searchParams }: PageProps<"/admin/comprobantes">) {
  const today = storeDateKey(new Date());
  const filters = parseFilters(await searchParams, today);
  const label = new Intl.DateTimeFormat("es-PE", { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(`${filters.date}T00:00:00Z`),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Comprobantes"
        description={filters.date === today ? `Hoy, ${label}` : label}
        action={<DocumentsFilters values={filters} today={today} />}
      />
      <Suspense key={`${filters.date}-${filters.status}-${filters.docType}`} fallback={<TableSkeleton />}>
        <DocumentsReport filters={filters} />
      </Suspense>
    </div>
  );
}
