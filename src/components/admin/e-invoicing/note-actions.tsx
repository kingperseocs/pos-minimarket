"use client";

import { BanIcon, FileMinusIcon, FilePlusIcon, LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { creditNoteFor, debitNoteFor, voidDocumentNow } from "@/actions/e-invoicing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CREDIT_NOTE_REASONS, DEBIT_NOTE_REASONS, VOID_MAX_DAYS } from "@/domain/entities/sale-document";

type Panel = "void" | "credit" | "debit" | null;

function ReasonSelect({
  reasons,
  value,
  onChange,
}: {
  reasons: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}) {
  const items = Object.entries(reasons).map(([code, label]) => ({ value: code, label: `${code} · ${label}` }));
  return (
    <Select items={items} value={value} onValueChange={(next) => next && onChange(next as string)}>
      <SelectTrigger className="w-full" aria-label="Motivo">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Annul (baja / resumen diario), credit note or debit note, for an issued
// document SUNAT accepted. One panel open at a time.
export function NoteActions({ id, canVoid }: { id: number; canVoid: boolean }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [creditCode, setCreditCode] = useState("01");
  const [debitCode, setDebitCode] = useState("01");
  const [amount, setAmount] = useState("");

  function open(next: Panel) {
    setPanel(panel === next ? null : next);
    setReason("");
    setAmount("");
  }

  function submit(action: () => Promise<{ ok: true; data: string } | { ok: false; error: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${done}: ${result.data}`);
      setPanel(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => open("void")} disabled={!canVoid}>
          <BanIcon data-icon="inline-start" />
          Anular
        </Button>
        <Button variant="outline" onClick={() => open("credit")}>
          <FileMinusIcon data-icon="inline-start" />
          Nota de crédito
        </Button>
        <Button variant="outline" onClick={() => open("debit")}>
          <FilePlusIcon data-icon="inline-start" />
          Nota de débito
        </Button>
      </div>
      {!canVoid && (
        <p className="text-xs text-muted-foreground">
          Anular solo se puede hasta {VOID_MAX_DAYS} días después de emitido; luego, con una nota de crédito.
        </p>
      )}

      {panel && (
        <form
          className="flex max-w-md flex-col gap-3 rounded-md border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (panel === "void") submit(() => voidDocumentNow(id, reason), "Anulación enviada");
            if (panel === "credit") {
              submit(() => creditNoteFor(id, { reasonCode: creditCode, detail: reason }), "Nota de crédito");
            }
            if (panel === "debit") {
              submit(() => debitNoteFor(id, { reasonCode: debitCode, detail: reason, amount }), "Nota de débito");
            }
          }}
        >
          {panel === "void" && (
            <p className="text-sm">
              SUNAT recibe la anulación en un lote y responde en minutos u horas. El estado cambia a{" "}
              <strong>Anulado</strong> cuando la acepta.
            </p>
          )}
          {panel === "credit" && (
            <div className="flex flex-col gap-1">
              <Label>Motivo</Label>
              <ReasonSelect reasons={CREDIT_NOTE_REASONS} value={creditCode} onChange={setCreditCode} />
            </div>
          )}
          {panel === "debit" && (
            <>
              <div className="flex flex-col gap-1">
                <Label>Motivo</Label>
                <ReasonSelect reasons={DEBIT_NOTE_REASONS} value={debitCode} onChange={setDebitCode} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="debit-amount">Monto (S/, con IGV)</Label>
                <Input
                  id="debit-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="note-reason">
              {panel === "void" ? "Motivo de la anulación" : panel === "credit" ? "Sustento" : "Concepto"}
            </Label>
            <Input
              id="note-reason"
              value={reason}
              maxLength={panel === "void" ? 100 : 250}
              placeholder={panel === "void" ? "Ej.: ERROR EN LA VENTA" : undefined}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || reason.trim().length < 3}>
              {isPending && <LoaderCircleIcon className="animate-spin" />}
              {panel === "void" ? "Enviar anulación" : "Emitir nota"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPanel(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
