import { FileTextIcon, ImageIcon, PackagePlusIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listReceiptsUseCase } from "@/application/use-cases/inventory/receive-goods";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { MarkReceiptPaidDialog, UndoReceiptPaymentButton } from "@/components/admin/inventory/receipt-payment-dialog";
import {
  type GoodsReceipt,
  RECEIPT_DOC_TYPE_LABELS,
  SUPPLIER_PAYMENT_METHOD_LABELS,
} from "@/domain/entities/receiving";
import { daysUntilDue } from "@/domain/services/receiving";
import { round2 } from "@/domain/value-objects/money";
import { STORE_TIME_ZONE, storeDateKey } from "@/domain/value-objects/store-time";
import { cn } from "@/lib/utils";
import { receivingRepository } from "@/infrastructure/repositories";
import { formatSoles } from "@/lib/money";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Fecha" },
  { label: "Proveedor" },
  { label: "Documento" },
  { label: "Productos" },
  { label: "Total", className: "text-right" },
  { label: "Pago" },
  { label: "Registró" },
];

const dueFormat = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

type Filter = "all" | "unpaid" | "uninvoiced";

// "Falta factura" (counted by the Almacén, waiting for the invoice), then
// "Por pagar · vence 22/11" (red once overdue) or "Pagado · Yape/Plin".
function PaymentCell({ receipt, today }: { receipt: GoodsReceipt; today: string }) {
  if (receipt.invoiceStatus === "pending") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="outline" className="border-sky-500/40 text-sky-700 dark:text-sky-400">
          Falta factura
        </Badge>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={`/admin/inventory/ingresos/${receipt.id}/factura`} />}
        >
          <FileTextIcon data-icon="inline-start" />
          Registrar factura
        </Button>
      </div>
    );
  }
  if (receipt.paymentStatus === "paid") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">
          Pagado
          {receipt.paidMethod && ` · ${SUPPLIER_PAYMENT_METHOD_LABELS[receipt.paidMethod]}`}
        </Badge>
        {receipt.paidByName && (
          <span className="text-xs text-muted-foreground">por {receipt.paidByName}</span>
        )}
        {receipt.paidAt && <UndoReceiptPaymentButton receiptId={receipt.id} />}
      </div>
    );
  }
  const days = receipt.dueDate ? daysUntilDue(receipt.dueDate, today) : 0;
  const due = receipt.dueDate
    ? dueFormat.format(new Date(`${receipt.dueDate}T00:00:00Z`))
    : null;
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge
        variant="outline"
        className={cn(
          days < 0
            ? "border-destructive/40 text-destructive"
            : "text-amber-700 dark:text-amber-400",
        )}
      >
        {days < 0 ? "Vencida" : "Por pagar"}
        {due && ` · ${days === 0 ? "hoy" : `vence ${due}`}`}
      </Badge>
      <MarkReceiptPaidDialog
        receiptId={receipt.id}
        total={receipt.total ?? 0}
        label={[receipt.supplierName, receipt.docNumber].filter(Boolean).join(" · ") || `Ingreso #${receipt.id}`}
      />
    </div>
  );
}

const newReceiptButton = (
  <Button
    nativeButton={false}
    render={<Link href="/admin/inventory/ingresos/nuevo" />}
  >
    <PlusIcon data-icon="inline-start" />
    Ingresar mercadería
  </Button>
);

