"use client";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./shift-calendar.css";

import { addDays, addMinutes, format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  ClipboardPasteIcon,
  CopyIcon,
  CalendarRangeIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type Messages,
  type SlotInfo,
  type View,
} from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import { toast } from "sonner";
import { listShifts, pasteShifts, updateShift, createShift } from "@/actions/attendance";
import { Button } from "@/components/ui/button";
import type { WorkShift } from "@/domain/entities/attendance";
import { shiftMinutes } from "@/domain/services/work-shifts";
import { cn } from "@/lib/utils";
import {
  atLocal,
  patternOf,
  preferredColor,
  shiftToEvent,
  textOn,
  toDateKey,
  toHHMM,
  visibleRange,
  WEEK_STARTS_ON,
  type Clipboard,
  type ShiftEvent,
  type StaffMember,
} from "./calendar-utils";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { PasteRangeDialog } from "./paste-range-dialog";
import { pasteSummary } from "./paste-summary";
import { draftFromShift, newDraft, ShiftDialog, type ShiftDraft } from "./shift-dialog";
import { StaffPanel, type RoleFilter } from "./staff-panel";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
  getDay,
  locales: { es },
});

const DnDCalendar = withDragAndDrop<ShiftEvent>(Calendar);

const MESSAGES: Messages<ShiftEvent> = {
  today: "Hoy",
  previous: "Anterior",
  next: "Siguiente",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Turno",
  allDay: "Todo el día",
  noEventsInRange: "No hay turnos en estas fechas.",
  showMore: (count) => `+${count} más`,
};

// Default hours of a shift created by dragging a person onto a whole day.
const DEFAULT_START = "08:00";
const DEFAULT_END = "16:00";
const DEFAULT_MINUTES = 8 * 60;
const DAY_MINUTES = 24 * 60;

