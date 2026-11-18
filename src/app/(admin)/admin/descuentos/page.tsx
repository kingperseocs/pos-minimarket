import { PercentIcon, PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { listPromoDiscountsUseCase } from "@/application/use-cases/promo-discounts/manage-promo-discounts";
import { PageHeader } from "@/components/admin/page-header";
import { PromoDiscountForm } from "@/components/admin/promo-discounts/promo-discount-form";
import { PromoDiscountTable } from "@/components/admin/promo-discounts/promo-discount-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { promoDiscountRepository } from "@/infrastructure/repositories";

function NewDiscountButton({ label }: { label: string }) {
  return (
    <PromoDiscountForm
      trigger={
        <Button>
          <PlusIcon data-icon="inline-start" />
          {label}
        </Button>
      }
    />
  );
}

async function DiscountsContent() {
  const discounts = await listPromoDiscountsUseCase(promoDiscountRepository);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Descuentos %"
        description="Porcentajes que la cajera puede dar a un trabajador después de escribir su DNI. Se aplican a las primeras unidades de la compra (según las reglas en Trabajadores) y cada uso queda registrado en la venta."
        action={<NewDiscountButton label="Nuevo descuento" />}
      />
      {discounts.length === 0 ? (
        <EmptyState
          icon={PercentIcon}
          title="Aún no hay descuentos"
          description="Crea las opciones, por ejemplo 10%, 20% y 30%. La cajera las verá en la cesta al identificar a un trabajador."
          action={<NewDiscountButton label="Crear el primer descuento" />}
        />
      ) : (
        <PromoDiscountTable discounts={discounts} />
      )}
    </div>
  );
}

export default function AdminDiscountsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DiscountsContent />
    </Suspense>
  );
}
