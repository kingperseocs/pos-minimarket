"use client";

import { ArrowDownToLineIcon, ArrowUpFromLineIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LocalShift } from "@/infrastructure/offline/types";
import { formatSoles } from "@/lib/money";
import {
  getShiftUi,
  getShiftUiOnServer,
  setHasOpenShift,
  type ShiftView,
  subscribeShiftUi,
} from "./shift-ui-store";

type View = ShiftView;

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
});

const toAmount = (value: string) => Math.round(Number(value) * 100) / 100;

// The open shift at the till: a status label ("Caja abierta · desde 7:02 ·
// 12 ventas") and two visible actions, money in / money out. "Cerrar caja"
// lives in the header next to "Salir" (CloseShiftButton) and opens the same
// panel, where the cashier writes what they count (never what the system
// expects).
export function ShiftMenu({
  shift,
  onMove,
  onClose,
}: {
  shift: LocalShift;
  onMove: (type: "in" | "out", amount: number, reason: string) => Promise<void>;
  onClose: (
    counted: { cash: number; yape: number; card: number },
    note: string,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("in");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [cash, setCash] = useState("");
  const [yape, setYape] = useState("");
  const [card, setCard] = useState("");
  const [note, setNote] = useState("");

  function show(next: View) {
    setView(next);
    setError(null);
    setAmount("");
    setReason("");
    setOpen(true);
  }

  // While this shift is open, the header shows "Cerrar caja".
  useEffect(() => {
    setHasOpenShift(true, shift.openedAt);
    return () => setHasOpenShift(false);
  }, [shift.openedAt]);

  // "Cerrar caja" in the header asks for the closing form.
  const { request } = useSyncExternalStore(subscribeShiftUi, getShiftUi, getShiftUiOnServer);
  const [seenRequest, setSeenRequest] = useState(request?.at ?? 0);
  if (request && request.at !== seenRequest) {
    setSeenRequest(request.at);
    show(request.view);
  }

  function submitMovement(type: "in" | "out") {
    if (!(toAmount(amount) > 0)) return setError("Escribe el monto");
    if (reason.trim().length < 3) return setError("Escribe el motivo");
    setError(null);
    startTransition(async () => {
      try {
        await onMove(type, toAmount(amount), reason.trim());
        toast.success(
          `${type === "in" ? "Entrada" : "Salida"} de ${formatSoles(toAmount(amount))} registrada`,
        );
        setOpen(false);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function submitClose() {
    const values = [cash, yape, card];
    if (values.some((v) => v === "" || Number(v) < 0)) {
      return setError("Escribe los tres montos (pon 0 si no hubo)");
    }
    setError(null);
    startTransition(async () => {
      try {
        await onClose(
          { cash: toAmount(cash), yape: toAmount(yape), card: toAmount(card) },
          note.trim(),
        );
        toast.success("Caja cerrada. ¡Gracias por tu turno!", {
          description: "El administrador revisará el cierre.",
        });
        setOpen(false);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Status only: not a button. */}
        <span
          className="flex h-9 items-center gap-2 rounded-lg border bg-emerald-500/5 px-2.5 text-sm"
          title={`Abierta a las ${timeFormat.format(new Date(shift.openedAt))} con ${formatSoles(shift.openingCash)}`}
        >
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="hidden font-medium lg:inline">Caja abierta ·</span>
          <span className="tabular-nums">
            <span className="hidden sm:inline">desde </span>
            {timeFormat.format(new Date(shift.openedAt))}
          </span>
          <span className="hidden text-muted-foreground tabular-nums md:inline">
            · {shift.salesCount} {shift.salesCount === 1 ? "venta" : "ventas"}
          </span>
        </span>
        <Button
          variant="outline"
          className="h-9 px-2.5 sm:px-3"
          aria-label="Entrada de dinero"
          title="Entrada de dinero al cajón"
          onClick={() => show("in")}
        >
          <ArrowDownToLineIcon data-icon="inline-start" className="text-emerald-600" />
          <span className="hidden sm:inline">Entrada</span>
        </Button>
        <Button
          variant="outline"
          className="h-9 px-2.5 sm:px-3"
          aria-label="Salida de dinero"
          title="Salida de dinero del cajón"
          onClick={() => show("out")}
        >
          <ArrowUpFromLineIcon data-icon="inline-start" className="text-rose-600" />
          <span className="hidden sm:inline">Salida</span>
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {view === "in" && "Entrada de dinero"}
              {view === "out" && "Salida de dinero"}
              {view === "close" && "Cerrar caja"}
            </SheetTitle>
            <SheetDescription>
              {view === "in" && "Dinero que pones en el cajón (ej. sencillo)."}
              {view === "out" &&
                "Dinero que sacas del cajón (ej. pago al contado a un proveedor)."}
              {view === "close" &&
                "Cuenta lo que hay y escríbelo. El administrador compara con el sistema."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4">
            {(view === "in" || view === "out") && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="movement-amount">Monto (S/)</Label>
                  <Input
                    id="movement-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="movement-reason">Motivo</Label>
                  <Input
                    id="movement-reason"
                    maxLength={120}
                    placeholder={
                      view === "out"
                        ? "Ej. Pago a Backus factura F020-123"
                        : "Ej. Sencillo traído por el dueño"
                    }
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </>
            )}

            {view === "close" && (
              <>
                {[
                  ["close-cash", "Efectivo contado en el cajón (S/)", cash, setCash],
                  ["close-yape", "Yape/Plin según tu celular (S/)", yape, setYape],
                  ["close-card", "Tarjeta según el voucher (S/)", card, setCard],
                ].map(([id, label, value, setter]) => (
                  <div key={id as string} className="flex flex-col gap-2">
                    <Label htmlFor={id as string}>{label as string}</Label>
                    <Input
                      id={id as string}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.10"
                      value={value as string}
                      onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="close-note">Nota</Label>
                  <Input
                    id="close-note"
                    maxLength={200}
                    placeholder="Opcional. Ej. Un billete de S/ 20 dudoso"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() =>
                    view === "close" ? submitClose() : submitMovement(view as "in" | "out")
                  }
                >
                  {isPending
                    ? "Guardando..."
                    : view === "close"
                      ? "Cerrar caja"
                      : "Registrar"}
                </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