function ShiftEventLabel({ event }: EventProps<ShiftEvent>) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate font-semibold">{event.person?.name ?? "Personal retirado"}</span>
      <span className="truncate text-[0.7rem] opacity-90">
        {event.shift.startTime}–{event.shift.endTime}
        {event.shift.note ? ` · ${event.shift.note}` : ""}
      </span>
    </span>
  );
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// The staff calendar: who works which day and from when to when. Drag on
// empty hours to add a shift, drag a shift to move it, drag its edge to
// resize it, and copy/paste a shift or a whole day onto other days.
export function ShiftCalendar({ staff }: { staff: StaffMember[] }) {
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<View>("month");
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<{ key: string; shifts: WorkShift[] } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focusedDate, setFocusedDate] = useState(() => toDateKey(new Date()));
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [dragged, setDragged] = useState<StaffMember | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [isPending, startTransition] = useTransition();

  const { from, to } = visibleRange(date, view);
  const loadKey = `${from}|${to}|${version}`;
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    listShifts({ from, to }).then((result) => {
      if (cancelled) return;
      if (result.ok) setData({ key: loadKey, shifts: result.data });
      else toast.error(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to, loadKey]);

  const shifts = useMemo(() => data?.shifts ?? [], [data]);
  const loading = data?.key !== loadKey;
  const byId = useMemo(() => new Map(staff.map((p) => [p.id, p])), [staff]);
  const colorFor = useCallback(
    (userId: number) => {
      const person = byId.get(userId);
      return person ? preferredColor(person, shifts) : "#ea580c";
    },
    [byId, shifts],
  );

  const events = useMemo(
    () =>
      shifts
        .filter((s) => !hidden.has(s.userId))
        .filter((s) => roleFilter === "all" || byId.get(s.userId)?.role === roleFilter)
        .map((s) => shiftToEvent(s, byId.get(s.userId) ?? null)),
    [shifts, hidden, roleFilter, byId],
  );
  const selected = shifts.find((s) => s.id === selectedId) ?? null;

  // ---- Copy / paste ----

  const copyShift = useCallback(
    (shift: WorkShift) => {
      const name = byId.get(shift.userId)?.name ?? "Turno";
      setClipboard({
        kind: "shift",
        label: `${name} ${shift.startTime}–${shift.endTime}`,
        items: [patternOf(shift)],
      });
      toast.info("Turno copiado: haz clic en otro día para pegarlo");
    },
    [byId],
  );

  const copyDay = useCallback(
    (dateKey: string) => {
      const day = events.filter((e) => e.shift.workDate === dateKey).map((e) => e.shift);
      if (day.length === 0) return toast.error("Ese día no tiene turnos para copiar");
      setClipboard({
        kind: "day",
        label: `${day.length} turno${day.length === 1 ? "" : "s"} del ${format(atLocal(dateKey, "00:00"), "EEEE d 'de' MMMM", { locale: es })}`,
        items: day.map(patternOf),
      });
      toast.info("Día copiado: haz clic en otro día para pegarlo");
    },
    [events],
  );

  const paste = useCallback(
    (targetDates: string[], overwrite = false) => {
      if (!clipboard || targetDates.length === 0) return;
      startTransition(async () => {
        const result = await pasteShifts({ items: clipboard.items, targetDates, overwrite });
        if (!result.ok) return void toast.error(result.error);
        toast.success(pasteSummary(result.data));
        setRangeOpen(false);
        reload();
      });
    },
    [clipboard, reload],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTyping(e.target) || draft || rangeOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "c" && selected) {
        e.preventDefault();
        copyShift(selected);
      } else if (mod && e.key.toLowerCase() === "v" && clipboard) {
        e.preventDefault();
        paste([focusedDate]);
      } else if (e.key === "Escape") {
        setClipboard(null);
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, clipboard, focusedDate, draft, rangeOpen, copyShift, paste]);

  // ---- Calendar interactions ----

  function handleSelectSlot(slot: SlotInfo) {
    const dateKey = toDateKey(slot.start);
    setFocusedDate(dateKey);
    setSelectedId(null);
    // Paste mode: every day clicked or swept gets the copy.
    if (clipboard) {
      const days =
        slot.action === "click" || view !== "month"
          ? [dateKey]
          : [...new Set(slot.slots.map(toDateKey))];
      return paste(days);
    }
    if (view === "month") {
      // A day of the month: default hours, adjusted in the dialog.
      return setDraft(newDraft(dateKey, DEFAULT_START, DEFAULT_END, "#ea580c"));
    }
    // Week/day: a single click on an hour only focuses that day; sweeping
    // over the hours opens the dialog with them.
    if (slot.action !== "select") return;
    setDraft(newDraft(dateKey, toHHMM(slot.start), toHHMM(slot.end), "#ea580c"));
  }

  function moveOrResize({ event, start, end, isAllDay }: EventInteractionArgs<ShiftEvent>, resize: boolean) {
    const s = new Date(start);
    const e = new Date(end);
    const keepHours = view === "month" || isAllDay;
    const next = {
      ...event.shift,
      workDate: toDateKey(s),
      startTime: keepHours ? event.shift.startTime : toHHMM(s),
      endTime: keepHours ? event.shift.endTime : toHHMM(e),
    };
    if (!keepHours) {
      const minutes = Math.round((e.getTime() - s.getTime()) / 60_000);
      if (minutes <= 0 || minutes >= DAY_MINUTES) {
        return toast.error("Un turno dura menos de 24 horas");
      }
    }
    if (resize && next.startTime === next.endTime) return;
    // Optimistic: the shift moves at once; reloaded (or reverted) after.
    setData((d) => d && { ...d, shifts: d.shifts.map((x) => (x.id === next.id ? next : x)) });
    startTransition(async () => {
      const result = await updateShift({ ...next, note: next.note ?? "" });
      if (!result.ok) toast.error(result.error);
      reload();
    });
  }

  function handleDropFromOutside({ start, allDay }: { start: string | Date; allDay: boolean }) {
    const person = dragged;
    setDragged(null);
    if (!person) return;
    const s = new Date(start);
    const wholeDay = allDay || view === "month";
    const startTime = wholeDay ? DEFAULT_START : toHHMM(s);
    const endTime = wholeDay ? DEFAULT_END : toHHMM(addMinutes(s, DEFAULT_MINUTES));
    const workDate = toDateKey(s);
    startTransition(async () => {
      const result = await createShift({
        userId: person.id,
        workDate,
        startTime,
        endTime,
        color: colorFor(person.id),
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Turno de ${person.name} agregado (${startTime}–${endTime})`);
      setFocusedDate(workDate);
      reload();
    });
  }

  const dragPreview = useCallback((): ShiftEvent => {
    const start = atLocal(toDateKey(new Date()), DEFAULT_START);
    return {
      id: -1,
      title: dragged?.name ?? "",
      start,
      end: addMinutes(start, DEFAULT_MINUTES),
      person: dragged,
      shift: {
        id: -1,
        uuid: "",
        userId: dragged?.id ?? 0,
        workDate: toDateKey(start),
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        toleranceMin: 0,
        earlyMin: 0,
        color: dragged ? colorFor(dragged.id) : "#ea580c",
        note: null,
      },
    };
  }, [dragged, colorFor]);

  const focusedLabel = format(atLocal(focusedDate, "00:00"), "EEE d MMM", { locale: es });

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <StaffPanel
        staff={staff}
        hidden={hidden}
        roleFilter={roleFilter}
        colorFor={colorFor}
        onToggle={(id) =>
          setHidden((h) => {
            const next = new Set(h);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onRoleFilter={setRoleFilter}
        onDragPerson={setDragged}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
          {clipboard ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-sm">
              <ClipboardPasteIcon className="size-4 shrink-0" />
              <span className="truncate">
                Copiado: <strong>{clipboard.label}</strong> · clic en un día para pegar
              </span>
              <button
                type="button"
                onClick={() => setClipboard(null)}
                aria-label="Dejar de pegar"
                className="rounded-full p-0.5 hover:bg-foreground/10"
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Arrastra sobre las horas para crear un turno · clic en un turno para seleccionarlo ·
              doble clic para editarlo
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!selected}
              onClick={() => selected && setDraft(draftFromShift(selected))}
            >
              <PencilIcon />
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selected}
              onClick={() => selected && copyShift(selected)}
              title="Ctrl+C"
            >
              <CopyIcon />
              Copiar turno
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyDay(focusedDate)}>
              <CopyIcon />
              Copiar día ({focusedLabel})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!clipboard || isPending}
              onClick={() => paste([focusedDate])}
              title="Ctrl+V"
            >
              <ClipboardPasteIcon />
              Pegar en {focusedLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!clipboard}
              onClick={() => setRangeOpen(true)}
            >
              <CalendarRangeIcon />
              Pegar en varios días…
            </Button>
            <ApplyTemplateDialog
              defaultFrom={focusedDate}
              defaultTo={toDateKey(addDays(atLocal(focusedDate, "00:00"), 27))}
              onApplied={reload}
            />
          </div>
        </div>

        <div
          className={cn(
            "shift-calendar relative h-[75vh] min-h-[600px] rounded-xl border bg-card p-2",
            clipboard && "shift-calendar--pasting",
            (loading || isPending) && "opacity-70",
          )}
        >
          <DnDCalendar
            localizer={localizer}
            culture="es"
            messages={MESSAGES}
            events={events}
            date={date}
            view={view}
            views={["month", "week", "day", "agenda"]}
            onNavigate={(next) => {
              setDate(next);
              setFocusedDate(toDateKey(next));
            }}
            onView={setView}
            selectable
            resizable={view !== "month"}
            popup
            showMultiDayTimes
            step={30}
            timeslots={2}
            scrollToTime={atLocal(toDateKey(new Date()), "06:00")}
            length={30}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={(event) => {
              setSelectedId(event.id);
              setFocusedDate(event.shift.workDate);
            }}
            onDoubleClickEvent={(event) => setDraft(draftFromShift(event.shift))}
            onEventDrop={(args) => moveOrResize(args, false)}
            onEventResize={(args) => moveOrResize(args, true)}
            onDropFromOutside={handleDropFromOutside}
            dragFromOutsideItem={dragged ? dragPreview : undefined}
            onDragOver={(e) => e.preventDefault()}
            selected={events.find((e) => e.id === selectedId)}
            eventPropGetter={(event, _start, _end, isSelected) => ({
              style: {
                backgroundColor: event.shift.color,
                color: textOn(event.shift.color),
                outline: isSelected ? "2px solid var(--foreground)" : undefined,
                outlineOffset: 1,
              },
            })}
            dayPropGetter={(day) => ({
              className: toDateKey(day) === focusedDate ? "shift-calendar__focused" : undefined,
            })}
            components={{ event: ShiftEventLabel }}
            tooltipAccessor={(event) =>
              `${event.person?.name ?? "Personal retirado"} · ${event.shift.startTime}–${event.shift.endTime} (${Math.round(shiftMinutes(event.shift.startTime, event.shift.endTime) / 6) / 10} h)`
            }
          />
        </div>
      </div>

      <ShiftDialog
        draft={draft}
        staff={staff}
        colorFor={colorFor}
        onClose={() => setDraft(null)}
        onSaved={reload}
      />
      <PasteRangeDialog
        open={rangeOpen}
        label={clipboard?.label ?? ""}
        defaultFrom={focusedDate}
        pending={isPending}
        onClose={() => setRangeOpen(false)}
        onPaste={(dates, overwrite) => paste(dates, overwrite)}
      />
    </div>
  );
}
