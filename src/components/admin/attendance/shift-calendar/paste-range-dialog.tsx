"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEK_ORDER, WEEKDAY_SHORT } from "@/domain/services/attendance";
import { datesInRange, MAX_PASTE_DATES } from "@/domain/services/work-shifts";
import { cn } from "@/lib/utils";

// "Pegar en rango": the copied shift(s) on every chosen weekday between two
// dates (e.g. Tuesday to Saturday of the next four weeks).
export function PasteRangeDialog({
  open,
  label,
  defaultFrom,
  pending,
  onClose,
  onPaste,
}: {
  open: boolean;
  label: string;
  defaultFrom: string;
  pending: boolean;
  onClose: () => void;
  onPaste: (dates: string[], overwrite: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <PasteRangeForm
            label={label}
            defaultFrom={defaultFrom}
            pending={pending}
            onPaste={onPaste}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PasteRangeForm({
  label,
  defaultFrom,
  pending,
  onPaste,
}: {
  label: string;
  defaultFrom: string;
  pending: boolean;
  onPaste: (dates: string[], overwrite: boolean) => void;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultFrom);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [overwrite, setOverwrite] = useState(false);
  const dates = from && to ? datesInRange(from, to, weekdays) : [];
  const tooMany = dates.length > MAX_PASTE_DATES;

  const toggle = (weekday: number) =>
    setWeekdays((current) =>
      current.includes(weekday) ? current.filter((w) => w !== weekday) : [...current, weekday],
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pegar en varios días</DialogTitle>
        <DialogDescription>Copiado: {label}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="paste-from">Desde</Label>
            <Input id="paste-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="paste-to">Hasta</Label>
            <Input id="paste-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Días de la semana</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((weekday) => (
              <button
                key={weekday}
                type="button"
                aria-pressed={weekdays.includes(weekday)}
                onClick={() => toggle(weekday)}
                className={cn(
                  "h-8 w-10 rounded-md border text-sm font-medium transition-colors",
                  weekdays.includes(weekday)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {WEEKDAY_SHORT[weekday]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          Reemplazar si la persona ya tiene turno ese día
        </label>
        <p className={cn("text-sm", tooMany ? "text-destructive" : "text-muted-foreground")}>
          {tooMany
            ? `Son ${dates.length} días: máximo ${MAX_PASTE_DATES} por vez.`
            : `Se pegará en ${dates.length} día${dates.length === 1 ? "" : "s"}.`}
        </p>
      </div>
      <DialogFooter>
        <Button
          onClick={() => onPaste(dates, overwrite)}
          disabled={pending || dates.length === 0 || tooMany}
        >
          {pending ? "Pegando…" : "Pegar"}
        </Button>
      </DialogFooter>
    </>
  );
}
