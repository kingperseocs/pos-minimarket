import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadReceiptFormData } from "@/components/admin/inventory/form-data";
import { InvoiceForm } from "@/components/admin/inventory/invoice-form";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Button } from "@/components/ui/button";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { receivingRepository } from "@/infrastructure/repositories";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const backButton = (
  <Button
    variant="outline"
    nativeButton={false}
    render={<Link href="/admin/inventory/ingresos?factura=pendiente" />}
  >
    <ArrowLeftIcon data-icon="inline-start" />
    Ingresos
  </Button>
);

async function InvoiceContent({ id }: { id: number }) {
  const [receipt, data] = await Promise.all([
    receivingRepository.findReceiptForInvoice(id),
    loadReceiptFormData(),
  ]);
  if (!receipt) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Registrar factura · Ingreso #${receipt.id}`}
        description={
          <>
            {receipt.supplierName ?? "Sin proveedor"} · recibió{" "}
            {receipt.createdByName ?? "—"} el {dateTimeFormat.format(receipt.receivedAt)}
            {receipt.note && ` · “${receipt.note}”`}
          </>
        }
        action={backButton}
      />
      {receipt.invoiceStatus === "registered" ? (
        <EmptyState
          icon={CheckCircle2Icon}
          title="Esta factura ya fue registrada"
          description="Revisa su pago y sus diferencias en el historial de ingresos."
          action={backButton}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <InvoiceForm
            receiptId={receipt.id}
            received={receipt.lines}
            products={data.products}
            presentations={data.presentations}
          />
          <aside className="order-first flex flex-col gap-2 lg:order-last">
            <h2 className="text-sm font-medium">Foto de la factura</h2>
            {receipt.invoicePhotoUrl ? (
              <a
                href={receipt.invoicePhotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border lg:sticky lg:top-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own image route */}
                <img
                  src={receipt.invoicePhotoUrl}
                  alt="Factura del proveedor"
                  className="w-full object-contain"
                />
              </a>
            ) : (
              <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                El almacén no tomó foto. Usa la factura en papel.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default async function RegisterInvoicePage({
  params,
}: PageProps<"/admin/inventory/ingresos/[id]/factura">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoiceContent id={id} />
    </Suspense>
  );
}
