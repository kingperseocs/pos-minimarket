import { BanknoteIcon, CreditCardIcon, SmartphoneIcon } from "lucide-react";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/domain/entities/sale";
import type { PaymentSales } from "@/domain/entities/sales-analytics";
import { formatSoles } from "@/lib/money";

// Color follows the payment method, never its rank: cash is always blue.
const PAYMENT_COLORS: Record<PaymentType, string> = {
  cash: "var(--viz-1)",
  yape_plin: "var(--viz-2)",
  card: "var(--viz-3)",
};

const PAYMENT_ICONS = {
  cash: BanknoteIcon,
  yape_plin: SmartphoneIcon,
  card: CreditCardIcon,
} satisfies Record<PaymentType, unknown>;

// Part-to-whole in one bar (segments split by a 2px gap) plus a legend that
// prints every number, so the colors never have to be decoded.
export function PaymentSplit({ payments }: { payments: PaymentSales[] }) {
  const total = payments.reduce((sum, p) => sum + p.revenue, 0);
  if (total <= 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md" aria-hidden>
        {payments.map((p) => (
          <div
            key={p.paymentType}
            style={{ flexGrow: p.revenue, background: PAYMENT_COLORS[p.paymentType] }}
            className="h-full min-w-1"
          />
        ))}
      </div>
      <ul className="flex flex-col divide-y">
        {payments.map((p) => {
          const Icon = PAYMENT_ICONS[p.paymentType];
          return (
            <li key={p.paymentType} className="flex items-center gap-3 py-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: PAYMENT_COLORS[p.paymentType] }}
              />
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">{PAYMENT_TYPE_LABELS[p.paymentType]}</span>
              <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                {p.orders} {p.orders === 1 ? "compra" : "compras"}
              </span>
              <span className="w-24 text-right font-semibold tabular-nums">{formatSoles(p.revenue)}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {Math.round((p.revenue / total) * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
