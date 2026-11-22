"use client";

import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateInvoicingSettings } from "@/actions/e-invoicing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type EInvoicingSettings, IGV_AFFECTATION_LABELS } from "@/domain/entities/sale-document";

const SERIES: { key: keyof EInvoicingSettings; label: string }[] = [
  { key: "boletaSeries", label: "Boletas" },
  { key: "facturaSeries", label: "Facturas" },
  { key: "creditNoteBoletaSeries", label: "Nota de crédito de boletas" },
  { key: "creditNoteFacturaSeries", label: "Nota de crédito de facturas" },
  { key: "debitNoteBoletaSeries", label: "Nota de débito de boletas" },
  { key: "debitNoteFacturaSeries", label: "Nota de débito de facturas" },
];

const OVERRIDE_ITEMS = [
  { value: "none", label: "Según cada producto" },
  { value: "10", label: `Todo ${IGV_AFFECTATION_LABELS["10"].toLowerCase()}` },
  { value: "20", label: `Todo ${IGV_AFFECTATION_LABELS["20"].toLowerCase()}` },
  { value: "30", label: `Todo ${IGV_AFFECTATION_LABELS["30"].toLowerCase()}` },
];

export function SettingsForm({ initial }: { initial: EInvoicingSettings }) {
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<EInvoicingSettings>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateInvoicingSettings(values);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setValues(result.data);
          toast.success("Configuración guardada.");
        });
      }}
    >
      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
        <div>
          <h2 className="font-heading text-lg font-semibold">Series</h2>
          <p className="text-sm text-muted-foreground">
            Deben existir también en el sistema de facturación. Los comprobantes nuevos usan la serie de aquí; los ya
            emitidos conservan la suya.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SERIES.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                maxLength={4}
                className="h-10 font-mono uppercase"
                value={values[key] as string}
                onChange={(e) => set({ [key]: e.target.value.toUpperCase() } as Partial<EInvoicingSettings>)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
        <div>
          <h2 className="font-heading text-lg font-semibold">IGV</h2>
          <p className="text-sm text-muted-foreground">
            Cada producto tiene su afectación (gravado por defecto). Si el contador confirma que todas tus ventas están
            exoneradas (Ley de la Amazonía), elige aquí «Todo exonerado» y se aplica a todos sin editar producto por
            producto.
          </p>
        </div>
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="global-igv">Afectación de las ventas</Label>
          <Select
            items={OVERRIDE_ITEMS}
            value={values.globalIgvOverride ?? "none"}
            onValueChange={(next) =>
              set({ globalIgvOverride: next && next !== "none" ? (next as EInvoicingSettings["globalIgvOverride"]) : null })
            }
          >
            <SelectTrigger id="global-igv" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OVERRIDE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
        <div>
          <h2 className="font-heading text-lg font-semibold">Emisión automática</h2>
          <p className="text-sm text-muted-foreground">
            Apágala solo en una emergencia (por ejemplo, un problema con SUNAT o el certificado): las ventas se siguen
            registrando y sus comprobantes quedan por emitir hasta que la vuelvas a encender.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={values.autoEmitEnabled}
            onChange={(e) => set({ autoEmitEnabled: e.target.checked })}
          />
          Emitir los comprobantes automáticamente al cobrar
        </label>
        {!values.autoEmitEnabled && (
          <p className="rounded-md bg-amber-100 p-3 text-sm font-medium text-amber-900">
            Apagada: ningún comprobante se enviará a SUNAT hasta que la enciendas.
          </p>
        )}
      </section>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon data-icon="inline-start" />}
        Guardar
      </Button>
    </form>
  );
}
