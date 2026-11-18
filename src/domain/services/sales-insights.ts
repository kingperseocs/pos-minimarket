import { PAYMENT_TYPE_LABELS } from "../entities/sale";
import {
  type AnalyticsPeriod,
  type CategorySales,
  type DailySales,
  type HourlySales,
  type PaymentSales,
  PREVIOUS_PERIOD_LABELS,
  type ProductSales,
  type SalesTotals,
} from "../entities/sales-analytics";
import { round2 } from "../value-objects/money";
import { STORE_TIME_ZONE } from "../value-objects/store-time";

// Changes smaller than this (in %) read as "stable": a 1% wobble is noise to
// a shop owner, not news.
export const STEADY_THRESHOLD = 3;

export type InsightTone = "good" | "bad" | "neutral";

export type InsightIcon =
  | "trend-up"
  | "trend-down"
  | "steady"
  | "calendar"
  | "clock"
  | "star"
  | "category"
  | "plane"
  | "coins"
  | "wallet";

// One finding in plain words: the admin reads sentences, not axes.
export interface Insight {
  tone: InsightTone;
  icon: InsightIcon;
  title: string;
  detail: string;
}

export interface InsightInput {
  period: AnalyticsPeriod;
  current: SalesTotals;
  previous: SalesTotals;
  daily: DailySales[];
  hourly: HourlySales[];
  topProducts: ProductSales[];
  categories: CategorySales[];
  payments: PaymentSales[];
}

const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function formatSoles(value: number) {
  return soles.format(value);
}

// Whole-number % change, or null when there is nothing to compare against.
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function percentOf(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function averageTicket(totals: { revenue: number; orders: number }) {
  return totals.orders > 0 ? round2(totals.revenue / totals.orders) : 0;
}

const dayFormat = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: STORE_TIME_ZONE,
});

// "jueves 2 de octubre" for a store day key.
export function formatDayKey(dateKey: string) {
  return dayFormat.format(new Date(`${dateKey}T12:00:00-05:00`)).replace(",", "");
}

function partOfDay(hour: number) {
  if (hour < 5) return "de la madrugada";
  if (hour < 12) return "de la mañana";
  if (hour < 19) return "de la tarde";
  return "de la noche";
}

// "de 6 a 7 de la tarde": how people say it, not "18:00–19:00".
export function formatHourRange(hour: number) {
  const twelve = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  return `de ${twelve(hour)} a ${twelve(hour + 1)} ${partOfDay(hour)}`;
}

function revenueInsight(input: InsightInput): Insight {
  const { current, previous, period } = input;
  const against = PREVIOUS_PERIOD_LABELS[period];
  const change = percentChange(current.revenue, previous.revenue);

  if (change === null) {
    return {
      tone: "neutral",
      icon: "steady",
      title: `Vendiste ${formatSoles(current.revenue)}`,
      detail: `Aún no hay con qué comparar: no hubo ventas antes (${against}).`,
    };
  }
  const detail = `Comparado con ${against}: ${formatSoles(previous.revenue)} entonces, ${formatSoles(current.revenue)} ahora.`;
  if (Math.abs(change) < STEADY_THRESHOLD) {
    return { tone: "neutral", icon: "steady", title: "Tus ventas se mantienen estables", detail };
  }
  return change > 0
    ? { tone: "good", icon: "trend-up", title: `Tus ventas subieron ${change}%`, detail }
    : { tone: "bad", icon: "trend-down", title: `Tus ventas bajaron ${Math.abs(change)}%`, detail };
}

// Why revenue moved: more customers, or each one spending more/less.
function ordersInsight({ current, previous }: InsightInput): Insight | null {
  if (current.orders === 0 || previous.orders === 0) return null;
  const orderDiff = current.orders - previous.orders;
  const ticketNow = averageTicket(current);
  const ticketBefore = averageTicket(previous);
  const ticketChange = percentChange(ticketNow, ticketBefore) ?? 0;

  const customers =
    orderDiff === 0
      ? "Atendiste la misma cantidad de compras"
      : orderDiff > 0
        ? `Atendiste ${orderDiff} ${orderDiff === 1 ? "compra más" : "compras más"} (${current.orders} en total)`
        : `Atendiste ${Math.abs(orderDiff)} ${orderDiff === -1 ? "compra menos" : "compras menos"} (${current.orders} en total)`;
  const ticket =
    Math.abs(ticketChange) < STEADY_THRESHOLD
      ? `y cada cliente gastó lo mismo en promedio (${formatSoles(ticketNow)}).`
      : ticketChange > 0
        ? `y cada cliente gastó más: ${formatSoles(ticketNow)} en promedio, antes ${formatSoles(ticketBefore)}.`
        : `y cada cliente gastó menos: ${formatSoles(ticketNow)} en promedio, antes ${formatSoles(ticketBefore)}.`;

  // Same "stable" band as the tiles, so a card never contradicts them.
  const ordersChange = percentChange(current.orders, previous.orders) ?? 0;
  const better = ordersChange >= STEADY_THRESHOLD || ticketChange >= STEADY_THRESHOLD;
  const worse = ordersChange <= -STEADY_THRESHOLD || ticketChange <= -STEADY_THRESHOLD;
  return {
    tone: better && !worse ? "good" : worse && !better ? "bad" : "neutral",
    icon: "wallet",
    title: "Clientes y gasto por compra",
    detail: `${customers} ${ticket}`,
  };
}

