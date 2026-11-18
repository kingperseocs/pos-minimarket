"use client";

import { PencilLineIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Line height of the text = spacing of the ruled lines, so text sits on them.
const LINE = "1.75rem";

// A note field that looks like a sticky note on ruled paper (with a strip
// of tape and a red margin), for the free-text "Nota" of the long forms.
export function PaperNote({
  id,
  value,
  onChange,
  maxLength = 200,
  placeholder,
  label = "Nota",
  optional = true,
  rows = 3,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  label?: string;
  optional?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("relative pt-3", className)}>
      {/* A strip of tape holding the note. */}
      <span
        aria-hidden
        className="absolute top-0 left-1/2 z-10 h-6 w-24 -translate-x-1/2 -rotate-2 rounded-sm bg-amber-200/60 shadow-xs ring-1 ring-amber-300/40 backdrop-blur-[1px] dark:bg-amber-200/15 dark:ring-amber-200/10"
      />
      <div
        className="relative overflow-hidden rounded-md border border-amber-200 bg-amber-50 shadow-[0_6px_14px_-8px_rgb(120_80_0/0.35)] dark:border-amber-900/50 dark:bg-amber-950/30"
        style={{
          // Folded bottom-right corner.
          clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%)",
        }}
      >
        <span
          aria-hidden
          className="absolute right-0 bottom-0 size-[18px] bg-gradient-to-tl from-amber-200 to-amber-100 dark:from-amber-800/60 dark:to-amber-900/40"
        />
        <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 px-3 pt-2.5 pb-1.5 pl-11 dark:border-amber-900/50">
          <label
            htmlFor={id}
            className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200"
          >
            <PencilLineIcon className="size-4" aria-hidden />
            {label}
            {optional && <span className="font-normal text-amber-700/80 dark:text-amber-300/70">(opcional)</span>}
          </label>
          <span className="text-xs text-amber-700/80 tabular-nums dark:text-amber-300/70">
            {value.length}/{maxLength}
          </span>
        </div>
        <div className="relative">
          {/* The red margin line of a notebook page. */}
          <span aria-hidden className="absolute inset-y-0 left-8 w-px bg-rose-300/80 dark:bg-rose-400/30" />
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={maxLength}
            placeholder={placeholder}
            rows={rows}
            className="block w-full resize-none border-0 bg-transparent py-0 pr-4 pl-11 text-base text-amber-950 outline-none placeholder:text-amber-700/50 focus-visible:ring-0 md:text-sm dark:text-amber-50 dark:placeholder:text-amber-200/35"
            style={{
              lineHeight: LINE,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${LINE} - 1px), var(--paper-line) calc(${LINE} - 1px), var(--paper-line) ${LINE})`,
              backgroundAttachment: "local",
              ["--paper-line" as string]: "color-mix(in oklab, #3b82f6 22%, transparent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
