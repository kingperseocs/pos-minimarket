"use client";

import {
  CalendarClockIcon,
  ClockIcon,
  DatabaseIcon,
  InfoIcon,
  LogOutIcon,
  type LucideIcon,
  ScanBarcodeIcon,
  WalletIcon,
  WifiIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const ITEMS: { icon: LucideIcon; label: string; text: string }[] = [
  {
    icon: ClockIcon,
    label: "Entrada 07:04",
    text: "Hora en que marcaste tu entrada. Tócalo al final del turno para marcar tu salida.",
  },
  {
    icon: WalletIcon,
    label: "Caja abierta",
    text: "Tu caja del turno: registra entradas o salidas de dinero y ciérrala al terminar.",
  },
  {
    icon: CalendarClockIcon,
    label: "Por vencer",
    text: "Productos de la góndola que vencen pronto o ya vencieron. Solo aparece si hay alguno.",
  },
  {
    icon: DatabaseIcon,
    label: "Catálogo de hace…",
    text: "La lista de productos es una copia guardada sin internet. Conéctate y recarga para ver lo nuevo.",
  },
  {
    icon: ScanBarcodeIcon,
    label: "Lector listo / Sin bip",
    text: "Estado del lector de códigos. Si no suena el bip al disparar, vuelve a disparar.",
  },
  {
    icon: WifiIcon,
    label: "En línea / Sin conexión",
    text: "Indica si las ventas llegan al servidor. Sin internet puedes seguir vendiendo: las pendientes se envían solas al volver la conexión.",
  },
  {
    icon: LogOutIcon,
    label: "Salir",
    text: "Cierra tu sesión. No marca tu salida de la jornada.",
  },
];

// The "i" next to the till's status buttons: what each one is for.
export function PosHelp() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="¿Qué es cada botón?"
            className="text-muted-foreground"
          />
        }
      >
        <InfoIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>¿Qué es cada botón?</PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col gap-2.5">
          {ITEMS.map(({ icon: Icon, label, text }) => (
            <li key={label} className="flex gap-2.5">
              <Icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{text}</span>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
