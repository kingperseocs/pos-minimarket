"use client"

import * as React from "react"
import { cn } from "cn"

// Red "*" next to a field that must be filled. Only visual: the input itself
// carries `required` / `aria-required` for screen readers. It sits right
// after the text with its own small gap (no negative margins, which made it
// overlap the text of small labels).
function RequiredMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("ml-0.5 font-semibold text-destructive", className)}>
      *
    </span>
  )
}

function Label({
  className,
  children,
  required,
  optional,
  ...props
}: React.ComponentProps<"label"> & {
  // Adds a red "*" after the text.
  required?: boolean
  // Adds a muted "(opcional)" after the text.
  optional?: boolean
}) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {required || optional ? (
        // The text and its mark stay together, whatever gap the label uses.
        <span className="inline-flex items-baseline gap-1">
          <span>{children}</span>
          {required && <RequiredMark className="ml-0" />}
          {optional && (
            <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          )}
        </span>
      ) : (
        children
      )}
    </label>
  )
}

export { Label, RequiredMark }
