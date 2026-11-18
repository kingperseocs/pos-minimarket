import { formatSoles } from "@/lib/money";

export type RankedItem = {
  key: string | number;
  label: string;
  value: number;
  // Second line under the name, e.g. "42 unidades".
  detail?: string;
};

// Horizontal bars, biggest first, value at the tip: names stay readable on a
// phone (no rotated labels) and every value is printed, no hover needed.
export function RankedBars({ items, total }: { items: RankedItem[]; total?: number }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const sum = total ?? items.reduce((s, item) => s + item.value, 0);

  return (
    <ol className="flex flex-col gap-3.5">
      {items.map((item, i) => (
        <li key={item.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-4 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.label}</span>
                {item.detail && (
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                )}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold tabular-nums">{formatSoles(item.value)}</span>
              {sum > 0 && (
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {Math.round((item.value / sum) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="ml-6 h-2.5 rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                background: "var(--viz-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
