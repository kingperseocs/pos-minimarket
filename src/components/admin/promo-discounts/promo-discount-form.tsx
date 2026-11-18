"use client";

import { PercentIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createPromoDiscount,
  renamePromoDiscount,
} from "@/actions/promo-discounts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  type DialogHandle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FORM_DIALOG_CONTENT,
  FormDialogBody,
  FormDialogFooter,
  RequiredLegend,
  FormDialogHeader,
  toastCleared,
} from "../form-dialog";
import { useFormDraft } from "@/hooks/use-form-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PROMO_PERCENT_MAX,
  PROMO_PERCENT_MIN,
} from "@/domain/entities/promo-discount";
import { formatSoles } from "@/lib/money";

export type EditablePromoDiscount = {
  id: number;
  name: string;
  percent: number;
};

// Example basket shown while typing the percent, so the admin sees what the
// cashier will charge.
const EXAMPLE_PRICE = 10;

export function PromoDiscountForm({
  discount,
  trigger,
  handle,
}: {
  // Absent: create. Present: rename (the percent is fixed once created).
  discount?: EditablePromoDiscount;
  trigger?: React.ReactElement;
  // Without a trigger, opened through `handle` (a row's "⋮" menu).
  handle?: DialogHandle;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const savedForm = {
    name: discount?.name ?? "",
    percent: discount ? String(discount.percent) : "",
  };
  type FormState = typeof savedForm;
  // Unsaved changes survive closing the dialog by accident.
  const draft = useFormDraft({
    key: `promo:${discount?.id ?? "new"}`,
    values: { name, percent },
    baseline: savedForm,
    enabled: open,
  });

  function applyForm(next: FormState) {
    setName(next.name ?? savedForm.name);
    // The percent of an existing discount is fixed.
    setPercent(discount ? savedForm.percent : (next.percent ?? ""));
  }

  function handleClear() {
    const before = { name, percent };
    applyForm(savedForm);
    draft.clear();
    setError(null);
    toastCleared(
      () => applyForm(before),
      discount ? "Cambios deshechos" : "Campos limpiados",
    );
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      applyForm(draft.restore() ?? savedForm);
      setError(null);
    }
    setOpen(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = discount
        ? await renamePromoDiscount({ id: discount.id, name })
        : await createPromoDiscount({ name, percent });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(discount ? "Descuento actualizado" : "Descuento creado");
      draft.clear();
      setOpen(false);
    });
  }

  const pct = Number(percent);
  const validPct =
    Number.isInteger(pct) && pct >= PROMO_PERCENT_MIN && pct <= PROMO_PERCENT_MAX;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      handle={handle}
      disablePointerDismissal
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-md")}>
        <FormDialogHeader
          icon={PercentIcon}
          title={discount ? "Editar descuento" : "Nuevo descuento %"}
          description="Porcentaje que la cajera puede dar a un trabajador identificado con su DNI, en las primeras unidades de la compra."
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <RequiredLegend />
            <div className="flex flex-col gap-2">
              <Label htmlFor="promo-name" required>Nombre</Label>
              <Input
                id="promo-name"
                value={name}
                maxLength={40}
                placeholder="Ej. Promo fin de mes"
                onChange={(event) => setName(event.target.value)}
                aria-invalid={error !== null}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="promo-percent" required>Porcentaje</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="promo-percent"
                  type="number"
                  inputMode="numeric"
                  min={PROMO_PERCENT_MIN}
                  max={PROMO_PERCENT_MAX}
                  step={1}
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                  disabled={discount !== undefined}
                  className="w-24"
                  required
                />
                <span className="text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {discount
                  ? "El porcentaje no se puede cambiar. Para ofrecer otro, crea un descuento nuevo y desactiva este."
                  : validPct
                    ? `Ej. un producto de ${formatSoles(EXAMPLE_PRICE)} se cobra ${formatSoles(
                        EXAMPLE_PRICE - (EXAMPLE_PRICE * pct) / 100,
                      )}.`
                    : `Entre ${PROMO_PERCENT_MIN}% y ${PROMO_PERCENT_MAX}%. Una vez creado no se puede cambiar.`}
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

          </FormDialogBody>
          <FormDialogFooter
            onClear={handleClear}
            clearLabel={discount ? "Deshacer cambios" : "Limpiar"}
            clearDisabled={isPending}
            draftStatus={draft.status}
          >
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </FormDialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
