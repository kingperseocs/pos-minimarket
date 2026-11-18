"use client";

import { useState } from "react";
import type { HourlySales } from "@/domain/entities/sales-analytics";
import { formatHourRange } from "@/domain/services/sales-insights";
import { formatSoles } from "@/lib/money";
import { formatAxisSoles, niceTicks, useElementWidth } from "./chart-utils";

const HEIGHT = 220;
const MARGIN = { top: 22, right: 8, bottom: 26, left: 56 };
const MAX_BAR = 24;

function shortHour(hour: number) {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${hour < 12 ? "a" : "p"}`;
}

// Column with a 4px rounded top and a square foot on the baseline.
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

// "¿A qué hora vendes más?": one column per hour. Emphasis, not rainbow:
// the busiest hour in the strong blue with its value, the rest in a lighter
// step of the same blue.
export function HourlyChart({ hourly, peakHour }: { hourly: HourlySales[]; peakHour: number | null }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const byHour = new Map(hourly.map((h) => [h.hour, h]));
  const first = Math.min(...hourly.map((h) => h.hour));
  const last = Math.max(...hourly.map((h) => h.hour));
  const hours: HourlySales[] = [];
  for (let hour = first; hour <= last; hour++) {
    hours.push(byHour.get(hour) ?? { hour, revenue: 0, orders: 0 });
  }

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const ticks = niceTicks(Math.max(10, ...hours.map((h) => h.revenue)), 3);
  const top = ticks[ticks.length - 1] || 1;
  const band = hours.length > 0 ? plotWidth / hours.length : 0;
  // The bar never fills its slot: the leftover is air (and the 2px gap).
  const barWidth = Math.max(4, Math.min(MAX_BAR, band - 2, band * 0.7));
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const every = Math.max(1, Math.ceil(hours.length / Math.max(1, Math.floor(plotWidth / 34))));

  const activeHour = active === null ? null : hours.find((h) => h.hour === active);
  const peakIndex = hours.findIndex((h) => h.hour === peakHour);
  // The peak's label always shows; its neighbors give way so they never
  // overlap on a narrow screen.
  const showHourLabel = (i: number) =>
    i === peakIndex || (i % every === 0 && Math.abs(i - peakIndex) >= Math.max(1, every));

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="block select-none" onPointerLeave={() => setActive(null)}>
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

          {hours.map((h, i) => {
            const bandX = MARGIN.left + i * band;
            const barX = bandX + (band - barWidth) / 2;
            const barY = y(h.revenue);
            const isPeak = h.hour === peakHour;
            const isActive = h.hour === active;
            return (
              <g key={h.hour}>
                {h.revenue > 0 && (
                  <path
                    d={columnPath(barX, barY, barWidth, y(0) - barY)}
                    fill={isPeak ? "var(--viz-1)" : "var(--viz-1-soft)"}
                    opacity={active !== null && !isActive ? 0.55 : 1}
                  />
                )}
                {isPeak && h.revenue > 0 && (
                  <text
                    x={barX + barWidth / 2}
                    y={barY - 6}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-semibold"
                  >
                    {formatAxisSoles(h.revenue)}
                  </text>
                )}
                {showHourLabel(i) && (
                  <text
                    x={bandX + band / 2}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className={isPeak ? "fill-foreground text-[11px] font-semibold" : "fill-muted-foreground text-[11px]"}
                  >
                    {shortHour(h.hour)}
                  </text>
                )}
                {/* The whole band is the hit target, not just the painted bar. */}
                <rect
                  x={bandX}
                  y={MARGIN.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${formatHourRange(h.hour)}: ${formatSoles(h.revenue)}, ${h.orders} compras`}
                  className="outline-none"
                  onPointerEnter={() => setActive(h.hour)}
                  onFocus={() => setActive(h.hour)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {activeHour && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 rounded-lg border bg-popover p-2.5 text-xs shadow-md"
          style={(() => {
            const i = hours.findIndex((h) => h.hour === activeHour.hour);
            const center = MARGIN.left + i * band + band / 2;
            return center > width - 190 ? { right: width - center + 12 } : { left: center + 12 };
          })()}
        >
          <p className="mb-1 font-medium first-letter:uppercase">{formatHourRange(activeHour.hour)}</p>
          <p className="text-sm font-semibold tabular-nums">{formatSoles(activeHour.revenue)}</p>
          <p className="text-muted-foreground">
            {activeHour.orders} {activeHour.orders === 1 ? "compra" : "compras"}
          </p>
        </div>
      )}
    </div>
  );
}
