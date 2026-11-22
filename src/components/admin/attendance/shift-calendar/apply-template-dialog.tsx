"use client";

import { CalendarRangeIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyShiftTemplate } from "@/actions/attendance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pasteSummary } from "./paste-summary";

// Fills the calendar from the weekly template (e.g. the whole next month in
// one click). Days already planned are kept unless "Reemplazar".
export function ApplyTemplateDialog({
  defaultFrom,
  defaultTo,
  onApplied,
}: {
  defaultFrom: string;
  defaultTo: string;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyShiftTemplate({ from, to, overwrite });
      if (!result.ok) return setError(result.error);
      toast.success(pasteSummary(result.data));
      setOpen(false);
      onApplied?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <CalendarRangeIcon />
            Aplicar plantilla semanal
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar plantilla semanal</DialogTitle>
          <DialogDescription>
            Crea en el calendario los turnos de la plantilla semanal de cada persona entre estas
            fechas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-from">Desde</Label>
              <Input id="template-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-to">Hasta</Label>
              <Input id="template-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Reemplazar los turnos que ya estén planificados
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={apply} disabled={isPending || !from || !to}>
            {isPending ? "Aplicando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
