"use client";

import { AlertTriangleIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { BirthDateInput } from "@/components/birth-date-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatSoles } from "@/lib/money";

// Wrong birth dates allowed before redemption is blocked for this sale.
const MAX_ATTEMPTS = 3;

// Spending the worker's points needs the worker present: they confirm their
// birth date (checked against the device's worker list, so it works without
// internet). Stops a cashier from typing someone else's DNI and pocketing
// the soles their points are worth.
export function RedeemPointsDialog({
  open,
  onOpenChange,
  workerName,
  birthDate,
  points,
  soles,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  // From the worker list (null: unknown, so points can't be redeemed).
  birthDate: string | null;
  points: number;
  soles: number;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  // Remounts the date field to clear it after a wrong attempt.
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const blocked = failures >= MAX_ATTEMPTS;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTyped(null);
      setError(null);
      setAttempt((n) => n + 1);
    }
    onOpenChange(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || typed === null) return;
    if (birthDate === null || typed !== birthDate) {
      const next = failures + 1;
      setFailures(next);
      setTyped(null);
      setAttempt((n) => n + 1);
      setError(
        next >= MAX_ATTEMPTS
          ? "Demasiados intentos. En esta venta no se pueden usar los puntos."
          : "La fecha no coincide. Pide al trabajador que la diga él mismo.",
      );
      return;
    }
    onConfirm();
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-brand-orange" aria-hidden />
            Usar puntos
          </DialogTitle>
          <DialogDescription>
            {workerName} paga <strong>{formatSoles(soles)}</strong> menos con{" "}
            <strong className="tabular-nums">{points}</strong> puntos.
          </DialogDescription>
        </DialogHeader>

        {birthDate === null ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            Este trabajador no tiene fecha de nacimiento registrada. Pide al
            administrador que la complete para poder canjear.
          </p>
        ) : (
          <form id="redeem-form" onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Label htmlFor="redeem-birth-date">
              Fecha de nacimiento del trabajador
            </Label>
            <BirthDateInput
              key={attempt}
              id="redeem-birth-date"
              onChange={setTyped}
              className="tabular-nums tracking-wider"
            />
            <p className="text-xs text-muted-foreground">
              Que el trabajador la diga o la escriba él mismo.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          {birthDate !== null && (
            <Button type="submit" form="redeem-form" disabled={blocked || typed === null}>
              Aplicar −{formatSoles(soles)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
