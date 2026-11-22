import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { listSaleDocumentsUseCase } from "@/application/use-cases/e-invoicing/list-sale-documents";
import { TodayDocuments } from "@/components/pos/today-documents";
import { Button } from "@/components/ui/button";
import { can } from "@/domain/entities/user";
import { storeDateKey, storeDayRange } from "@/domain/value-objects/store-time";
import { formatDayHeading } from "@/lib/day-heading";
import { requirePagePermission } from "@/infrastructure/auth/guards";
import { saleDocumentRepository } from "@/infrastructure/repositories";

// The cashier's electronic documents of today, to reprint them or see which
// are still being issued. An admin at the till sees every cashier's.
export default async function CashierDocumentsPage() {
  const user = await requirePagePermission("sell");
  const today = storeDateKey(new Date());
  const { from, to } = storeDayRange(today);
  const documents = await listSaleDocumentsUseCase(saleDocumentRepository, {
    from,
    to,
    cashierId: can(user.role, "manage") ? undefined : user.id,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-semibold">Comprobantes de hoy</h1>
          <p className="text-sm font-medium tracking-wide text-muted-foreground">{formatDayHeading(today)}</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/pos" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Volver a caja
        </Button>
      </div>
      <TodayDocuments
        documents={documents.map((d) => ({
          id: d.id,
          docType: d.docType,
          number: d.number,
          status: d.status,
          motorStatus: d.motorStatus,
          customerName: d.customerName,
          customerDocNumber: d.customerDocNumber,
          total: d.saleTotal,
          soldAt: d.soldAt.toISOString(),
          lastError: d.lastError,
          reviewReasons: d.reviewReasons,
        }))}
      />
    </div>
  );
}
