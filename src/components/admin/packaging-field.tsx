"use client";

import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PopoverDescription } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ValidationError } from "@/domain/errors";
import {
  MAX_PACK_FORMATS,
  MAX_PACK_LEVELS,
  NET_UNIT_LABELS,
  NET_UNITS,
  type NetUnit,
  defaultLevelNames,
  formatNetContent,
  planPackaging,
} from "@/domain/services/packaging";
import { PRESENTATION_NAME_SUGGESTIONS } from "@/domain/services/presentations";
import { cn } from "@/lib/utils";
import { InfoPopover } from "./price-info";

// One level of a format, outermost first. `custom` = the name was typed by
// hand, so it no longer follows the counts.
export type FormatLevel = { name: string; qty: string; custom: boolean };

// One way the supplier ships the product (36 x 47 g, 6 x 6 x 47 g…).
export type FormatValue = {
  key: string;
  levels: FormatLevel[];
  supplierCode: string;
};

export type PackagingValue = {
  // What one unit holds (47 g): the same for every format.
  netContent: string;
  netUnit: NetUnit | "";
  formats: FormatValue[];
};

export const EMPTY_PACKAGING: PackagingValue = {
  netContent: "",
  netUnit: "",
  formats: [],
};

const SHAPES: { levels: number; label: string; example: string }[] = [
  { levels: 1, label: "Caja → unidades", example: "36 × 47 g" },
  { levels: 2, label: "Caja → paquetes → unidades", example: "8 × 12 × 21 g" },
  { levels: 3, label: "Caja → display → paquetes → unidades", example: "4 × 6 × 10 × 20 g" },
];

const PLURAL: Record<string, string> = {
  Caja: "cajas",
  Display: "displays",
  Paquete: "paquetes",
};

