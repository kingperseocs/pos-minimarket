import { TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Every chart answers a question in its title and says the answer in one
// sentence before the plot ("takeaway"): the admin reads the sentence, the
// chart backs it up. The table view keeps every value reachable without
// hovering (and for screen readers).
export function ChartCard({
  title,
  takeaway,
  children,
  table,
  legend,
  className,
}: {
  title: string;
  takeaway?: React.ReactNode;
  children: React.ReactNode;
  table?: React.ReactNode;
  legend?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:p-5",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-semibold">{title}</h3>
        {takeaway && <p className="text-sm text-muted-foreground">{takeaway}</p>}
      </header>
      {legend}
      <div className="min-w-0">{children}</div>
      {table && (
        <details className="group text-sm">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground">
            <TableIcon className="size-3.5" aria-hidden />
            <span className="group-open:hidden">Ver los datos en tabla</span>
            <span className="hidden group-open:inline">Ocultar tabla</span>
          </summary>
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border">{table}</div>
        </details>
      )}
    </section>
  );
}

// Plain data table used as every chart's table view.
export function DataTableView({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-muted text-muted-foreground">
        <tr>
          {columns.map((column, i) => (
            <th key={column} className={cn("px-3 py-2 font-medium", i === 0 ? "text-left" : "text-right")}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} className={cn("px-3 py-1.5", i === 0 ? "text-left" : "text-right tabular-nums")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Legend key mirroring the mark: a short line for lines, a square for bars.
export function LegendItem({
  color,
  label,
  shape = "line",
}: {
  color: string;
  label: string;
  shape?: "line" | "square";
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={shape === "line" ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-[3px]"}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
