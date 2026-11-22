import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { listSaleDocumentsUseCase } from "@/application/use-cases/e-invoicing/list-sale-documents";
import { DocumentsDayNav } from "@/components/pos/documents-day-nav";
import { TodayDocuments } from "@/components/pos/today-documents";
import { Button } from "@/components/ui/button";
import { can } from "@/domain/entities/user";
import { storeDateKey, storeDayRange } from "@/domain/value-objects/store-time";
import { requirePagePermission } from "@/infrastructure/auth/guards";
import { saleDocumentRepository } from "@/infrastructure/repositories";

// The cashier's electronic documents, one day at a time (today by default),
// KeyFacil-style. A cashier sees the sales they charged; an admin at the
// till sees every cashier's.
export default async function CashierDocumentsPage({ searchParams }: PageProps<"/pos/comprobantes">) {
  const user = await requirePagePermission("sell");
  const today = storeDateKey(new Date());
  const requested = (await searchParams).date;
  const date =
    typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const { from, to } = storeDayRange(date);
  const documents = await listSaleDocumentsUseCase(saleDocumentRepository, {
    from,
    to,
    cashierId: can(user.role, "manage") ? undefined : user.id,
  });

  return (
    <div className="min-h-full bg-muted/40">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/pos" />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Volver a caja
          </Button>
        </div>
        <DocumentsDayNav date={date} today={today} />
        <TodayDocuments
          live={date === today}
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
    </div>
  );
}