const qtyOf = (level: FormatLevel) => {
  const n = Number(level.qty);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// "Caja 8×12", "Paquete x12": the base name plus the counts from that level
// inward, once they are typed.
function autoName(levels: FormatLevel[], index: number) {
  const base = defaultLevelNames(levels.length)[index] ?? "Nivel";
  const counts = levels.slice(index).map(qtyOf);
  if (counts.some((c) => c === null)) return base;
  return `${base} ${counts.length === 1 ? `x${counts[0]}` : counts.join("×")}`;
}

function withAutoNames(format: FormatValue): FormatValue {
  return {
    ...format,
    levels: format.levels.map((level, i) =>
      level.custom ? level : { ...level, name: autoName(format.levels, i) },
    ),
  };
}

function newFormat(depth = 2): FormatValue {
  return withAutoNames({
    key: crypto.randomUUID(),
    levels: Array.from({ length: depth }, () => ({ name: "", qty: "", custom: false })),
    supplierCode: "",
  });
}

// "paquetes por caja", "unidades por paquete": what the number under it means.
function countCaption(depth: number, index: number) {
  const names = defaultLevelNames(depth);
  const inner = names[index + 1];
  const what = inner ? (PLURAL[inner] ?? inner.toLowerCase()) : "unidades";
  return `${what} por ${(names[index] ?? "nivel").toLowerCase()}`;
}

// What is sent to the server: the formats with something typed. Their
// errors (a count of 1, a repeated name) come back from the server too.
export function packagingInput(value: PackagingValue) {
  const formats = value.formats
    .filter((f) => f.levels.some((l) => l.qty.trim() !== ""))
    .map((f) => ({
      supplierCode: f.supplierCode,
      levels: f.levels.map((l) => ({ name: l.name.trim(), qtyOfParent: Number(l.qty) })),
    }));
  return formats.length > 0 ? { formats } : null;
}

// The plan the server will follow, or why it can't be done yet.
function previewPlan(value: PackagingValue) {
  const input = packagingInput(value);
  if (!input) return { plan: [], error: null };
  if (input.formats.some((f) => f.levels.some((l) => !(l.qtyOfParent >= 2)))) {
    return { plan: [], error: "Cada nivel debe traer 2 o más." };
  }
  if (input.formats.some((f) => f.levels.some((l) => !l.name))) {
    return { plan: [], error: "Cada nivel necesita un nombre." };
  }
  try {
    return {
      plan: planPackaging(
        input.formats.map((f) => ({ ...f, supplierCode: f.supplierCode.trim() || null })),
      ),
      error: null,
    };
  } catch (error) {
    if (error instanceof ValidationError) return { plan: [], error: error.message };
    throw error;
  }
}

function HowToRead() {
  return (
    <InfoPopover label="Cómo se lee el formato" title="¿Cómo se lee 8 × 12 × 21 g?" align="start">
      <PopoverDescription className="flex flex-col gap-2 text-xs">
        <span>
          Es la columna <strong>PESOS</strong> del catálogo. Se lee de afuera
          hacia adentro, y el último número es lo que pesa una unidad:
        </span>
        <span className="rounded-md bg-muted/60 p-2 font-mono leading-relaxed">
          8 × 12 × 21 g
          <br />→ 1 caja trae 8 paquetes
          <br />→ 1 paquete trae 12 unidades
          <br />→ 1 unidad pesa 21 g
          <br />= 96 unidades por caja
        </span>
        <span>
          Pon cada número en su casilla. En caja registradora se vende la
          unidad; la caja y el paquete se usan para comprar y trasladar.
        </span>
        <span>
          Si el mismo producto viene en otro empaque con otro código (36 × 47 g
          y 6 × 6 × 47 g), agrégalo como otro formato.
        </span>
      </PopoverDescription>
    </InfoPopover>
  );
}

function SameWeightInfo() {
  return (
    <InfoPopover
      label="Mismo peso, mismo producto"
      title="Mismo peso = mismo producto"
      align="start"
    >
      <PopoverDescription className="flex flex-col gap-2 text-xs">
        <span>
          Un producto es lo que se vende en caja, con <strong>un solo peso</strong>.
          Las filas del catálogo con ese mismo peso son sus formatos y van en
          este mismo formulario:
        </span>
        <span className="rounded-md bg-muted/60 p-2 font-mono leading-relaxed">
          Crackelet Original 47 g
          <br />→ 36 × 47 g (800436)
          <br />→ 6 × 6 × 47 g (800186)
        </span>
        <span>
          Otro peso es <strong>otro producto</strong>, con su propio precio y
          código de barras: registra «Crackelet Original 18 g» (8 × 12 × 18 g)
          aparte, con «Nuevo producto».
        </span>
      </PopoverDescription>
    </InfoPopover>
  );
}

export function PackagingField({
  value,
  onChange,
  existing,
}: {
  value: PackagingValue;
  onChange: (value: PackagingValue) => void;
  // Active presentations the product already has (editing): formats are
  // then only informative, presentations change in their own dialog.
  existing: { name: string; unitsTotal: number }[];
}) {
  const canCreate = existing.length === 0;
  const content = formatNetContent(
    value.netContent === "" ? null : Number(value.netContent) || null,
    value.netUnit || null,
  );
  const { plan, error } = previewPlan(value);

  const setFormats = (formats: FormatValue[]) => onChange({ ...value, formats });
  const updateFormat = (key: string, next: FormatValue) =>
    setFormats(value.formats.map((f) => (f.key === key ? withAutoNames(next) : f)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor="net-content">Peso o volumen de 1 unidad</Label>
          <SameWeightInfo />
        </div>
        <div className="flex gap-2">
          <Input
            id="net-content"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="Ej. 21"
            value={value.netContent}
            onChange={(e) => onChange({ ...value, netContent: e.target.value })}
            className="h-10 min-w-0 flex-1 text-base tabular-nums"
          />
          <ToggleGroup
            aria-label="Unidad del contenido"
            value={value.netUnit ? [value.netUnit] : []}
            onValueChange={(next) => {
              const [unit] = next as NetUnit[];
              onChange({ ...value, netUnit: unit ?? "" });
            }}
            variant="outline"
            spacing={0}
            className="h-10"
          >
            {NET_UNITS.map((unit) => (
              <ToggleGroupItem
                key={unit}
                value={unit}
                className="h-10 min-w-11 px-2.5 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {NET_UNIT_LABELS[unit]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <p className="text-xs text-muted-foreground">
          Gramos (g, kg) o mililitros (ml, L) de 1 unidad de las que se venden en caja: el último número del catálogo, por ejemplo 47 g.
        </p>
      </div>

      {!canCreate ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Ya tiene:{" "}
          <span className="font-medium text-foreground">
            {existing.map((p) => `${p.name} = ${p.unitsTotal} und`).join(" · ")}
          </span>
          . Cámbialas con el botón Presentaciones de la tabla.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">Formatos del catálogo</span>
            <span className="text-xs text-muted-foreground">(opcional)</span>
            <HowToRead />
          </div>

          <datalist id="pack-level-names">
            {PRESENTATION_NAME_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          {value.formats.map((format, index) => (
            <FormatCard
              key={format.key}
              index={index}
              format={format}
              content={content}
              onChange={(next) => updateFormat(format.key, next)}
              onRemove={() => setFormats(value.formats.filter((f) => f.key !== format.key))}
            />
          ))}

          {value.formats.length < MAX_PACK_FORMATS && (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full border-dashed"
              onClick={() => setFormats([...value.formats, newFormat()])}
            >
              <PlusIcon />
              {value.formats.length === 0 ? "Agregar formato" : "Agregar otro formato"}
            </Button>
          )}
        </div>
      )}

      {canCreate && (plan.length > 0 || error || content) && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2",
            error ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5",
          )}
        >
          <p className="text-xs font-medium">Se va a registrar al guardar:</p>
          {error ? (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5">
              {content && <SummaryLine>Unidad que se vende en caja: {content}</SummaryLine>}
              {plan.map((item) => (
                <SummaryLine key={item.name}>
                  Presentación «{item.name}» = {item.qtyOfParent}{" "}
                  {item.parent === null ? "unidades" : `× ${plan[item.parent].name}`}
                  {item.parent !== null && ` = ${item.unitsTotal} unidades`}
                  {item.supplierCode && ` · Cód. ${item.supplierCode}`}
                </SummaryLine>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-xs">
      <CheckIcon className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function Times() {
  return (
    <span aria-hidden className="flex h-11 items-center text-lg text-muted-foreground">
      ×
    </span>
  );
}

// One format as a formula of numeric boxes: [8] × [12] × [21 g].
function FormatCard({
  index,
  format,
  content,
  onChange,
  onRemove,
}: {
  index: number;
  format: FormatValue;
  content: string | null;
  onChange: (format: FormatValue) => void;
  onRemove: () => void;
}) {
  const levels = format.levels;
  const outer = levels[0];
  const counts = levels.map(qtyOf);
  const units = counts.every((c) => c !== null)
    ? counts.reduce<number>((total, c) => total * (c as number), 1)
    : null;

  function setLevel(i: number, patch: Partial<FormatLevel>) {
    onChange({
      ...format,
      levels: levels.map((level, j) => (j === i ? { ...level, ...patch } : level)),
    });
  }

  function setShape(depth: number) {
    // Keeps the counts typed from the inside out (the unit end stays put).
    const kept = levels.slice(-depth);
    const padded = [
      ...Array.from({ length: depth - kept.length }, () => ({ name: "", qty: "", custom: false })),
      ...kept.map((level) => ({ ...level, custom: false })),
    ];
    onChange({ ...format, levels: padded });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Formato {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Quitar formato ${index + 1}`}
          title="Quitar formato"
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={`shape-${format.key}`} className="text-xs text-muted-foreground">
          ¿Cómo viene?
        </span>
        <ToggleGroup
          aria-labelledby={`shape-${format.key}`}
          value={[String(levels.length)]}
          onValueChange={(next) => {
            const [choice] = next as string[];
            if (choice) setShape(Number(choice));
          }}
          variant="outline"
          spacing={1}
          className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-3"
        >
          {SHAPES.slice(0, MAX_PACK_LEVELS).map((shape) => (
            <ToggleGroupItem
              key={shape.levels}
              value={String(shape.levels)}
              className="h-full min-h-12 w-full min-w-0 flex-col items-start justify-center gap-0.5 px-2.5 py-2 text-left text-xs whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              <span className="leading-tight font-medium">{shape.label}</span>
              <span className="font-mono opacity-70">{shape.example}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-1.5">
          {levels.map((level, i) => {
            const qty = qtyOf(level);
            const invalid = level.qty !== "" && (qty === null || qty < 2);
            const caption = countCaption(levels.length, i);
            return (
              <div key={i} className="contents">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <Input
                    aria-label={`${caption} (formato ${index + 1})`}
                    type="number"
                    inputMode="numeric"
                    min={2}
                    step={1}
                    placeholder="0"
                    value={level.qty}
                    onChange={(e) => setLevel(i, { qty: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    aria-invalid={invalid || undefined}
                    className="h-11 w-full text-center text-lg font-semibold tabular-nums"
                  />
                  <span
                    className={cn(
                      "text-center text-[11px] leading-tight",
                      invalid ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {invalid ? "2 o más" : caption}
                  </span>
                </div>
                <Times />
              </div>
            );
          })}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-11 w-full items-center justify-center rounded-lg border border-dashed px-1 text-center text-lg font-semibold tabular-nums",
                !content && "text-sm font-normal text-muted-foreground",
              )}
              title="Se edita en «Peso o volumen de 1 unidad»"
            >
              {content ?? "—"}
            </div>
            <span className="text-center text-[11px] leading-tight text-primary">
              1 unidad (se vende)
            </span>
          </div>
        </div>
        <p className="rounded-md bg-background px-2.5 py-1.5 text-center text-sm">
          {units !== null ? (
            <>
              = <strong className="tabular-nums">{units}</strong> unidades por{" "}
              <span className="font-medium">{outer.name || "caja"}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Completa las casillas para ver el total</span>
          )}
        </p>
      </div>

      <details className="group rounded-md border bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs">
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">Nombres: </span>
            {levels.map((l) => l.name || "—").join(" · ")}
          </span>
          <span className="flex shrink-0 items-center gap-1 font-medium text-primary">
            Cambiar
            <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </summary>
        <div className="grid grid-cols-1 gap-2 border-t p-2.5 sm:grid-cols-2">
          {levels.map((level, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Label htmlFor={`level-name-${format.key}-${i}`} className="text-xs">
                Nombre del nivel {i + 1}
              </Label>
              <Input
                id={`level-name-${format.key}-${i}`}
                list="pack-level-names"
                value={level.name}
                onChange={(e) => setLevel(i, { name: e.target.value, custom: true })}
                maxLength={40}
                className="h-9"
              />
            </div>
          ))}
        </div>
      </details>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`format-code-${format.key}`} optional className="text-xs">
          Código del proveedor de «{outer.name || "este formato"}»
        </Label>
        <Input
          id={`format-code-${format.key}`}
          placeholder="Ej. 800450 (columna CÓDIGO)"
          maxLength={30}
          value={format.supplierCode}
          onChange={(e) => onChange({ ...format, supplierCode: e.target.value })}
          className="h-10 font-mono"
        />
      </div>
    </div>
  );
}
