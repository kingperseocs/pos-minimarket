"use client";

import { useEffect, useRef, useState } from "react";

// Width of an element, kept in sync on resize: charts draw at their real
// pixel size (crisp 2px lines, labels that never stretch) on any screen.
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

// Round axis steps (1, 2, 2.5, 5 × 10ⁿ) so ticks read 0 / 200 / 400.
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  // Always one tick at or above the max, so no mark rises past the axis.
  const ticks: number[] = [];
  for (let i = 0; i <= count + 1; i++) {
    const value = Number((i * step).toFixed(2));
    ticks.push(value);
    if (value >= max) break;
  }
  return ticks;
}

// Axis labels: "S/ 800", "S/ 1.2 mil" — short, never "1200.00".
export function formatAxisSoles(value: number) {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `S/ ${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)} mil`;
  }
  // Small amounts keep their decimal ("S/ 2.5"), so ticks never repeat.
  return `S/ ${value < 10 && !Number.isInteger(value) ? value.toFixed(1) : Math.round(value)}`;
}
