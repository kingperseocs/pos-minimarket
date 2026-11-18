"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { cn } from "@/lib/utils";

const ALL = "all";

// Writes one search param (or removes it) keeping the others, without
// adding a history entry per keystroke.
function useParamWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function write(name: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    // The old alias of ?categoria (links from before the filters).
    if (name === "categoria") next.delete("category");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return { params, write, isPending };
}

// The row of filters above an admin table.
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

// Search box: the URL (and the table) follow 300 ms after the last key.
export function SearchFilter({
  placeholder,
  param = "q",
}: {
  placeholder: string;
  param?: string;
}) {
  const { params, write, isPending } = useParamWriter();
  const fromUrl = params.get(param) ?? "";
  const [value, setValue] = useState(fromUrl);
  // "Limpiar filtros" (a link) empties the URL: empty the box too.
  const [seenUrl, setSeenUrl] = useState(fromUrl);
  if (fromUrl !== seenUrl) {
    setSeenUrl(fromUrl);
    if (fromUrl === "") setValue("");
  }
  const search = useDebouncedCallback((text: string) => write(param, text.trim() || null), 300);

  return (
    <div className="relative w-full sm:w-72">
      {isPending ? (
        <Loader2Icon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          search(e.target.value);
        }}
        className="pr-8 pl-8"
      />
      {value && (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => {
            setValue("");
            write(param, null);
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

// A searchable select bound to one search param (long lists: suppliers,
// categories); "all" removes the param.
export function SelectFilter({
  param,
  label,
  allLabel,
  options,
  aliases = [],
  className,
}: {
  param: string;
  label: string;
  allLabel: string;
  options: SearchableSelectOption[];
  // Older names of the same param, read when the current one is missing.
  aliases?: string[];
  className?: string;
}) {
  const { params, write } = useParamWriter();
  const raw = params.get(param) ?? aliases.map((a) => params.get(a)).find(Boolean) ?? null;
  const current = raw && options.some((o) => o.value === raw) ? raw : null;

  return (
    <SearchableSelect
      label={label}
      placeholder={allLabel}
      options={[{ value: ALL, label: allLabel }, ...options]}
      value={current}
      onValueChange={(value) => write(param, !value || value === ALL ? null : value)}
      emptyText="Ninguna opción coincide"
      className={cn("w-full sm:w-56", className)}
    />
  );
}

const STATUS_ITEMS = [
  { value: ALL, label: "Todos los estados" },
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
];

// Todos los estados · Activos · Inactivos (?estado=).
export function StatusFilter() {
  const { params, write, isPending } = useParamWriter();
  const raw = params.get("estado");
  const current = STATUS_ITEMS.some((i) => i.value === raw) && raw ? raw : ALL;
  return (
    <Select
      value={current}
      items={STATUS_ITEMS}
      onValueChange={(value) => write("estado", !value || value === ALL ? null : (value as string))}
    >
      <SelectTrigger aria-label="Filtrar por estado" aria-busy={isPending} className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Back to the unfiltered list; only while a filter is on.
export function ClearFilters({ href, active }: { href: string; active: boolean }) {
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={href} />}>
      <XIcon data-icon="inline-start" />
      Limpiar filtros
    </Button>
  );
}

// What the table shows when the filters leave nothing.
export function NoResults({ href }: { href: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      Ningún resultado con estos filtros.
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}>
        Limpiar filtros
      </Button>
    </div>
  );
}
