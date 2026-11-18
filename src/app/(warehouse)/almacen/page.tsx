import {
  ArrowRightLeftIcon,
  ClipboardCheckIcon,
  PackagePlusIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import {
  getExpiringLotsUseCase,
  getInventoryUseCase,
} from "@/application/use-cases/inventory/get-inventory";
import { listReceiptsUseCase } from "@/application/use-cases/inventory/receive-goods";
import { ExpiringLotsPanel } from "@/components/admin/inventory/expiring-lots-panel";
import { Badge } from "@/components/ui/badge";
import { STORE_TIME_ZONE, storeDateKey } from "@/domain/value-objects/store-time";
import { WarehouseStockList } from "@/components/warehouse/warehouse-stock-list";
import { Skeleton } from "@/components/ui/skeleton";
import { inventoryRepository, receivingRepository } from "@/infrastructure/repositories";

const ACTIONS = [
  {
    href: "/almacen/ingreso",
    title: "Recibir mercadería",
    detail: "Llegó el proveedor: cuenta lo que deja",
    icon: PackagePlusIcon,
  },
  {
    href: "/almacen/traslado",
    title: "Trasladar a Tienda",
    detail: "Llevar productos para vender",
    icon: ArrowRightLeftIcon,
  },
  {
    href: "/almacen/conteo",
    title: "Conteo del día",
    detail: "Unos pocos productos para revisar hoy",
    icon: ClipboardCheckIcon,
  },
];

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

// Today's receptions and whether the admin already registered their
// invoice. No amounts: the Almacén doesn't handle money.
async function TodayReceptions() {
  const today = storeDateKey(new Date());
  const receipts = (await listReceiptsUseCase(receivingRepository)).filter(
    (r) => storeDateKey(r.receivedAt) === today,
  );
  if (receipts.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading font-semibold">Recepciones de hoy</h2>
      <ul className="divide-y rounded-xl border bg-card">
        {receipts.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <span className="tabular-nums text-muted-foreground">
              {timeFormat.format(r.receivedAt)}
            </span>
            <span className="font-medium">{r.supplierName ?? "Sin proveedor"}</span>
            <span className="text-muted-foreground">
              {r.lines.length} {r.lines.length === 1 ? "producto" : "productos"} ·{" "}
              {r.lines.reduce((sum, line) => sum + line.receivedUnits, 0)} und
            </span>
            <Badge
              variant="outline"
              className={
                r.invoiceStatus === "pending"
                  ? "ml-auto border-sky-500/40 text-sky-700 dark:text-sky-400"
                  : "ml-auto text-emerald-700 dark:text-emerald-400"
              }
            >
              {r.invoiceStatus === "pending" ? "Esperando factura" : "Factura registrada"}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function StockSection() {
  const [{ locations, stock }, expiring] = await Promise.all([
    getInventoryUseCase(inventoryRepository),
    getExpiringLotsUseCase(inventoryRepository),
  ]);
  return (
    <>
      <ExpiringLotsPanel
        lots={expiring.lots}
        todayKey={expiring.todayKey}
        forWarehouse
      />
      <WarehouseStockList
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        stock={stock
          .filter((s) => s.isActive)
          .map((s) => ({
            productId: s.productId,
            productName: s.productName,
            categoryName: s.categoryName,
            byLocation: s.byLocation,
          }))}
      />
    </>
  );
}

export default function WarehouseHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ href, title, detail, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-heading text-lg font-semibold">{title}</span>
              <span className="text-sm text-muted-foreground">{detail}</span>
            </span>
          </Link>
        ))}
      </div>
      <Suspense fallback={null}>
        <TodayReceptions />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <StockSection />
      </Suspense>
    </div>
  );
}
