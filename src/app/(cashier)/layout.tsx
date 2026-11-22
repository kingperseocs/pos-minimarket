import { ReceiptTextIcon, StoreIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AttendanceBadge } from "@/components/attendance/attendance-badge";
import { AttendanceGate } from "@/components/attendance/attendance-gate";
import { AttendanceProvider } from "@/components/attendance/attendance-provider";
import { initialAttendance } from "@/components/attendance/initial-state";
import { AppFooter } from "@/components/layout/app-footer";
import { AreaLinks } from "@/components/layout/area-links";
import { LogoutButton } from "@/components/layout/logout-button";
import { CloseShiftButton } from "@/components/pos/close-shift-button";
import { getCashierGoalProgressUseCase } from "@/application/use-cases/goals/goal-progress";
import { GoalChip } from "@/components/goals/goal-chip";
import { goalDeps } from "@/infrastructure/deps";
import { requirePagePermission } from "@/infrastructure/auth/guards";

export default async function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePagePermission("sell");
  const [attendance, goal] = await Promise.all([
    initialAttendance(user),
    // The team's monthly goal: only the percentage, no sales amounts.
    getCashierGoalProgressUseCase(goalDeps),
  ]);

  return (
    <AttendanceProvider
      userId={user.id}
      name={user.name ?? ""}
      role={user.role}
      initial={attendance}
    >
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex items-center gap-2 font-heading font-semibold">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <StoreIcon className="size-4" aria-hidden />
              </span>
              <span className="hidden sm:inline">NAVEXPRESS ·</span> Caja
            </span>
            <GoalChip goal={goal} align="start" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <AreaLinks role={user.role} current="sell" />
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/pos/comprobantes" />}>
              <ReceiptTextIcon data-icon="inline-start" />
              <span className="hidden md:inline">Comprobantes</span>
            </Button>
            <AttendanceBadge />
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <UserRoundIcon className="size-4" aria-hidden />
              {user.name}
            </span>
            {/* Shown only while a shift is open at the till. */}
            <CloseShiftButton />
            <LogoutButton />
          </div>
        </header>
        {/* Cashiers see the till only after "Marcar entrada". */}
        <main className="flex-1">
          <AttendanceGate>{children}</AttendanceGate>
        </main>
        <AppFooter />
      </div>
    </AttendanceProvider>
  );
}
