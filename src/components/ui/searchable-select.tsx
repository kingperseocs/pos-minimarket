"use client";

import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useMemo } from "react";
import { normalizeText } from "@/lib/table-filters";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  // Second line / context ("en Bebidas"); also searched.
  hint?: string;
  // A subcategory under its main category.
  indent?: boolean;
};

// A select for long lists (suppliers, categories): typing filters the
// options, ignoring accents and case, so the list never becomes a mess to
// scroll. Picks exactly one value.
export function SearchableSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Buscar…",
  emptyText = "Sin resultados",
  label,
  className,
}: {
  id?: string;
  options: SearchableSelectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  label?: string;
  className?: string;
}) {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <Combobox.Root
      items={options}
      value={selected}
      onValueChange={(next) => onValueChange(next?.value ?? null)}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(option, query) =>
        normalizeText(`${option.label} ${option.hint ?? ""}`).includes(normalizeText(query))
      }
    >
      <Combobox.InputGroup
        className={cn(
          "relative flex h-8 w-full items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          className,
        )}
      >
        <SearchIcon className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" />
        <Combobox.Input
          id={id}
          aria-label={label}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 truncate border-0 bg-transparent pr-1 pl-8 text-base outline-none placeholder:text-foreground md:text-sm"
        />
        <Combobox.Trigger
          aria-label="Ver opciones"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon className="size-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50 outline-none" sideOffset={4} align="start">
          <Combobox.Popup className="max-h-[min(20rem,var(--available-height))] w-(--anchor-width) min-w-56 max-w-(--available-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Combobox.Empty className="px-2 py-3 text-center text-sm text-muted-foreground empty:hidden">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List>
              {(option: SearchableSelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className={cn(
                    "relative flex w-full cursor-default flex-col rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                    option.indent && "pl-6",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="truncate text-xs text-muted-foreground">{option.hint}</span>
                  )}
                  <Combobox.ItemIndicator className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center text-primary">
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
