"use client";

import { BoxesIcon, PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createPresentation,
  setPresentationActive,
  updatePresentation,
} from "@/actions/products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogHandle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Presentation } from "@/domain/entities/presentation";
import { cn } from "@/lib/utils";
import { PRESENTATION_NAME_SUGGESTIONS } from "@/domain/services/presentations";
import { useFormDraft } from "@/hooks/use-form-draft";
import { DeactivateButton } from "./deactivate-button";
import { DraftControls, toastCleared } from "./form-dialog";

// Select value for "contains units directly" (presentation ids are numbers).
const UNIT = "unit";

type Draft = {
  name: string;
  qty: string;
  parent: string;
  barcode: string;
  supplierCode: string;
};
const EMPTY: Draft = { name: "", qty: "", parent: UNIT, barcode: "", supplierCode: "" };
type FormState = { editingId: number | null; draft: Draft };
const BLANK: FormState = { editingId: null, draft: EMPTY };

// "Caja = 6 Display = 144 und" for one product. The till always sells the
// unit; presentations are how it is bought and moved between locations.
export function PresentationsDialog({
  productId,
  productName,
  presentations,
  handle,
}: {
  productId: number;
  productName: string;
  presentations: Presentation[];
  // Opened through it (a row's "⋮" menu) instead of its own button.
  handle?: DialogHandle;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const active = presentations.filter((p) => p.isActive);
  // A presentation can't contain itself.
  const parentOptions = active.filter((p) => p.id !== editingId);
  const parentUnits =
    draft.parent === UNIT
      ? 1
      : (active.find((p) => String(p.id) === draft.parent)?.unitsTotal ?? 0);
  const previewUnits = (Number(draft.qty) || 0) * parentUnits;

  function startEdit(p: Presentation) {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      qty: String(p.qtyOfParent),
      parent: p.parentId === null ? UNIT : String(p.parentId),
      barcode: p.barcode ?? "",
      supplierCode: p.supplierCode ?? "",
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY);
    setError(null);
  }

  // The half-typed presentation survives closing the dialog by accident.
  const formDraft = useFormDraft<FormState>({
    key: `presentation:${productId}`,
    values: { editingId, draft },
    baseline: BLANK,
    enabled: open,
  });

  function applyForm(next: FormState) {
    // The presentation being edited may have been removed meanwhile.
    const editing =
      next.editingId !== null && presentations.some((p) => p.id === next.editingId)
        ? next.editingId
        : null;
    setEditingId(editing);
    setDraft({ ...EMPTY, ...next.draft });
    setError(null);
  }

  function handleClear() {
    const before = { editingId, draft };
    resetForm();
    formDraft.clear();
    toastCleared(() => applyForm(before));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = {
        productId,
        name: draft.name,
        qtyOfParent: draft.qty,
        parentId: draft.parent === UNIT ? null : Number(draft.parent),
        barcode: draft.barcode,
        supplierCode: draft.supplierCode,
      };
      const result =
        editingId === null
          ? await createPresentation(input)
          : await updatePresentation(editingId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        editingId === null ? "Presentación agregada" : "Presentación actualizada",
      );
      resetForm();
    });
  }

  function toggle(p: Presentation) {
    startTransition(async () => {
      const result = await setPresentationActive(p.id, !p.isActive);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) applyForm(formDraft.restore() ?? BLANK);
        setOpen(next);
      }}
      handle={handle}
    >
      {!handle && (
        <DialogTrigger
          render={
            <Button size="sm" variant="outline">
              <BoxesIcon data-icon="inline-start" />
              Presentaciones
            </Button>
          }
        />
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Presentaciones · {productName}</DialogTitle>
          <DialogDescription>
            La caja vende solo la unidad. Aquí defines cómo lo compras y lo
            trasladas (pack, display, caja).
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-lg border text-sm">
          <li className="flex items-center justify-between px-3 py-2">
            <span className="font-medium">Unidad</span>
            <span className="text-muted-foreground tabular-nums">1 und</span>
          </li>
          {presentations.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2",
                !p.isActive && "opacity-60",
              )}
            >
              <div className="min-w-0">
                <span className="font-medium">{p.name}</span>{" "}
                <span className="text-muted-foreground">
                  = {p.qtyOfParent} {p.parentName ?? "Unidad"}
                  {!p.isActive && " · inactiva"}
                </span>
                {(p.barcode || p.supplierCode) && (
                  <div className="font-mono text-xs text-muted-foreground">
                    {[p.barcode, p.supplierCode && `Cód. prov. ${p.supplierCode}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="mr-2 font-medium tabular-nums">
                  {p.unitsTotal} und
                </span>
                {p.isActive ? (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${p.name}`}
                      onClick={() => startEdit(p)}
                    >
                      <PencilIcon />
                    </Button>
                    <DeactivateButton
                      label={`Desactivar ${p.name}`}
                      disabled={isPending}
                      onClick={() => toggle(p)}
                    />
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => toggle(p)}
                  >
                    Activar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
        >
          <p className="text-sm font-medium">
            {editingId === null ? "Nueva presentación" : "Editar presentación"}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presentation-name" required>Nombre</Label>
            <Input
              id="presentation-name"
              placeholder="Ej. Display, Caja, Cajón"
              list="presentation-name-suggestions"
              maxLength={40}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
            <datalist id="presentation-name-suggestions">
              {PRESENTATION_NAME_SUGGESTIONS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presentation-qty" required>Contiene</Label>
            <div className="flex items-center gap-2">
              <Input
                id="presentation-qty"
                type="number"
                inputMode="numeric"
                min={2}
                step={1}
                placeholder="24"
                value={draft.qty}
                onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                className="w-24"
                required
              />
              <Select
                value={draft.parent}
                onValueChange={(value) =>
                  value && setDraft({ ...draft, parent: value as string })
                }
                items={[
                  { value: UNIT, label: "Unidades" },
                  ...parentOptions.map((p) => ({
                    value: String(p.id),
                    label: `${p.name} (${p.unitsTotal} und)`,
                  })),
                ]}
              >
                <SelectTrigger aria-label="Contiene de" className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNIT}>Unidades</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.unitsTotal} und)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {previewUnits > 0 && (
              <p className="text-xs text-muted-foreground">
                1 {draft.name.trim() || "presentación"} ={" "}
                <strong className="text-foreground">{previewUnits} unidades</strong>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presentation-barcode">Código de barras</Label>
            <Input
              id="presentation-barcode"
              inputMode="numeric"
              placeholder="Opcional (el de la caja o display)"
              maxLength={14}
              value={draft.barcode}
              onChange={(e) =>
                setDraft({ ...draft, barcode: e.target.value.replace(/\D/g, "") })
              }
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presentation-supplier-code" optional>
              Código del proveedor
            </Label>
            <Input
              id="presentation-supplier-code"
              placeholder="Ej. 800436 (columna CÓDIGO del catálogo)"
              maxLength={30}
              value={draft.supplierCode}
              onChange={(e) => setDraft({ ...draft, supplierCode: e.target.value })}
              className="font-mono"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DraftControls
              onClear={handleClear}
              clearDisabled={isPending}
              draftStatus={formDraft.status}
              className="mr-auto"
            />
            {editingId !== null && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Guardando..."
                : editingId === null
                  ? "Agregar"
                  : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
