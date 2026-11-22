"use client";

import { CheckIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createShift, deleteShift, updateShift } from "@/actions/attendance";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_EARLY_MIN,
  DEFAULT_TOLERANCE_MIN,
  SHIFT_COLORS,
  type ShiftColor,
  type WorkShift,
} from "@/domain/entities/attendance";
import { USER_ROLE_LABELS } from "@/domain/entities/user";
import { cn } from "@/lib/utils";
import { textOn, type StaffMember } from "./calendar-utils";

export interface ShiftDraft {
  // Null = new shift.
  id: number | null;
  userId: number | null;
  workDate: string;
  startTime: string;
  endTime: string;
  toleranceMin: number;
  earlyMin: number;
  color: ShiftColor;
  note: string | null;
}

export function draftFromShift(shift: WorkShift): ShiftDraft {
  return { ...shift };
}

export function newDraft(
  workDate: string,
  startTime: string,
  endTime: string,
  color: ShiftColor,
  userId: number | null = null,
): ShiftDraft {
  return {
    id: null,
    userId,
    workDate,
    startTime,
    endTime,
    toleranceMin: DEFAULT_TOLERANCE_MIN,
    earlyMin: DEFAULT_EARLY_MIN,
    color,
    note: null,
  };
}

// "Agregar horario": who works, which day, from when to when, and the color
// it shows with in the calendar. Also edits and deletes a shift.
export function ShiftDialog({
  draft,
  staff,
  colorFor,
  onClose,
  onSaved,
}: {
  draft: ShiftDraft | null;
  staff: StaffMember[];
  colorFor: (userId: number) => ShiftColor;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {draft && (
          <ShiftForm
            key={`${draft.id}-${draft.workDate}-${draft.startTime}`}
            initial={draft}
            staff={staff}
            colorFor={colorFor}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShiftForm({
  initial,
  staff,
  colorFor,
  onClose,
  onSaved,
}: {
  initial: ShiftDraft;
  staff: StaffMember[];
  colorFor: (userId: number) => ShiftColor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isNew = draft.id === null;
  const set = (patch: Partial<ShiftDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const items = staff.map((p) => ({
    value: String(p.id),
    label: `${p.name} · ${USER_ROLE_LABELS[p.role]}`,
  }));

  function save() {
    setError(null);
    if (!draft.userId) return setError("Elige al trabajador");
    startTransition(async () => {
      const payload = { ...draft, userId: draft.userId, note: draft.note ?? "" };
      const result = isNew ? await createShift(payload) : await updateShift(payload);
      if (!result.ok) return setError(result.error);
      toast.success(isNew ? "Turno agregado" : "Turno actualizado");
      onSaved();
      onClose();
    });
  }

  function remove() {
    if (draft.id === null) return;
    startTransition(async () => {
      const result = await deleteShift(draft.id);
      if (!result.ok) return setError(result.error);
      toast.success("Turno eliminado");
      onSaved();
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? "Agregar horario" : "Editar horario"}</DialogTitle>
        <DialogDescription>
          Si la salida es antes que la entrada, el turno termina al día siguiente.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Trabajador</Label>
          <Select
            items={items}
            value={draft.userId ? String(draft.userId) : null}
            onValueChange={(value) => {
              const userId = value ? Number(value) : null;
              // A new shift takes the person's usual color.
              set(userId && isNew ? { userId, color: colorFor(userId) } : { userId });
            }}
          >
            <SelectTrigger className="w-full" aria-label="Trabajador">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="shift-date">Fecha</Label>
          <Input
            id="shift-date"
            type="date"
            value={draft.workDate}
            onChange={(e) => set({ workDate: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="shift-start">Entrada</Label>
            <Input
              id="shift-start"
              type="time"
              value={draft.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shift-end">Salida</Label>
            <Input
              id="shift-end"
              type="time"
              value={draft.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shift-tolerance">Tolerancia (min)</Label>
            <Input
              id="shift-tolerance"
              type="number"
              min={0}
              max={120}
              value={draft.toleranceMin}
              onChange={(e) => set({ toleranceMin: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shift-early">Marca desde (min antes)</Label>
            <Input
              id="shift-early"
              type="number"
              min={0}
              max={120}
              value={draft.earlyMin}
              onChange={(e) => set({ earlyMin: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {SHIFT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={draft.color === color}
                aria-label={`Color ${color}`}
                onClick={() => set({ color })}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
                  draft.color === color && "ring-2 ring-foreground",
                )}
                style={{ backgroundColor: color, color: textOn(color) }}
              >
                {draft.color === color && <CheckIcon className="size-4" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="shift-note">Nota (opcional)</Label>
          <Input
            id="shift-note"
            maxLength={120}
            placeholder="Ej. Cubre a Juan"
            value={draft.note ?? ""}
            onChange={(e) => set({ note: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter className="sm:justify-between">
        {isNew ? (
          <span />
        ) : (
          <Button variant="ghost" className="text-destructive" onClick={remove} disabled={isPending}>
            <Trash2Icon />
            Eliminar
          </Button>
        )}
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}
