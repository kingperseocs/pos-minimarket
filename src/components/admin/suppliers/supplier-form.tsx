"use client";

import {
  Building2Icon,
  CalendarClockIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MessageSquareWarningIcon,
  StickyNoteIcon,
  TruckIcon,
  WalletIcon,
  UserIcon,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createSupplier,
  lookupSupplierRuc,
  updateSupplier,
} from "@/actions/suppliers";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import { groupCategories } from "@/domain/services/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  type DialogHandle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WEEKDAYS, type Supplier } from "@/domain/entities/supplier";
import { isValidRuc } from "@/domain/services/ruc";
import { useFormDraft } from "@/hooks/use-form-draft";
import { cn } from "@/lib/utils";
import {
  FORM_DIALOG_CONTENT,
  FormDialogBody,
  FormDialogFooter,
  FormDialogHeader,
  FormSection,
  RequiredLegend,
  toastCleared,
} from "../form-dialog";
import {
  type PaymentValue,
  paymentFrom,
  paymentInput,
  SupplierPaymentFields,
} from "./supplier-payment-fields";

export type SupplierCategoryOption = {
  id: number;
  name: string;
  icon: string | null;
  // The main category of a subcategory (null for a main one).
  parentId?: number | null;
};

const FIELDS = [
  "ruc",
  "businessName",
  "tradeName",
  "address",
  "website",
  "contactName",
  "phone",
  "email",
  "claimsContactName",
  "claimsPhone",
  "deliveryTimeFrom",
  "deliveryTimeTo",
  "driverName",
  "driverPhone",
  "catalogUrl",
  "notes",
] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;

const NOTES_MAX = 500;

// What the SUNAT lookup said about the RUC currently typed.
type RucLookup =
  | { status: "idle" | "loading" | "found" | "not_found" | "unavailable" }
  | { status: "registered"; supplierName: string };

type Hint = { text: string; tone: "muted" | "ok" | "error" };

function rucHintFor(ruc: string, invalid: boolean, lookup: RucLookup): Hint {
  if (ruc.length === 0) {
    return { text: "11 dígitos, como figura en la factura.", tone: "muted" };
  }
  if (ruc.length < 11) return { text: `${ruc.length} de 11 dígitos`, tone: "muted" };
  if (invalid) return { text: "RUC inválido: revisa los dígitos", tone: "error" };
  switch (lookup.status) {
    case "loading":
      return { text: "Consultando SUNAT…", tone: "muted" };
    case "found":
      return { text: "RUC válido · datos traídos de SUNAT", tone: "ok" };
    case "registered":
      return {
        text: `Ya existe un proveedor con este RUC: ${lookup.supplierName}`,
        tone: "error",
      };
    case "not_found":
      return { text: "SUNAT no tiene este RUC; escribe la razón social", tone: "muted" };
    case "unavailable":
      return { text: "No se pudo consultar SUNAT; escríbela a mano", tone: "muted" };
    default:
      return { text: "RUC válido", tone: "ok" };
  }
}

function initialValues(supplier?: Supplier): Values {
  return Object.fromEntries(
    FIELDS.map((field) => [field, supplier?.[field] ?? ""]),
  ) as Values;
}

// Same rule as the server: "backus.pe" counts, it gets https:// on save.
function toHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(url).hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

function Field({
  id,
  label,
  hint,
  className,
  children,
  required,
  optional,
}: {
  id?: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} required={required} optional={optional}>
        {label}
      </Label>
      {children}
      {hint}
    </div>
  );
}

