import { CalendarCogIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { listShiftStaffUseCase } from "@/application/use-cases/attendance/work-shifts";
import { AttendanceNav } from "@/components/admin/attendance/attendance-nav";
import { ShiftCalendar } from "@/components/admin/attendance/shift-calendar/shift-calendar";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { attendanceDeps } from "@/infrastructure/deps";
import { attendanceRepository } from "@/infrastructure/repositories";

// The staff calendar: which days each cashier and warehouse keeper works and
// from when to when. It decides who was late, who left early and who missed
// a day, and when "Marcar entrada" opens.
export default async function SchedulesPage() {
  const [staff, pending] = await Promise.all([
    listShiftStaffUseCase(attendanceDeps),
    attendanceRepository.countPendingCorrections(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Horarios"
        description="Qué días trabaja cada persona y a qué hora entra y sale. Un día sin turno es día libre: no puede marcar entrada ni cuenta como falta."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/asistencia/horarios/plantilla" />}
          >
            <CalendarCogIcon />
            Plantilla semanal
          </Button>
        }
      />
      <AttendanceNav current="horarios" pendingCorrections={pending} />
      {staff.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Todavía no hay personal"
          description="Crea usuarios con rol Cajero o Almacenero para asignarles turnos."
          action={
            <Button nativeButton={false} render={<Link href="/admin/users" />}>
              Ir a Usuarios
            </Button>
          }
        />
      ) : (
        <ShiftCalendar
          staff={staff.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
        />
      )}
    </div>
  );
}
