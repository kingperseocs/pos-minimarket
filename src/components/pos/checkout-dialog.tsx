"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/domain/entities/sale";
import type { SaleDocumentRequest } from "@/domain/entities/sale-document";
import { documentRequestErrors } from "@/domain/services/e-invoice";
import type { SalePricing } from "@/domain/services/sale-pricing";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { BUSINESS } from "@/lib/business";
import { formatSoles } from "@/lib/money";
import type { CartItem } from "@/types";
import { DocumentPicker } from "./document-picker";
import { PAYMENT_TYPE_ICONS } from "./pos-icons";

const dateTime = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

// A dashed rule, like the separators printed on a thermal receipt.
function Rule() {
  return <div aria-hidden className="my-2 border-t border-dashed border-foreground/30" />;
}

function Row({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex justify-between gap-3 ${className ?? ""}`}>
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

// Final confirmation, laid out like the store's printed ticket: header with
// the business and RUC, one line per product, totals and payment. The
// payment method is chosen in the cart, before "Cobrar".
export function CheckoutDialog({
  open,
  pricing,
  items,
  workerName,
  promoName,
  paymentType,
  document,
  onDocumentChange,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pricing: SalePricing;
  // The basket, in the same order as pricing.lines.
  items: CartItem[];
  workerName: string | null;
  // Name of the percentage discount applied, if any.
  promoName: string | null;
  paymentType: PaymentType;
  // Electronic document to issue (boleta by default).
  document: SaleDocumentRequest;
  onDocumentChange: (document: SaleDocumentRequest) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const Icon = PAYMENT_TYPE_ICONS[paymentType];
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const documentValid = documentRequestErrors(document, pricing.total).length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-4 bg-muted/60 sm:max-w-sm"
        // A plain dark veil (no blur), like the documents modal.
        overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-none"
      >
        <DialogTitle className="sr-only">Confirmar cobro</DialogTitle>
        <DialogDescription className="sr-only">
          Revisa el ticket antes de registrar la venta.
        </DialogDescription>

        {/* Boleta or factura first: the customer's document is asked before
            reviewing the ticket. */}
        <DocumentPicker value={document} total={pricing.total} onChange={onDocumentChange} />

        {/* The ticket: white paper with a torn (zigzag) bottom edge. */}
        <div
          className="max-h-[45vh] overflow-y-auto bg-white px-5 pt-5 pb-7 font-mono text-[13px] leading-snug text-neutral-900 shadow-md dark:bg-neutral-100"
          style={{
            maskImage:
              "linear-gradient(#000 0 0) top/100% calc(100% - 10px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/16px 10px repeat-x",
            WebkitMaskImage:
              "linear-gradient(#000 0 0) top/100% calc(100% - 10px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/16px 10px repeat-x",
          }}
        >
          <div className="text-center">
            <p className="text-lg font-bold tracking-widest">{BUSINESS.name}</p>
            <p>RUC {BUSINESS.ruc}</p>
            <p className="mt-1 font-semibold">TICKET DE VENTA</p>
            <p className="text-[11px] text-neutral-500">{dateTime.format(new Date())}</p>
          </div>

          <Rule />
          <div className="flex justify-between text-[11px] font-semibold text-neutral-500">
            <span>CANT. DESCRIPCIÓN</span>
            <span>IMPORTE</span>
          </div>
          <Rule />

          <ul className="flex flex-col gap-1.5">
            {items.map((item, index) => {
              const line = pricing.lines[index];
              return (
                <li key={`${item.productId}-${index}`}>
                  <Row
                    label={
                      <span className="break-words">
                        {item.quantity} {item.name.toUpperCase()}
                      </span>
                    }
                    value={formatSoles(line?.gross ?? item.unitPrice * item.quantity)}
                  />
                  <p className="pl-4 text-[11px] text-neutral-500">
                    {item.quantity} x {formatSoles(item.unitPrice)}
                  </p>
                  {line && line.discountAmount > 0 && (
                    <Row
                      className="pl-4 text-[11px] text-emerald-700"
                      label={`Dscto. ${line.discountedQuantity} und`}
                      value={`−${formatSoles(line.discountAmount)}`}
                    />
                  )}
                  {line && line.giftAmount > 0 && (
                    <Row
                      className="pl-4 text-[11px] text-orange-600"
                      label="Regalo de cumpleaños"
                      value={`−${formatSoles(line.giftAmount)}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <Rule />
          <Row label={`SUBTOTAL (${units} und)`} value={formatSoles(pricing.subtotal)} />
          {pricing.discountTotal > 0 && (
            <Row
              className="text-emerald-700"
              label={
                pricing.promo
                  ? `DSCTO. TRABAJADOR ${pricing.promo.percent}%${promoName ? ` (${promoName})` : ""}`
                  : "DSCTO. TRABAJADOR"
              }
              value={`−${formatSoles(pricing.discountTotal)}`}
            />
          )}
          {pricing.giftTotal > 0 && (
            <Row
              className="text-orange-600"
              label="REGALO CUMPLEAÑOS"
              value={`−${formatSoles(pricing.giftTotal)}`}
            />
          )}
          {pricing.rounding !== 0 && (
            <Row
              label="REDONDEO"
              value={`${pricing.rounding > 0 ? "+" : "−"}${formatSoles(Math.abs(pricing.rounding))}`}
            />
          )}
          {pricing.redeemTotal > 0 && (
            <Row
              className="text-orange-600"
              label={`CANJE ${pricing.pointsRedeemed} PTS`}
              value={`−${formatSoles(pricing.redeemTotal)}`}
            />
          )}

          <div className="my-2 border-t-2 border-double border-neutral-900" />
          <Row
            className="text-xl font-bold"
            label="TOTAL"
            value={formatSoles(pricing.total)}
          />
          <div className="my-2 border-t-2 border-double border-neutral-900" />

          <Row
            label="PAGO"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Icon className="size-4" aria-hidden />
                {PAYMENT_TYPE_LABELS[paymentType].toUpperCase()}
              </span>
            }
          />
          {workerName && <Row label="TRABAJADOR" value={workerName.toUpperCase()} />}
          {pricing.pointsEarned > 0 && workerName && (
            <Row label="PUNTOS GANADOS" value={`+${pricing.pointsEarned}`} />
          )}

          <Rule />
          <p className="text-center text-[11px] text-neutral-500">
            ¡Gracias por su compra!
            <br />
            Vista previa · al confirmar se emite e imprime la{" "}
            {document.type === "factura" ? "factura" : "boleta"} electrónica
          </p>
        </div>

        <DialogFooter className="mx-0 mb-0 gap-2 border-0 bg-transparent p-0 sm:gap-2">
          <Button
            variant="outline"
            className="h-12 bg-background text-base"
            onClick={() => onOpenChange(false)}
          >
            Volver
          </Button>
          <Button
            className="h-12 text-base font-semibold"
            autoFocus
            disabled={!documentValid}
            onClick={onConfirm}
          >
            Confirmar venta · {formatSoles(pricing.total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
