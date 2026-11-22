"use client";

import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addDays } from "@/domain/services/attendance";
import { formatDayHeading } from "@/lib/day-heading";

// "DOMINGO » 22º NOVIEMBRE   ‹ 📅 ›" — the day of the cashier's documents.
export function DocumentsDayNav({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const go = (next: string) =>
    startTransition(() => router.push(next === today ? "/pos/comprobantes" : `/pos/comprobantes?date=${next}`));

  return (
    <div className="flex items-center justify-between gap-2" aria-busy={isPending}>
      <h1 className="font-heading text-lg font-semibold tracking-wide sm:text-xl">
        {formatDayHeading(date)}
        {date === today && <span className="ml-2 text-sm font-normal text-muted-foreground">(hoy)</span>}
      </h1>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" aria-label="Día anterior" onClick={() => go(addDays(date, -1))}>
          <ChevronLeftIcon />
        </Button>
        <span className="relative">
          <Button size="icon" variant="ghost" aria-label="Elegir fecha" onClick={() => picker.current?.showPicker()}>
            <CalendarDaysIcon />
          </Button>
          <input
            ref={picker}
            type="date"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0"
            value={date}
            max={today}
            onChange={(e) => e.target.value && go(e.target.value)}
          />
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Día siguiente"
          disabled={date >= today}
          onClick={() => go(addDays(date, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
