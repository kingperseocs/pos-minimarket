import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getSalesAnalyticsUseCase } from "@/application/use-cases/dashboard/sales-analytics";
import { getSetupProgressUseCase } from "@/application/use-cases/dashboard/setup-progress";
import { getGoalProgressUseCase } from "@/application/use-cases/goals/goal-progress";
import { GoalHeroCard } from "@/components/goals/goal-hero-card";
import { goalDeps } from "@/infrastructure/deps";
import { getExpiringLotsUseCase } from "@/application/use-cases/inventory/get-inventory";
import { ExpiringLotsPanel } from "@/components/admin/inventory/expiring-lots-panel";
import { SalesAnalyticsSection } from "@/components/admin/analytics/sales-analytics-section";
import { SetupSteps } from "@/components/admin/setup-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
} from "@/domain/entities/sales-analytics";
import {
  cashShiftRepository,
  categoryRepository,
  inventoryRepository,
  productRepository,
  salesAnalyticsRepository,
  salesGoalRepository,
  sampleSalesAnalyticsRepository,
  supplierRepository,
} from "@/infrastructure/repositories";

async function SetupSection() {
  const progress = await getSetupProgressUseCase({
    categories: categoryRepository,
    suppliers: supplierRepository,
    products: productRepository,
    inventory: inventoryRepository,
  });
  return <SetupSteps progress={progress} />;
}

// Till shifts that need the admin: closed and not reviewed, or open too long.
async function CashSection() {
  const { closed, openLong } = await cashShiftRepository.countByStatus();
  if (closed === 0 && openLong === 0) return null;
  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>
        {[
          closed > 0 && `${closed} ${closed === 1 ? "caja por revisar" : "cajas por revisar"}`,
          openLong > 0 &&
            `${openLong} ${openLong === 1 ? "caja abierta" : "cajas abiertas"} hace más de 12 horas`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </AlertTitle>
      <AlertDescription>
        <Link href="/admin/caja" className="underline">
          Ver cierres de caja
        </Link>
      </AlertDescription>
    </Alert>
  );
}

async function ExpiringSection() {
  const { lots, todayKey } = await getExpiringLotsUseCase(inventoryRepository);
  return <ExpiringLotsPanel lots={lots} todayKey={todayKey} limit={5} />;
}

// The month's sales goal with the dog. In the example mode the sales are made
// up too, against the real goal (or S/ 20,000 if there is none yet).
async function GoalSection({ demo }: { demo: boolean }) {
  const progress = await getGoalProgressUseCase(
    demo
      ? {
          goals: {
            findEffective: async (month) =>
              (await salesGoalRepository.findEffective(month)) ?? {
                id: 0,
                month,
                amount: 20000,
                createdById: null,
                createdAt: new Date(),
              },
          },
          analytics: sampleSalesAnalyticsRepository,
        }
      : goalDeps,
  );
  return <GoalHeroCard progress={progress} demo={demo} />;
}

// "?ejemplo=1" swaps in made-up sales so the admin can preview the section
// before the store has real ones (the page says so clearly).
async function AnalyticsSection({ period, demo }: { period: AnalyticsPeriod; demo: boolean }) {
  const report = await getSalesAnalyticsUseCase(
    demo ? sampleSalesAnalyticsRepository : salesAnalyticsRepository,
    period,
  );
  return <SalesAnalyticsSection report={report} demo={demo} />;
}

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const { periodo, ejemplo } = await searchParams;
  const period: AnalyticsPeriod = ANALYTICS_PERIODS.includes(periodo as AnalyticsPeriod)
    ? (periodo as AnalyticsPeriod)
    : "7d";
  const demo = ejemplo === "1";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Gestiona tu tienda y mira cómo van tus ventas.
        </p>
      </div>
      <Suspense fallback={null}>
        <CashSection />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <SetupSection />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-56 rounded-xl" />}>
        <GoalSection demo={demo} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-xl" />}>
        <AnalyticsSection period={period} demo={demo} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <ExpiringSection />
      </Suspense>
    </div>
  );
}
