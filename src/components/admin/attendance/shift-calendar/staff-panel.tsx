"use client";

import { GripVerticalIcon } from "lucide-react";
import type { ShiftColor } from "@/domain/entities/attendance";
import { USER_ROLE_LABELS, type UserRole } from "@/domain/entities/user";
import { cn } from "@/lib/utils";
import type { StaffMember } from "./calendar-utils";

export type RoleFilter = "all" | Extract<UserRole, "cashier" | "warehouse">;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "cashier", label: "Cajeros" },
  { value: "warehouse", label: "Almaceneros" },
];

// The cashiers and warehouse keepers: shown/hidden in the calendar, and
// dragged onto a day to give them a shift there.
export function StaffPanel({
  staff,
  hidden,
  roleFilter,
  colorFor,
  onToggle,
  onRoleFilter,
  onDragPerson,
}: {
  staff: StaffMember[];
  hidden: Set<number>;
  roleFilter: RoleFilter;
  colorFor: (userId: number) => ShiftColor;
  onToggle: (userId: number) => void;
  onRoleFilter: (filter: RoleFilter) => void;
  onDragPerson: (person: StaffMember | null) => void;
}) {
  const visible = staff.filter((p) => roleFilter === "all" || p.role === roleFilter);
  return (
    <aside className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:w-64 lg:shrink-0">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Personal</h2>
        <p className="text-xs text-muted-foreground">
          Arrastra a una persona a un día para darle un turno.
        </p>
      </div>
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filtrar por rol">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={roleFilter === f.value}
            onClick={() => onRoleFilter(f.value)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              roleFilter === f.value
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-1 lg:max-h-[60vh] lg:overflow-y-auto">
        {visible.map((person) => (
          <li
            key={person.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData("text/plain", person.name);
              onDragPerson(person);
            }}
            onDragEnd={() => onDragPerson(null)}
            className="flex cursor-grab items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(person.id) }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{person.name}</span>
              <span className="block text-xs text-muted-foreground">
                {USER_ROLE_LABELS[person.role]}
              </span>
            </span>
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={!hidden.has(person.id)}
              onChange={() => onToggle(person.id)}
              aria-label={`Mostrar los turnos de ${person.name}`}
            />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-1.5 py-2 text-sm text-muted-foreground">Nadie con ese rol.</li>
        )}
      </ul>
    </aside>
  );
}
