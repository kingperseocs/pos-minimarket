import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { listSchedulesUseCase } from "@/application/use-cases/attendance/schedules";
import { AttendanceNav } from "@/components/admin/attendance/attendance-nav";
import { ScheduleEditor } from "@/components/admin/attendance/schedule-editor";
import { ApplyTemplateDialog } from "@/components/admin/attendance/shift-calendar/apply-template-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { USER_ROLE_LABELS } from "@/domain/entities/user";
import { addDays } from "@/domain/services/attendance";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { attendanceDeps } from "@/infrastructure/deps";
import { attendanceRepository } from "@/infrastructure/repositories";

// Weekly template of each cashier and warehouse keeper. It doesn't decide
// anything by itself: it fills the calendar (Horarios) in one click.
export default async function ScheduleTemplatePage() {
  const [people, schedules, pending] = await Promise.all([
    attendanceRepository.listPeople(),
    listSchedulesUseCase(attendanceDeps),
    attendanceRepository.countPendingCorrections(),
  ]);
  const active = people.filter((p) => p.isActive && p.role !== "admin");
  const today = storeDateKey(new Date());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plantilla semanal"
        description="La semana típica de cada persona. Aplícala al calendario para crear sus turnos; las tardanzas y faltas se cuentan con el calendario."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" nativeButton={false} render={<Link href="/admin/asistencia/horarios" />}>
              <ArrowLeftIcon />
              Volver al calendario
            </Button>
            <ApplyTemplateDialog defaultFrom={today} defaultTo={addDays(today, 27)} />
          </div>
        }
      />
      <AttendanceNav current="horarios" pendingCorrections={pending} />
      {active.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Todavía no hay personal"
          description="Crea usuarios con rol Cajero o Almacenero para asignarles un horario."
          action={
            <Button nativeButton={false} render={<Link href="/admin/users" />}>
              Ir a Usuarios
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {active.map((person) => (
            <ScheduleEditor
              key={person.id}
              person={{ id: person.id, name: person.name, roleLabel: USER_ROLE_LABELS[person.role] }}
              schedules={schedules.filter((s) => s.userId === person.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
