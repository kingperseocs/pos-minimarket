"use client";

import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

// Small "i" next to a field label that explains it in a popover.
export function InfoHint({
  title,
  children,
  label = "Más información",
}: {
  title: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="text-muted-foreground"
          />
        }
      >
        <InfoIcon />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
