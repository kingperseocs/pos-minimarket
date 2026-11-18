import { ArrowLeftIcon, PackageOpenIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { loadReceptionData } from "@/components/admin/inventory/form-data";
import { ReceptionWorkspace } from "@/components/warehouse/reception-workspace";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/layout/page-skeleton";

async function ReceiptContent() {
  const data = await loadReceptionData();
  return data.products.length === 0 ? (
    <EmptyState
      icon={PackageOpenIcon}
      title="Aún no hay productos"
      description="Pide al administrador que registre los productos; luego podrás ingresar su mercadería."
    />
  ) : (
    <ReceptionWorkspace {...data} />
  );
}

export default function WarehouseReceiptPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver al almacén"
          nativeButton={false}
          render={<Link href="/almacen" />}
        >
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="font-heading text-xl font-semibold">Recibir mercadería</h1>
          <p className="text-sm text-muted-foreground">
            Cuenta lo que dejó el proveedor. La factura la registra el administrador.
          </p>
        </div>
      </div>
      <Suspense fallback={<TableSkeleton rows={3} />}>
        <ReceiptContent />
      </Suspense>
    </div>
  );
}
