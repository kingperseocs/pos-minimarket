import { ArrowLeftIcon, PackageOpenIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { loadReceiptFormData } from "@/components/admin/inventory/form-data";
import { ReceiptForm } from "@/components/admin/inventory/receipt-form";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/layout/page-skeleton";

async function NewReceiptContent() {
  const data = await loadReceiptFormData();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingresar mercadería al Almacén"
        description="Registra lo que llegó del proveedor. Suma al stock del Almacén y actualiza el precio de compra."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/inventory/ingresos" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Historial de ingresos
          </Button>
        }
      />
      {data.products.length === 0 ? (
        <EmptyState
          icon={PackageOpenIcon}
          title="Primero registra tus productos"
          description="Para ingresar mercadería necesitas tener productos registrados."
          action={
            <Button nativeButton={false} render={<Link href="/admin/products" />}>
              Ir a Productos
            </Button>
          }
        />
      ) : (
        <ReceiptForm
          {...data}
          doneHref="/admin/inventory/ingresos"
        />
      )}
    </div>
  );
}

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewReceiptContent />
    </Suspense>
  );
}
