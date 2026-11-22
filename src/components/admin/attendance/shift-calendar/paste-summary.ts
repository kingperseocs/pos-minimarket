// "5 turnos creados, 2 omitidos (ya tenían turno)".
export function pasteSummary(result: { created: number; replaced: number; skipped: number }) {
  const parts = [`${result.created} turno${result.created === 1 ? "" : "s"} creado${result.created === 1 ? "" : "s"}`];
  if (result.replaced > 0) parts.push(`${result.replaced} reemplazado${result.replaced === 1 ? "" : "s"}`);
  if (result.skipped > 0) {
    parts.push(`${result.skipped} omitido${result.skipped === 1 ? "" : "s"} (ya tenían turno)`);
  }
  return parts.join(", ");
}
