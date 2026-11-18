import { ChartColumnIcon, FlaskConicalIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { SalesAnalyticsReport } from "@/application/use-cases/dashboard/sales-analytics";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { PAYMENT_TYPE_LABELS } from "@/domain/entities/sale";
import {
  ANALYTICS_PERIOD_LABELS,
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
} from "@/domain/entities/sales-analytics";
import { formatHourRange, percentOf } from "@/domain/services/sales-insights";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ChartCard, DataTableView, LegendItem } from "./chart-card";
import { Headline, KpiTile } from "./headline";
import { HourlyChart } from "./hourly-chart";
import { InsightList } from "./insights";
import { PaymentSplit } from "./payment-split";
import { RankedBars } from "./ranked-bars";
import { TrendChart } from "./trend-chart";

function periodHref(period: AnalyticsPeriod, demo: boolean) {
  const params = new URLSearchParams({ periodo: period });
  if (demo) params.set("ejemplo", "1");
  return `/admin?${params}#analisis`;
}

// One row above everything it scopes: every number below follows it.
function PeriodFilter({ current, demo }: { current: AnalyticsPeriod; demo: boolean }) {
  return (
    <nav
      aria-label="Periodo del análisis"
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:inline-grid sm:grid-cols-4"
    >
      {ANALYTICS_PERIODS.map((period) => (
        <Link
          key={period}
          href={periodHref(period, demo)}
          scroll={false}
          aria-current={period === current ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            period === current && "bg-background text-foreground shadow-xs",
          )}
        >
          {ANALYTICS_PERIOD_LABELS[period]}
        </Link>
      ))}
    </nav>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function SalesAnalyticsSection({
  report,
  demo,
}: {
  report: SalesAnalyticsReport;
  demo: boolean;
}) {
  const periodName = ANALYTICS_PERIOD_LABELS[report.period];
  const categoryTotal = report.categories.reduce((sum, c) => sum + c.revenue, 0);
  const topCategory = report.categories[0];
  const topPayment = report.payments[0];
  const paymentTotal = report.payments.reduce((sum, p) => sum + p.revenue, 0);
  const pointLabel = report.trend.unit === "hour" ? "Hora" : "Día";

  return (
    <section id="analisis" className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <ChartColumnIcon className="size-5 text-primary" aria-hidden />
            Análisis de ventas
          </h2>
          <p className="text-sm text-muted-foreground">
            Cómo va tu tienda, explicado en palabras. Siempre comparamos con el periodo anterior.
          </p>
        </div>
        <PeriodFilter current={report.period} demo={demo} />
      </div>

      {demo && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center">
          <FlaskConicalIcon className="size-5 shrink-0 text-amber-600" aria-hidden />
          <p className="flex-1">
            <strong>Estás viendo datos de ejemplo.</strong> Son ventas inventadas para que
            veas cómo se verá esta sección. No son de tu tienda.
          </p>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/admin?periodo=${report.period}#analisis`} scroll={false} />}
          >
            <XIcon data-icon="inline-start" />
            Salir del ejemplo
          </Button>
        </div>
      )}

      {report.isEmpty && !demo ? (
        <EmptyState
          icon={ChartColumnIcon}
          title={`Sin ventas en «${periodName}»`}
          description={`Tampoco hubo ventas antes (${report.previousLabel}). Prueba otro periodo arriba. Cuando haya ventas verás aquí si tu tienda vende más o menos, tus horas fuertes y tus productos estrella, explicado en frases simples.`}
          action={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={periodHref("7d", true)} scroll={false} />}
            >
              <FlaskConicalIcon data-icon="inline-start" />
              Ver un ejemplo con datos de muestra
            </Button>
          }
        />
      ) : (
        <>
          <Headline report={report} />

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Ventas"
              value={formatSoles(report.current.revenue)}
              change={report.changes.revenue}
              hint={`Frente a ${report.previousLabel}`}
            />
            <KpiTile
              label="Compras atendidas"
              value={String(report.current.orders)}
              change={report.changes.orders}
              hint="Cuántas veces cobraste"
            />
            <KpiTile
              label="Gasto promedio por cliente"
              value={formatSoles(report.averageTicket)}
              change={report.changes.averageTicket}
              hint="Lo que deja cada compra"
            />
            <KpiTile
              label="Ganancia aproximada"
              value={report.current.profit === null ? "—" : formatSoles(report.current.profit)}
              change={report.changes.profit}
              hint={
                report.current.profit === null
                  ? "Registra el precio de compra de tus productos para verla"
                  : "Ventas menos lo que te costó la mercadería"
              }
            />
          </div>

          <InsightList insights={report.insights} />

          <ChartCard
            title={report.period === "today" ? "¿Cómo van las ventas de hoy?" : "¿Cómo van tus ventas día a día?"}
            takeaway={`Si la línea azul va por encima de la gris, estás vendiendo más que ${report.previousLabel}.${
              report.trend.points.at(-1)?.partial
                ? ` El tramo punteado es ${report.trend.unit === "hour" ? "la hora actual" : "hoy"}, que aún no termina.`
                : ""
            }`}
            legend={
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <LegendItem color="var(--viz-1)" label={periodName} />
                <LegendItem color="var(--viz-previous)" label={`Antes (${report.previousLabel})`} />
              </div>
            }
            table={
              <DataTableView
                columns={[pointLabel, periodName, "Antes"]}
                rows={report.trend.points.map((p) => [
                  p.longLabel,
                  formatSoles(p.current),
                  p.previous === null ? "—" : formatSoles(p.previous),
                ])}
              />
            }
          >
            <TrendChart
              points={report.trend.points}
              currentLabel={periodName}
              previousLabel="Antes"
            />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            {report.period !== "today" && (
              <ChartCard
                title="¿A qué hora vendes más?"
                takeaway={
                  report.peakHour !== null
                    ? `Tu hora fuerte es ${formatHourRange(report.peakHour)} (barra azul oscuro). Ten la caja con sencillo y los estantes llenos a esa hora.`
                    : undefined
                }
                table={
                  <DataTableView
                    columns={["Hora", "Ventas", "Compras"]}
                    rows={report.hourly.map((h) => [
                      formatHourRange(h.hour),
                      formatSoles(h.revenue),
                      h.orders,
                    ])}
                  />
                }
              >
                {report.hourly.length > 0 ? (
                  <HourlyChart hourly={report.hourly} peakHour={report.peakHour} />
                ) : (
                  <Muted>Sin ventas en este periodo.</Muted>
                )}
              </ChartCard>
            )}

            <ChartCard
              title="¿Cómo te pagan?"
              takeaway={
                topPayment
                  ? `${percentOf(topPayment.revenue, paymentTotal)}% del dinero entró por ${PAYMENT_TYPE_LABELS[topPayment.paymentType]}.`
                  : undefined
              }
            >
              {report.payments.length > 0 ? (
                <PaymentSplit payments={report.payments} />
              ) : (
                <Muted>Sin ventas en este periodo.</Muted>
              )}
            </ChartCard>

            <ChartCard
              title="Tus productos estrella"
              takeaway="Los 5 productos que más dinero te dejaron. Que nunca falten en el estante."
            >
              {report.topProducts.length > 0 ? (
                <RankedBars
                  total={report.current.revenue}
                  items={report.topProducts.map((p) => ({
                    key: p.productId,
                    label: p.name,
                    value: p.revenue,
                    detail: `${p.units} ${p.units === 1 ? "unidad" : "unidades"}`,
                  }))}
                />
              ) : (
                <Muted>Sin ventas en este periodo.</Muted>
              )}
            </ChartCard>

            <ChartCard
              title="Ventas por categoría"
              takeaway={
                topCategory
                  ? `${topCategory.name} aporta el ${percentOf(topCategory.revenue, categoryTotal)}% de lo que vendes.`
                  : undefined
              }
            >
              {report.categories.length > 0 ? (
                <RankedBars
                  items={report.categories.slice(0, 6).map((c) => ({
                    key: c.categoryId,
                    label: c.name,
                    value: c.revenue,
                  }))}
                  total={categoryTotal}
                />
              ) : (
                <Muted>Sin ventas en este periodo.</Muted>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </section>
  );
}
