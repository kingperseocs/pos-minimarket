"use client";

import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type MultiComboboxOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};

// Pick several options out of a long list: chosen ones are chips (with X),
// typing filters the list. Backspace on an empty filter removes the last chip.
export function MultiCombobox({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Buscar…",
  emptyText = "Sin resultados",
  className,
}: {
  id?: string;
  options: MultiComboboxOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const byValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );
  const selected = value
    .map((v) => byValue.get(v))
    .filter((option): option is MultiComboboxOption => option !== undefined);

  return (
    <Combobox.Root
      items={options}
      multiple
      value={selected}
      onValueChange={(next) => onValueChange(next.map((option) => option.value))}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <Combobox.InputGroup
        className={cn(
          "flex min-h-8 w-full cursor-text items-center gap-1 rounded-lg border border-input bg-transparent py-1 pr-1 pl-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          className,
        )}
      >
        <Combobox.Chips className="flex flex-1 flex-wrap items-center gap-1">
          {selected.map((option) => (
            <Combobox.Chip
              key={option.value}
              aria-label={option.label}
              className="flex h-6 items-center gap-1 rounded-md bg-primary/10 pr-0.5 pl-1.5 text-xs font-medium text-primary outline-none focus-within:ring-2 focus-within:ring-ring/50 [&_svg:not([class*='size-'])]:size-3.5"
            >
              {option.icon}
              {option.label}
              <Combobox.ChipRemove
                aria-label={`Quitar ${option.label}`}
                className="flex size-5 items-center justify-center rounded-sm hover:bg-primary/15"
              >
                <XIcon className="size-3" />
              </Combobox.ChipRemove>
            </Combobox.Chip>
          ))}
          <Combobox.Input
            id={id}
            placeholder={selected.length > 0 ? "Agregar otra…" : placeholder}
            className="h-6 min-w-24 flex-1 border-0 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </Combobox.Chips>
        <Combobox.Trigger
          aria-label="Ver opciones"
          className="flex size-6 shrink-0 items-center justify-center self-start rounded-md text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon className="size-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50 outline-none" sideOffset={4}>
          <Combobox.Popup className="max-h-[min(18rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Combobox.Empty className="px-2 py-3 text-center text-sm text-muted-foreground empty:hidden">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List>
              {(option: MultiComboboxOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg:not([class*='size-'])]:size-4"
                >
                  {option.icon}
                  <span className="flex-1 truncate">{option.label}</span>
                  <Combobox.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center text-primary">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
