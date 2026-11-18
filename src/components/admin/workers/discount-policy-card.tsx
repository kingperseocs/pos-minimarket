"use client";

import { BadgePercentIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDiscountPolicy } from "@/actions/workers";
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
import { formatSoles } from "@/lib/money";

export type PolicyView = {
  maxDiscountedUnitsPerDay: number;
  pointsPerSol: number;
  redeemPointsPerSol: number;
  minRedeemPoints: number;
  birthdayGiftMaxAmount: number;
  createdAt: string;
  createdByName: string | null;
};

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function DiscountPolicyCard({
  active,
  versions,
}: {
  active: PolicyView | null;
  versions: PolicyView[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs md:flex-row md:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
        <BadgePercentIcon className="size-5" aria-hidden />
      </span>
      <div className="flex-1 space-y-1">
        <p className="text-sm text-muted-foreground">Reglas del descuento vigentes</p>
        {active ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <li>
              El <strong>%</strong> que elija la cajera (
              <Link href="/admin/descuentos" className="underline">
                Descuentos %
              </Link>
              )
            </li>
            <li>
              En <strong>{active.maxDiscountedUnitsPerDay}</strong> productos de una
              compra de {active.maxDiscountedUnitsPerDay} o más · 1 compra con descuento al día
            </li>
            <li>
              {active.birthdayGiftMaxAmount > 0 ? (
                <>
                  Regalo de cumpleaños hasta{" "}
                  <strong>{formatSoles(active.birthdayGiftMaxAmount)}</strong>
                </>
              ) : (
                "Sin regalo de cumpleaños"
              )}
            </li>
            <li>
              <strong>{active.pointsPerSol}</strong> punto(s) por cada S/ 1
            </li>
            <li>
              {active.redeemPointsPerSol > 0 ? (
                <>
                  Canje: <strong>{active.redeemPointsPerSol}</strong> pts = S/ 1
                  {active.minRedeemPoints > 0 && (
                    <> (desde {active.minRedeemPoints} pts)</>
                  )}
                </>
              ) : (
                "Sin canje de puntos"
              )}
            </li>
          </ul>
        ) : (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Aún no configuraste el descuento: los trabajadores no reciben descuento.
          </p>
        )}
      </div>
      <Button variant={active ? "outline" : "default"} onClick={() => setOpen(true)}>
        <SettingsIcon data-icon="inline-start" />
        {active ? "Cambiar reglas" : "Configurar descuento"}
      </Button>
      <PolicyDialog open={open} onOpenChange={setOpen} active={active} versions={versions} />
    </div>
  );
}

function PolicyDialog({
  open,
  onOpenChange,
  active,
  versions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: PolicyView | null;
  versions: PolicyView[];
}) {
  const [isPending, startTransition] = useTransition();
  const [units, setUnits] = useState(String(active?.maxDiscountedUnitsPerDay ?? 3));
  const [points, setPoints] = useState(String(active?.pointsPerSol ?? 1));
  const [gift, setGift] = useState(String(active?.birthdayGiftMaxAmount ?? 10));
  const [redeemRate, setRedeemRate] = useState(String(active?.redeemPointsPerSol ?? 0));
  const [redeemMin, setRedeemMin] = useState(String(active?.minRedeemPoints ?? 0));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateDiscountPolicy({
        maxDiscountedUnitsPerDay: Number(units),
        pointsPerSol: Number(points),
        redeemPointsPerSol: Number(redeemRate),
        minRedeemPoints: Number(redeemMin),
        birthdayGiftMaxAmount: Number(gift),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Reglas del descuento actualizadas", {
        description: "Las cajas las aplicarán en unos minutos.",
      });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reglas del descuento para trabajadores</DialogTitle>
          <DialogDescription>
            Los porcentajes (10%, 20%…) se configuran en Descuentos %; la cajera
            elige uno al identificar al trabajador con su DNI.
            Aquí van los límites, el regalo de cumpleaños y los puntos. Los cambios se guardan como una versión
            nueva: las ventas anteriores conservan la regla con la que se
            cobraron.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="units"
              label="Productos con descuento por compra (mínimo para aplicar)"
              hint="Ej. 3: con 3 o más productos, el % va en 3; con 1 o 2, sin descuento. Una compra con descuento al día."
              value={units}
              onChange={setUnits}
              step="1"
              min="1"
              max="50"
            />
            <Field
              id="gift"
              label="Regalo de cumpleaños hasta (S/)"
              hint="Un producto gratis el día de su cumpleaños, una vez al año. 0 = sin regalo."
              value={gift}
              onChange={setGift}
              step="0.5"
              min="0"
              max="500"
            />
            <Field
              id="points"
              label="Puntos por cada S/ 1"
              hint="Los puntos se suman en cada compra."
              value={points}
              onChange={setPoints}
              step="0.5"
              min="0"
              max="100"
            />
            <Field
              id="redeem-rate"
              label="Puntos que valen S/ 1 al canjear"
              hint="Ej. 100: con 500 puntos el trabajador paga S/ 5 menos. 0 = sin canje."
              value={redeemRate}
              onChange={setRedeemRate}
              step="1"
              min="0"
              max="100000"
            />
            <Field
              id="redeem-min"
              label="Mínimo de puntos para canjear"
              hint="Por debajo de este saldo la caja no ofrece el canje."
              value={redeemMin}
              onChange={setRedeemMin}
              step="1"
              min="0"
              max="1000000"
            />
          </div>

          {versions.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Historial de cambios ({versions.length})
              </summary>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {versions.map((v) => (
                  <li key={v.createdAt} className="flex justify-between gap-3">
                    <span>
                      {v.maxDiscountedUnitsPerDay} prod./compra (1 al día) · regalo{" "}
                      {formatSoles(v.birthdayGiftMaxAmount)} · {v.pointsPerSol} pt/S/1
                      {v.redeemPointsPerSol > 0 && ` · canje ${v.redeemPointsPerSol} pts = S/ 1`}
                    </span>
                    <span className="shrink-0">
                      {dateFormat.format(new Date(v.createdAt))}
                      {v.createdByName ? ` · ${v.createdByName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar reglas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  ...inputProps
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} required>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
