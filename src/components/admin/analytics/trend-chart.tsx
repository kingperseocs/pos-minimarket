"use client";

import { useState } from "react";
import type { TrendPoint } from "@/application/use-cases/dashboard/sales-analytics";
import { formatSoles } from "@/lib/money";
import { formatAxisSoles, niceTicks, useElementWidth } from "./chart-utils";

const HEIGHT = 240;
const MARGIN = { top: 12, right: 12, bottom: 28, left: 64 };

// Revenue over the period (blue, with a light wash) against the previous one
// (gray): "am I selling more than before?" at a glance. A crosshair follows
// the pointer (or the arrow keys) and lists both values.
export function TrendChart({
  points,
  currentLabel,
  previousLabel,
}: {
  points: TrendPoint[];
  currentLabel: string;
  previousLabel: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay datos.</p>;
  }

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = Math.max(10, ...points.flatMap((p) => [p.current, p.previous ?? 0]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;

  const x = (i: number) =>
    MARGIN.left + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;

  // The last point may still be in progress (today / this hour): the line
  // up to it is solid, the step into it dashed, so a day that just started
  // doesn't read as a collapse.
  const last = points.length - 1;
  const partial = points.length > 1 && points[last].partial === true;
  const solidEnd = partial ? last - 1 : last;
  const line = (values: (number | null)[], from: number, to: number) =>
    values
      .map((v, i) =>
        v === null || i < from || i > to ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`,
      )
      .filter(Boolean)
      .map((p, i) => `${i === 0 ? "M" : "L"}${p}`)
      .join(" ");
  const currents = points.map((p) => p.current);
  const previouses = points.map((p) => p.previous);
  const currentPath = line(currents, 0, solidEnd);
  const previousPath = line(previouses, 0, solidEnd);
  const currentTail = partial ? line(currents, last - 1, last) : "";
  const previousTail = partial ? line(previouses, last - 1, last) : "";
  const baseline = y(0);
  const areaPath =
    solidEnd > 0
      ? `${currentPath} L${x(solidEnd).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`
      : "";

  // Only as many x labels as fit (~56px each), always first and last.
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 56))));
  const showLabel = (i: number) =>
    i === 0 || i === points.length - 1 || (i % every === 0 && points.length - 1 - i >= every);

  function indexAt(clientX: number, rect: DOMRect) {
    if (points.length === 1) return 0;
    const ratio = (clientX - rect.left - MARGIN.left) / plotWidth;
    return Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
  }

  const point = active === null ? null : points[active];

  return (
    <div
      ref={ref}
      className="relative w-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      tabIndex={0}
      role="img"
      aria-label={`Ventas de ${currentLabel.toLowerCase()} comparadas con ${previousLabel.toLowerCase()}. Usa las flechas para recorrer los valores.`}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const step = event.key === "ArrowRight" ? 1 : -1;
          setActive((i) => Math.min(last, Math.max(0, (i ?? (step > 0 ? -1 : last + 1)) + step)));
        }
      }}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-pan-y select-none"
          onPointerMove={(event) =>
            setActive(indexAt(event.clientX, event.currentTarget.getBoundingClientRect()))
          }
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? "var(--viz-axis)" : "var(--viz-grid)"}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                dy="0.35em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatAxisSoles(tick)}
              </text>
            </g>
          ))}

          {points.map((p, i) =>
            showLabel(i) ? (
              <text
                key={i}
                x={x(i)}
                y={HEIGHT - 8}
                textAnchor={i === 0 && points.length > 1 ? "start" : i === last && points.length > 1 ? "end" : "middle"}
                className="fill-muted-foreground text-[11px]"
              >
                {p.label}
              </text>
            ) : null,
          )}

          {areaPath && <path d={areaPath} fill="var(--viz-1-wash)" />}
          <path
            d={previousPath}
            fill="none"
            stroke="var(--viz-previous)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={currentPath}
            fill="none"
            stroke="var(--viz-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {partial && (
            <g fill="none" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 5">
              <path d={previousTail} stroke="var(--viz-previous)" />
              <path d={currentTail} stroke="var(--viz-1)" />
            </g>
          )}
          {/* End marker: where the period stands now (the last full point). */}
          {active === null && (
            <circle
              cx={x(solidEnd)}
              cy={y(points[solidEnd].current)}
              r={4.5}
              fill="var(--viz-1)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          )}

          {point && active !== null && (
            <g pointerEvents="none">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={MARGIN.top}
                y2={baseline}
                stroke="var(--viz-axis)"
                strokeWidth={1}
              />
              {point.previous !== null && (
                <circle
                  cx={x(active)}
                  cy={y(point.previous)}
                  r={4}
                  fill="var(--viz-previous)"
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={x(active)}
                cy={y(point.current)}
                r={4.5}
                fill="var(--viz-1)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      )}

      {point && active !== null && (
        <TrendTooltip
          point={point}
          currentLabel={currentLabel}
          previousLabel={previousLabel}
          left={x(active)}
          width={width}
        />
      )}
    </div>
  );
}

function TrendTooltip({
  point,
  currentLabel,
  previousLabel,
  left,
  width,
}: {
  point: TrendPoint;
  currentLabel: string;
  previousLabel: string;
  left: number;
  width: number;
}) {
  // Flip to the other side of the crosshair near the right edge.
  const flip = left > width - 190;
  const change =
    point.previous && point.previous > 0
      ? Math.round(((point.current - point.previous) / point.previous) * 100)
      : null;

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border bg-popover p-2.5 text-xs shadow-md"
      style={flip ? { right: width - left + 12 } : { left: left + 12 }}
    >
      <p className="mb-1.5 font-medium first-letter:uppercase">{point.longLabel}</p>
      <TooltipRow color="var(--viz-1)" value={formatSoles(point.current)} label={currentLabel} />
      {point.previous !== null && (
        <TooltipRow
          color="var(--viz-previous)"
          value={formatSoles(point.previous)}
          label={previousLabel}
        />
      )}
      {change !== null && (
        <p className="mt-1.5 border-t pt-1.5 text-muted-foreground">
          {change === 0
            ? "Igual que antes"
            : change > 0
              ? `▲ ${change}% más que antes`
              : `▼ ${Math.abs(change)}% menos que antes`}
        </p>
      )}
    </div>
  );
}

function TooltipRow({ color, value, label }: { color: string; value: string; label: string }) {
  return (
    <p className="flex items-center gap-2 py-0.5">
      <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="truncate text-muted-foreground">{label}</span>
    </p>
  );
}
