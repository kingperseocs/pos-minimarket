import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { dailyReportUseCase } from "@/application/use-cases/e-invoicing/daily-report";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { formatDayHeading } from "@/lib/day-heading";
import { formatSoles } from "@/lib/money";
import { eInvoicingDeps } from "@/infrastructure/deps";

function Stat({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {note && <CardContent className="text-sm text-muted-foreground">{note}</CardContent>}
    </Card>
  );
}

// The day's invoicing: what the till charged next to what was declared to
// SUNAT, so the cashier's close and the accountant's numbers can be checked.
export default async function DailyInvoicingReportPage({ searchParams }: PageProps<"/admin/comprobantes/reporte">) {
  const today = storeDateKey(new Date());
  const requested = (await searchParams).date;
  const date = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const { pos, motor, motorError } = await dailyReportUseCase(eInvoicingDeps, date);
  const pen = motor?.monedas.find((m) => m.moneda === "PEN") ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reporte del día"
        description={<span className="font-medium tracking-wide">{formatDayHeading(date)}</span>}
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={`/admin/comprobantes?date=${date}`} />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Comprobantes del día
          </Button>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">En la caja</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat title="Ventas" value={formatSoles(pos.salesTotal)} note={`${pos.sales} venta(s)`} />
          <Stat title="Con comprobante emitido" value={formatSoles(pos.issuedTotal)} note={`${pos.issued} comprobante(s)`} />
          <Stat title="En revisión" value={formatSoles(pos.reviewTotal)} note={`${pos.review} venta(s)`} />
          <Stat title="Por emitir o con error" value={formatSoles(pos.pendingTotal)} note={`${pos.pending} venta(s)`} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Declarado a SUNAT</h2>
        {motorError ? (
          <p className="flex items-center gap-2 rounded-md border p-4 text-sm text-red-700 dark:text-red-400">
            <TriangleAlertIcon className="size-4" aria-hidden />
            No se pudo consultar el sistema de facturación: {motorError}
          </p>
        ) : pen ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Stat title="Ventas (boletas y facturas)" value={formatSoles(pen.resumen.ventas)} />
              <Stat title="Notas de crédito" value={`−${formatSoles(pen.resumen.notas_credito)}`} />
              <Stat title="Neto" value={formatSoles(pen.resumen.neto)} note={`IGV ${formatSoles(pen.resumen.igv)}`} />
              <Stat
                title="Operaciones"
                value={formatSoles(pen.resumen.op_gravadas)}
                note={`Gravadas · exoneradas ${formatSoles(pen.resumen.op_exoneradas)}`}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Por tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pen.por_tipo.map((t) => (
                        <TableRow key={t.tipo_comprobante}>
                          <TableCell>{t.tipo_descripcion}</TableCell>
                          <TableCell className="text-right tabular-nums">{t.cantidad}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatSoles(t.importe)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Por cajero</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cajero</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pen.por_cajero.map((c) => (
                        <TableRow key={c.cajero}>
                          <TableCell>{c.cajero}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.cantidad}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatSoles(c.neto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Por estado en SUNAT</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1 text-sm">
                    {motor!.por_estado
                      .filter((s) => s.cantidad > 0)
                      .map((s) => (
                        <li key={s.estado} className="flex justify-between">
                          <span>{s.estado}</span>
                          <span className="tabular-nums">{s.cantidad}</span>
                        </li>
                      ))}
                    {motor!.por_enviar > 0 && (
                      <li className="mt-1 text-amber-700 dark:text-amber-400">
                        {motor!.por_enviar} por enviar a SUNAT (se reenvían solos)
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">Sin comprobantes en soles este día.</p>
        )}
      </section>
    </div>
  );
}
