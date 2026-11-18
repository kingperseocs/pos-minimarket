"use client";

import { WalletIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { markReceiptPaid, markReceiptUnpaid } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SUPPLIER_PAYMENT_METHOD_LABELS,
  SUPPLIER_PAYMENT_METHODS,
  type SupplierPaymentMethod,
} from "@/domain/entities/receiving";
import { formatSoles } from "@/lib/money";

// "Marcar pagado" on a receipt whose invoice is still unpaid.
export function MarkReceiptPaidDialog({
  receiptId,
  label,
  total,
}: {
  receiptId: number;
  // "Backus · F001-123", to know which invoice is being paid.
  label: string;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<SupplierPaymentMethod | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!method) {
      setError("Elige cómo se pagó");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await markReceiptPaid({ receiptId, method, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Factura marcada como pagada");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setMethod(null);
          setNote("");
          setError(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <WalletIcon data-icon="inline-start" />
            Marcar pagado
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar {formatSoles(total)}</DialogTitle>
          <DialogDescription>
            {label}. Este pago no sale de la caja del turno: regístralo solo
            cuando ya se pagó al proveedor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label id={`paid-method-${receiptId}`} required>
              ¿Cómo se pagó?
            </Label>
            <ToggleGroup
              aria-labelledby={`paid-method-${receiptId}`}
              value={method ? [method] : []}
              onValueChange={(next) => {
                const [choice] = next as SupplierPaymentMethod[];
                if (choice) setMethod(choice);
              }}
              variant="outline"
              spacing={1}
              className="grid w-full grid-cols-3"
            >
              {SUPPLIER_PAYMENT_METHODS.map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {SUPPLIER_PAYMENT_METHOD_LABELS[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`paid-note-${receiptId}`} optional>
              Nota
            </Label>
            <Input
              id={`paid-note-${receiptId}`}
              placeholder="Ej. N.° de operación 123456"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Marcar pagado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Back to "Por pagar" when it was marked by mistake (audited too).
export function UndoReceiptPaymentButton({ receiptId }: { receiptId: number }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await markReceiptUnpaid(receiptId);
          if (result.ok) toast("La factura volvió a «Por pagar»");
          else toast.error(result.error);
        })
      }
    >
      Deshacer
    </Button>
  );
}
