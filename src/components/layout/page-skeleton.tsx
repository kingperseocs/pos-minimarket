import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 6;
const COLUMNS = 5;

// Placeholder of an admin table (toolbar + header + rows) while its data loads.
export function TableSkeleton({ rows = ROWS }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Cargando…"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
          <Skeleton className="h-3 w-8" />
          {Array.from({ length: COLUMNS }, (_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
          <Skeleton className="h-3 w-14" />
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0"
          >
            <Skeleton className="h-4 w-8" />
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            {Array.from({ length: COLUMNS - 1 }, (_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
            <Skeleton className="size-7 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

// A whole admin screen: title, description and main button, then the table.
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <TableSkeleton />
    </div>
  );
}
