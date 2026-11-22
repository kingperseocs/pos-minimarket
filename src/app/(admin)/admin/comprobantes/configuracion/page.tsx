import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { getSettingsUseCase } from "@/application/use-cases/e-invoicing/settings";
import { SettingsForm } from "@/components/admin/e-invoicing/settings-form";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { eInvoicingSettingsRepository } from "@/infrastructure/repositories";

// Series, IGV and the automatic-emission switch of the electronic documents.
export default async function InvoicingSettingsPage() {
  const settings = await getSettingsUseCase(eInvoicingSettingsRepository);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configuración de comprobantes"
        description="Series, IGV y emisión automática."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/comprobantes" />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Comprobantes
          </Button>
        }
      />
      <SettingsForm initial={settings} />
    </div>
  );
}