function bestDayInsight({ period, daily }: InsightInput): Insight | null {
  const withSales = daily.filter((day) => day.revenue > 0);
  if (period === "today" || withSales.length < 2) return null;
  const best = withSales.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  return {
    tone: "neutral",
    icon: "calendar",
    title: `Tu mejor día fue el ${formatDayKey(best.dateKey)}`,
    detail: `Vendiste ${formatSoles(best.revenue)} en ${best.orders} ${best.orders === 1 ? "compra" : "compras"}.`,
  };
}

export function peakHour(hourly: HourlySales[]): HourlySales | null {
  const withSales = hourly.filter((h) => h.orders > 0);
  if (withSales.length === 0) return null;
  return withSales.reduce((a, b) => (b.revenue > a.revenue ? b : a));
}

function peakHourInsight({ hourly, current }: InsightInput): Insight | null {
  const peak = peakHour(hourly);
  if (!peak || current.orders < 3) return null;
  return {
    tone: "neutral",
    icon: "clock",
    title: `Vendes más ${formatHourRange(peak.hour)}`,
    detail: `${percentOf(peak.revenue, current.revenue)}% de tus ventas. Ten la caja con sencillo y los estantes llenos a esa hora.`,
  };
}

function starProductInsight({ topProducts }: InsightInput): Insight | null {
  const [star] = topProducts;
  if (!star) return null;
  return {
    tone: "neutral",
    icon: "star",
    title: `Tu producto estrella: ${star.name}`,
    detail: `${star.units} ${star.units === 1 ? "unidad vendida" : "unidades vendidas"} por ${formatSoles(star.revenue)}. Que nunca falte en el estante.`,
  };
}

function categoryInsight({ categories, current }: InsightInput): Insight | null {
  if (categories.length < 2) return null;
  const [top] = categories;
  const total = categories.reduce((sum, c) => sum + c.revenue, 0);
  return {
    tone: "neutral",
    icon: "category",
    title: `${top.name} es lo que más se vende`,
    detail: `Aporta el ${percentOf(top.revenue, total || current.revenue)}% de lo que vendiste.`,
  };
}

function workersInsight({ current }: InsightInput): Insight | null {
  if (current.workerRevenue <= 0) return null;
  const gifts =
    current.birthdayGifts > 0
      ? ` y ${formatSoles(current.birthdayGifts)} en regalos de cumpleaños`
      : "";
  return {
    tone: "neutral",
    icon: "plane",
    title: `Los trabajadores del aeropuerto compraron el ${percentOf(current.workerRevenue, current.revenue)}%`,
    detail: `Pagaron ${formatSoles(current.workerRevenue)}. Les diste ${formatSoles(current.workerDiscount)} de descuento${gifts}.`,
  };
}

function profitInsight({ current }: InsightInput): Insight | null {
  if (current.profit === null || current.revenue <= 0) return null;
  const partial =
    current.costCoverage < 0.999
      ? " Algunos productos no tienen precio de compra, así que la ganancia real es algo mayor."
      : "";
  return {
    tone: current.profit >= 0 ? "good" : "bad",
    icon: "coins",
    title:
      current.profit >= 0
        ? `Ganaste aprox. ${formatSoles(current.profit)}`
        : `Perdiste aprox. ${formatSoles(Math.abs(current.profit))}`,
    detail: `De cada S/ 10 que vendes, te quedan unos S/ ${((current.profit / current.revenue) * 10).toFixed(2)} después de pagar la mercadería.${partial}`,
  };
}

function paymentInsight({ payments }: InsightInput): Insight | null {
  const total = payments.reduce((sum, p) => sum + p.revenue, 0);
  if (payments.length < 2 || total <= 0) return null;
  const top = payments.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  return {
    tone: "neutral",
    icon: "wallet",
    title: `La mayoría paga con ${PAYMENT_TYPE_LABELS[top.paymentType]}`,
    detail: `${percentOf(top.revenue, total)}% del dinero entró por ese medio.`,
  };
}

// Turns the numbers into a headline plus short findings, most useful first.
export function buildSalesInsights(input: InsightInput): {
  headline: Insight;
  insights: Insight[];
} {
  return {
    headline: revenueInsight(input),
    insights: [
      ordersInsight(input),
      profitInsight(input),
      starProductInsight(input),
      peakHourInsight(input),
      bestDayInsight(input),
      categoryInsight(input),
      workersInsight(input),
      paymentInsight(input),
    ].filter((insight): insight is Insight => insight !== null),
  };
}