export function SupplierForm({
  supplier,
  categories,
  trigger,
  handle,
}: {
  supplier?: Supplier;
  categories: SupplierCategoryOption[];
  trigger?: React.ReactElement;
  // Without a trigger, opened through `handle` (a row's "⋮" menu).
  handle?: DialogHandle;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Values>(() => initialValues(supplier));
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [deliveryDays, setDeliveryDays] = useState<string[]>([]);
  const [payment, setPayment] = useState<PaymentValue>(() => paymentFrom(supplier));
  const [error, setError] = useState<string | null>(null);
  const [rucLookup, setRucLookup] = useState<RucLookup>({ status: "idle" });
  // Razón social stays locked until SUNAT answers (or the admin opts to type
  // it): it should come from the RUC, not be guessed. Editing starts unlocked.
  const [nameUnlocked, setNameUnlocked] = useState(Boolean(supplier));
  // Last RUC sent to SUNAT: the same one is not asked twice, and an answer for
  // a RUC that was changed meanwhile is dropped.
  const lookedUpRuc = useRef(supplier?.ruc ?? "");
  // Address filled by a lookup; a later lookup may replace it, but never an
  // address the admin typed.
  const autoAddress = useRef<string | null>(null);

  // Everything the form edits, as one draft (kept if closed by accident).
  const savedForm = {
    values: initialValues(supplier),
    categoryIds: supplier?.categories.map((c) => String(c.id)) ?? [],
    deliveryDays: supplier?.deliveryDays.map(String) ?? [],
    payment: paymentFrom(supplier),
  };
  type FormState = typeof savedForm;
  const draft = useFormDraft<FormState>({
    key: `supplier:${supplier?.id ?? "new"}`,
    values: { values, categoryIds, deliveryDays, payment },
    baseline: savedForm,
    enabled: open,
  });

  function applyForm(form: FormState) {
    // A draft from an older version of the form may lack newer fields.
    const next = { ...initialValues(supplier), ...form.values };
    setValues(next);
    setCategoryIds(form.categoryIds ?? []);
    setDeliveryDays(form.deliveryDays ?? []);
    setPayment({ ...paymentFrom(supplier), ...form.payment });
    setRucLookup({ status: "idle" });
    autoAddress.current = null;
    // A restored RUC is not asked again — unless its lookup never finished.
    const name = next.businessName.trim();
    lookedUpRuc.current = next.ruc;
    setNameUnlocked(Boolean(supplier) || name !== "");
    if (!supplier && !name && next.ruc.length === 11 && isValidRuc(next.ruc)) {
      void lookUpRuc(next.ruc);
    }
  }

  function handleClear() {
    const before: FormState = { values, categoryIds, deliveryDays, payment };
    applyForm(savedForm);
    draft.clear();
    setError(null);
    toastCleared(
      () => applyForm(before),
      supplier ? "Cambios deshechos" : "Campos limpiados",
    );
  }

  const set =
    (field: Field) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [field]: event.target.value }));

  // Checked as the 11th digit is typed, before saving.
  const ruc = values.ruc.trim();
  const rucInvalid = ruc.length === 11 && !isValidRuc(ruc);
  // The lookup state only describes a complete, valid RUC.
  const lookup: RucLookup =
    ruc.length === 11 && !rucInvalid ? rucLookup : { status: "idle" };
  const rucRegistered = lookup.status === "registered";
  const lookingUp = lookup.status === "loading";
  const rucHint = rucHintFor(ruc, rucInvalid, lookup);

  async function lookUpRuc(next: string) {
    lookedUpRuc.current = next;
    setRucLookup({ status: "loading" });

    const response = await lookupSupplierRuc(next, supplier?.id).catch(() => null);
    // The RUC was changed while SUNAT answered: this answer is stale.
    if (lookedUpRuc.current !== next) return;

    const result = response?.ok ? response.data : ({ status: "unavailable" } as const);
    if (result.status === "found") {
      // Another RUC means another company: replace the name.
      setValues((prev) => {
        const keepAddress =
          prev.address.trim() !== "" && prev.address !== autoAddress.current;
        if (!keepAddress) autoAddress.current = result.address;
        return {
          ...prev,
          businessName: result.businessName,
          address: keepAddress ? prev.address : (result.address ?? ""),
        };
      });
      setRucLookup({ status: "found" });
    } else {
      setRucLookup(result);
    }
    setNameUnlocked(true);
  }

  function handleRucChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/\D/g, "");
    setValues((prev) => ({ ...prev, ruc: next }));
    if (next.length === 11 && isValidRuc(next) && next !== lookedUpRuc.current) {
      void lookUpRuc(next);
    } else if (next.length < 11) {
      // Typing a new RUC: allow asking again, even for the previous one.
      lookedUpRuc.current = "";
    }
  }

  const timeInvalid =
    values.deliveryTimeFrom !== "" &&
    values.deliveryTimeTo !== "" &&
    values.deliveryTimeFrom >= values.deliveryTimeTo;

  const catalogHref = toHref(values.catalogUrl);
  const websiteHref = toHref(values.website);

  function handleOpenChange(next: boolean) {
    if (next) {
      // What was left unsaved last time, else what is saved.
      applyForm(draft.restore() ?? savedForm);
      setError(null);
    }
    setOpen(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const input = {
        ...values,
        categoryIds: categoryIds.map(Number),
        deliveryDays: deliveryDays.map(Number),
        ...paymentInput(payment),
      };
      const result = supplier
        ? await updateSupplier({ id: supplier.id, ...input })
        : await createSupplier(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(supplier ? "Proveedor actualizado" : "Proveedor registrado");
      draft.clear();
      setOpen(false);
    });
  }

  const openLink = (href: string | null, label: string) =>
    href && (
      <Button
        type="button"
        variant="outline"
        size="icon"
        // It renders a link, not a <button>.
        nativeButton={false}
        aria-label={label}
        title={label}
        render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      >
        <ExternalLinkIcon />
      </Button>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      handle={handle}
      // A stray tap outside must not throw away a half-filled form.
      disablePointerDismissal
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-2xl")}>
        <FormDialogHeader
          icon={TruckIcon}
          title={supplier ? "Editar proveedor" : "Nuevo proveedor"}
          description="Empresa o persona a la que le compras mercadería."
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody className="gap-6">
            <RequiredLegend className="-mb-3" />
            <FormSection icon={Building2Icon} title="Empresa">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  id="supplier-trade-name"
                  label="Nombre comercial"
                  required
                  hint={
                    <p className="text-xs text-muted-foreground">
                      Como lo conoce tu equipo. Se muestra en las listas.
                    </p>
                  }
                >
                  <Input
                    id="supplier-trade-name"
                    placeholder="Ej. Backus"
                    value={values.tradeName}
                    onChange={set("tradeName")}
                    maxLength={80}
                    required
                  />
                </Field>
                <Field
                  id="supplier-ruc"
                  label="RUC"
                  required
                  hint={
                    <p
                      role={rucHint.tone === "error" ? "alert" : undefined}
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        rucHint.tone === "error"
                          ? "text-destructive"
                          : rucHint.tone === "ok"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {lookingUp && (
                        <Loader2Icon className="size-3 animate-spin" aria-hidden />
                      )}
                      {rucHint.text}
                    </p>
                  }
                >
                  <Input
                    id="supplier-ruc"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="20100113610"
                    value={values.ruc}
                    onChange={handleRucChange}
                    aria-invalid={rucInvalid || rucRegistered}
                    required
                    className="font-mono"
                  />
                </Field>
                <Field
                  id="supplier-business-name"
                  label="Razón social"
                  required
                  className="sm:col-span-2"
                  hint={
                    !nameUnlocked ? (
                      <p className="text-xs text-muted-foreground">
                        Se llena sola al escribir el RUC.
                      </p>
                    ) : lookup.status === "found" ? (
                      <p className="text-xs text-muted-foreground">
                        Traída de SUNAT. Puedes corregirla o dejarla así.
                      </p>
                    ) : undefined
                  }
                >
                  <Input
                    id="supplier-business-name"
                    placeholder={
                      lookingUp
                        ? "Consultando SUNAT…"
                        : nameUnlocked
                          ? "Ej. UNIÓN DE CERVECERÍAS PERUANAS BACKUS Y JOHNSTON S.A.A."
                          : "Escribe el RUC para traerla de SUNAT"
                    }
                    value={values.businessName}
                    onChange={set("businessName")}
                    maxLength={150}
                    disabled={!nameUnlocked || lookingUp}
                    required
                  />
                </Field>
                <Field
                  id="supplier-address"
                  label="Dirección fiscal"
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    id="supplier-address"
                    placeholder="Como figura en SUNAT"
                    value={values.address}
                    onChange={set("address")}
                    maxLength={200}
                    required
                  />
                </Field>
                <Field
                  id="supplier-website"
                  label="Página web"
                  optional
                  className="sm:col-span-2"
                >
                  <div className="flex gap-2">
                    <Input
                      id="supplier-website"
                      type="text"
                      inputMode="url"
                      placeholder="Ej. www.backus.pe"
                      value={values.website}
                      onChange={set("website")}
                      maxLength={300}
                    />
                    {openLink(websiteHref, "Abrir página web")}
                  </div>
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon={UserIcon}
              title="Vendedor"
              description="quien toma tus pedidos"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="supplier-contact" label="Nombre del vendedor" required>
                  <Input
                    id="supplier-contact"
                    placeholder="Ej. Juan Pérez"
                    value={values.contactName}
                    onChange={set("contactName")}
                    maxLength={80}
                    required
                  />
                </Field>
                <Field id="supplier-phone" label="Celular del vendedor" required>
                  <Input
                    id="supplier-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="987 654 321"
                    value={values.phone}
                    onChange={set("phone")}
                    maxLength={15}
                    required
                  />
                </Field>
                <Field
                  id="supplier-email"
                  label="Correo corporativo"
                  optional
                  className="sm:col-span-2"
                >
                  <Input
                    id="supplier-email"
                    type="email"
                    placeholder="Ej. ventas@proveedor.pe"
                    value={values.email}
                    onChange={set("email")}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon={MessageSquareWarningIcon}
              title="Reclamos"
              description="productos vencidos, faltantes o en mal estado"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="supplier-claims-contact" label="Persona de contacto" optional>
                  <Input
                    id="supplier-claims-contact"
                    placeholder="Ej. María Torres"
                    value={values.claimsContactName}
                    onChange={set("claimsContactName")}
                    maxLength={80}
                  />
                </Field>
                <Field id="supplier-claims-phone" label="Celular para reclamos" optional>
                  <Input
                    id="supplier-claims-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="987 654 321"
                    value={values.claimsPhone}
                    onChange={set("claimsPhone")}
                    maxLength={15}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon={CalendarClockIcon} title="Reparto">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supplier-categories" required>
                  Categorías que te provee
                </Label>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay categorías.
                  </p>
                ) : (
                  <MultiCombobox
                    id="supplier-categories"
                    options={groupCategories(
                      categories.map((c) => ({ ...c, parentId: c.parentId ?? null })),
                    ).map(({ category }) => {
                      const parent = categories.find((c) => c.id === category.parentId);
                      return {
                        value: String(category.id),
                        label: parent ? `${category.name} · en ${parent.name}` : category.name,
                        icon: <CategoryGlyph icon={category.icon} />,
                      };
                    })}
                    value={categoryIds}
                    onValueChange={setCategoryIds}
                    placeholder="Busca y elige categorías…"
                    emptyText="Ninguna categoría coincide"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Escribe para buscar y elige varias. Si eliges una categoría
                  principal (Bebidas), también provee sus subcategorías.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label id="supplier-delivery-days-label" required>
                  Días de reparto
                </Label>
                <ToggleGroup
                  aria-labelledby="supplier-delivery-days-label"
                  multiple
                  value={deliveryDays}
                  onValueChange={(next) => setDeliveryDays(next as string[])}
                  variant="outline"
                  spacing={1}
                  className="grid w-full grid-cols-7"
                >
                  {WEEKDAYS.map((day) => (
                    <ToggleGroupItem
                      key={day.value}
                      value={String(day.value)}
                      aria-label={day.short}
                      title={day.short}
                      className="h-10 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      <span className="sm:hidden">{day.letter}</span>
                      <span className="hidden sm:inline">{day.short}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">
                  Los días que llega el pedido a la tienda.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Hora de entrega"
                  required
                  id="supplier-time-from"
                  hint={
                    timeInvalid && (
                      <p className="text-xs text-destructive">
                        La hora de inicio debe ser antes que la de fin.
                      </p>
                    )
                  }
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id="supplier-time-from"
                      type="time"
                      aria-label="Desde"
                      value={values.deliveryTimeFrom}
                      onChange={set("deliveryTimeFrom")}
                      required
                    />
                    <span className="text-sm text-muted-foreground">a</span>
                    <Input
                      type="time"
                      aria-label="Hasta"
                      value={values.deliveryTimeTo}
                      onChange={set("deliveryTimeTo")}
                      required
                      aria-invalid={timeInvalid || undefined}
                    />
                  </div>
                </Field>
                <Field
                  id="supplier-catalog"
                  label="Catálogo actualizado"
                  optional
                  hint={
                    <p className="text-xs text-muted-foreground">
                      Enlace a su web, Google Drive, PDF o app.
                    </p>
                  }
                >
                  <div className="flex gap-2">
                    <Input
                      id="supplier-catalog"
                      type="text"
                      inputMode="url"
                      placeholder="Ej. drive.google.com/…"
                      value={values.catalogUrl}
                      onChange={set("catalogUrl")}
                      maxLength={300}
                    />
                    {openLink(catalogHref, "Abrir catálogo")}
                  </div>
                </Field>
                <Field id="supplier-driver" label="Nombre del chofer" optional>
                  <Input
                    id="supplier-driver"
                    placeholder="Ej. Carlos Ramos"
                    value={values.driverName}
                    onChange={set("driverName")}
                    maxLength={80}
                  />
                </Field>
                <Field id="supplier-driver-phone" label="Celular del chofer" optional>
                  <Input
                    id="supplier-driver-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="987 654 321"
                    value={values.driverPhone}
                    onChange={set("driverPhone")}
                    maxLength={15}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              icon={WalletIcon}
              title="Medios de pago"
              description="opcional"
            >
              <SupplierPaymentFields
                value={payment}
                onChange={setPayment}
                vendorPhone={values.phone}
              />
            </FormSection>

            <FormSection icon={StickyNoteIcon} title="Notas u observaciones">
              <Field
                id="supplier-notes"
                label="Notas u observaciones"
                optional
                hint={
                  <span className="self-end text-xs text-muted-foreground tabular-nums">
                    {values.notes.length} / {NOTES_MAX}
                  </span>
                }
              >
                <Textarea
                  id="supplier-notes"
                  placeholder="Ej. Pedido mínimo S/ 200. Entrega al día siguiente. Avisar si falta algo al recibir."
                  value={values.notes}
                  onChange={set("notes")}
                  maxLength={NOTES_MAX}
                  rows={3}
                  className="max-h-40 min-h-20 resize-none"
                />
              </Field>
            </FormSection>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </FormDialogBody>
          <FormDialogFooter
            onClear={handleClear}
            clearLabel={supplier ? "Deshacer cambios" : "Limpiar"}
            clearDisabled={isPending}
            draftStatus={draft.status}
          >
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending}
            >
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              disabled={
                isPending ||
                rucInvalid ||
                rucRegistered ||
                lookingUp ||
                !nameUnlocked ||
                timeInvalid
              }
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </FormDialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