async function ReceiptsContent({ filter }: { filter: Filter }) {
  const all = await listReceiptsUseCase(receivingRepository);
  const today = storeDateKey(new Date());
  const uninvoiced = all.filter((r) => r.invoiceStatus === "pending");
  const unpaid = all.filter(
    (r) => r.invoiceStatus === "registered" && r.paymentStatus === "pending",
  );
  const overdue = unpaid.filter((r) => r.dueDate && daysUntilDue(r.dueDate, today) < 0);
  const receipts = filter === "unpaid" ? unpaid : filter === "uninvoiced" ? uninvoiced : all;
  const tab = (value: Filter, href: string, label: string) => (
    <Button
      size="sm"
      variant={filter === value ? "default" : "outline"}
      nativeButton={false}
      render={<Link href={href} />}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingresos al Almacén"
        description="Toda la mercadería que entró, con su documento."
        action={newReceiptButton}
      />
      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tab("all", "/admin/inventory/ingresos", "Todos")}
          {tab(
            "uninvoiced",
            "/admin/inventory/ingresos?factura=pendiente",
            `Sin factura (${uninvoiced.length})`,
          )}
          {tab("unpaid", "/admin/inventory/ingresos?pago=pendiente", `Por pagar (${unpaid.length})`)}
          {unpaid.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Debes{" "}
              <strong className="text-foreground tabular-nums">
                {formatSoles(round2(unpaid.reduce((sum, r) => sum + (r.total ?? 0), 0)))}
              </strong>
              {overdue.length > 0 && (
                <span className="text-destructive">
                  {" "}· {overdue.length} {overdue.length === 1 ? "vencida" : "vencidas"}
                </span>
              )}
            </span>
          )}
        </div>
      )}
      {filter !== "all" && receipts.length === 0 ? (
        <p className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {filter === "unpaid"
            ? "No hay facturas por pagar."
            : "Todas las recepciones del Almacén ya tienen su factura."}
        </p>
      ) : receipts.length === 0 ? (
        <EmptyState
          icon={PackagePlusIcon}
          title="Aún no ingresó mercadería"
          description="Cuando llegue un pedido del proveedor, regístralo aquí. Así el stock empieza en el Almacén."
          action={newReceiptButton}
        />
      ) : (
        <DataTable columns={COLUMNS} isEmpty={false}>
          {receipts.map((receipt) => (
            <TableRow key={receipt.id}>
              <IdCell id={receipt.id} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateTimeFormat.format(receipt.receivedAt)}
              </TableCell>
              <TableCell>{receipt.supplierName ?? "—"}</TableCell>
              <TableCell className="text-sm">
                {receipt.invoiceStatus === "pending" ? (
                  <span className="text-muted-foreground">Por registrar</span>
                ) : (
                  RECEIPT_DOC_TYPE_LABELS[receipt.docType]
                )}
                {receipt.docNumber && (
                  <div className="font-mono text-xs text-muted-foreground">
                    {receipt.docNumber}
                  </div>
                )}
                {receipt.invoicePhotoUrl && (
                  <a
                    href={receipt.invoicePhotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ImageIcon className="size-3" />
                    Foto
                  </a>
                )}
              </TableCell>
              <TableCell className="max-w-96 text-sm">
                <ul className="flex flex-col gap-0.5">
                  {receipt.lines.map((line, index) => (
                    <li key={index}>
                      {line.quantity} {line.presentationName ?? "und"}{" "}
                      {line.productName}
                      <span className="text-muted-foreground">
                        {" "}
                        · {line.units} und
                      </span>
                      {receipt.invoiceStatus === "registered" &&
                        line.receivedUnits !== line.units && (
                        <Badge
                          variant="outline"
                          className="ml-1 text-amber-700 dark:text-amber-400"
                        >
                          {line.receivedUnits < line.units
                            ? `Faltaron ${line.units - line.receivedUnits}`
                            : `Sobraron ${line.receivedUnits - line.units}`}
                        </Badge>
                      )}
                      {line.discountPercent > 0 && (
                        <Badge variant="outline" className="ml-1">
                          −{line.discountPercent}%
                        </Badge>
                      )}
                      {line.isBonus && (
                        <Badge
                          variant="outline"
                          className="ml-1 text-emerald-700 dark:text-emerald-400"
                        >
                          Regalo
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {receipt.total === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  formatSoles(receipt.total)
                )}
              </TableCell>
              <TableCell>
                <PaymentCell receipt={receipt} today={today} />
              </TableCell>
              <TableCell className="text-sm">
                {receipt.createdByName ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

export default async function ReceiptsPage({
  searchParams,
}: PageProps<"/admin/inventory/ingresos">) {
  const { pago, factura } = await searchParams;
  const filter: Filter =
    factura === "pendiente" ? "uninvoiced" : pago === "pendiente" ? "unpaid" : "all";
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReceiptsContent filter={filter} />
    </Suspense>
  );
}
