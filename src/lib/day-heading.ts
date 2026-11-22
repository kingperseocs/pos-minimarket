// "DOMINGO » 22º NOVIEMBRE": the day a screen shows, as a heading. Takes a
// store day key (YYYY-MM-DD), so it never shifts with the device's zone.
export function formatDayHeading(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-PE", { ...options, timeZone: "UTC" }).format(date).toUpperCase();
  return `${part({ weekday: "long" })} » ${date.getUTCDate()}º ${part({ month: "long" })}`;
}
