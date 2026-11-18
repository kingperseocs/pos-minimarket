"use client";

import { EraserIcon, HistoryIcon, type LucideIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Building blocks for the admin create/edit dialogs ("Nuevo proveedor",
// "Nueva categoría"…). Use with
// <DialogContent className={FORM_DIALOG_CONTENT}>: header and footer stay put
// and only the body scrolls, so the X and the buttons are always visible.
export const FORM_DIALOG_CONTENT =
  "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0";

export function FormDialogHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <DialogHeader className="flex-row items-center gap-3 border-b bg-muted/30 px-5 py-4 pr-12">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <DialogTitle className="text-lg leading-tight font-semibold">
          {title}
        </DialogTitle>
        {description && (
          <DialogDescription className="text-xs leading-snug">
            {description}
          </DialogDescription>
        )}
      </div>
    </DialogHeader>
  );
}

export function FormDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function FormDialogFooter({
  className,
  children,
  onClear,
  clearLabel,
  draftStatus,
  clearDisabled,
  ...props
}: React.ComponentProps<typeof DialogFooter> & DraftControlsProps) {
  return (
    <DialogFooter
      className={cn("mx-0 mb-0 rounded-b-xl px-5 py-3", className)}
      {...props}
    >
      {onClear && (
        <DraftControls
          onClear={onClear}
          clearLabel={clearLabel}
          draftStatus={draftStatus}
          clearDisabled={clearDisabled}
          className="sm:mr-auto"
        />
      )}
      {children}
    </DialogFooter>
  );
}

type DraftControlsProps = {
  // Shows "Limpiar" (or clearLabel) at the start of the footer.
  onClear?: () => void;
  clearLabel?: string;
  clearDisabled?: boolean;
  draftStatus?: "none" | "saved" | "restored";
};

// "Limpiar" + whether what is on screen is kept as a draft. Used in the
// dialog footers and next to the save button of the long page forms.
export function DraftControls({
  onClear,
  clearLabel = "Limpiar",
  clearDisabled,
  draftStatus = "none",
  className,
}: DraftControlsProps & { onClear: () => void; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 sm:justify-start",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onClear}
        disabled={clearDisabled}
      >
        <EraserIcon />
        {clearLabel}
      </Button>
      {draftStatus !== "none" && (
        <span
          role="status"
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          {draftStatus === "restored" ? (
            <>
              <HistoryIcon className="size-3.5" aria-hidden />
              Borrador recuperado
            </>
          ) : (
            <>
              <SaveIcon className="size-3.5" aria-hidden />
              Borrador guardado
            </>
          )}
        </span>
      )}
    </div>
  );
}

// After "Limpiar": no confirmation dialog, an undo instead — so a stray tap
// costs nothing.
export function toastCleared(undo: () => void, message = "Campos limpiados") {
  toast(message, { action: { label: "Deshacer", onClick: undo } });
}

// "* Campos obligatorios": explains the red asterisk of the labels.
export function RequiredLegend({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <span aria-hidden className="text-destructive">
        *
      </span>{" "}
      Campos obligatorios
    </p>
  );
}

// A titled group of fields inside a long form.
export function FormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 border-b pb-1.5">
        <Icon className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <span className="truncate text-xs text-muted-foreground">
            · {description}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
