"use client";

import { TargetIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setMonthlyGoal } from "@/actions/goals";
import {
  FORM_DIALOG_CONTENT,
  FormDialogBody,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/admin/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { goalMonthName } from "./goal-copy";

const QUICK_AMOUNTS = [10000, 15000, 20000, 30000];

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function EditGoalDialog({
  open,
  onOpenChange,
  month,
  currentGoal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The store's current month (YYYY-MM).
  month: string;
  currentGoal: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState(month);
  const [amount, setAmount] = useState(String(currentGoal ?? 20000));
  const months = [month, nextMonth(month)];

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await setMonthlyGoal({ month: target, amount });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Meta de ${goalMonthName(target)} guardada`, {
        description: "El perrito ya sabe a dónde correr.",
      });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-md")}>
        <FormDialogHeader
          icon={TargetIcon}
          title="Meta mensual de ventas"
          description="Cuánto quieres vender en el mes. Si no cambias la meta, se usa la misma el mes siguiente."
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Mes</legend>
              <div className="grid grid-cols-2 gap-2">
                {months.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={target === m ? "default" : "outline"}
                    aria-pressed={target === m}
                    onClick={() => setTarget(m)}
                    className="capitalize"
                  >
                    {goalMonthName(m)}
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-amount">Meta (S/)</Label>
              <Input
                id="goal-amount"
                type="number"
                inputMode="decimal"
                min={100}
                step={100}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-semibold tabular-nums"
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setAmount(String(q))}
                  >
                    S/ {q.toLocaleString("es-PE")}
                  </Button>
                ))}
              </div>
            </div>
          </FormDialogBody>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar meta"}
            </Button>
          </FormDialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
