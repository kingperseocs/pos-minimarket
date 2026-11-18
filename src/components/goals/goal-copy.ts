import type { GoalMood } from "@/domain/entities/sales-goal";

export const GOAL_MOOD_MESSAGES: Record<GoalMood, string> = {
  sleeping: "¡Despierta al perrito! Cada venta lo acerca a la meta.",
  walking: "¡Buen comienzo! El perrito ya va caminando hacia la meta.",
  running: "¡Más de la mitad! El perrito ya corre hacia la meta.",
  excited: "¡Ya casi! El perrito ya ve la cinta de meta.",
  celebrating: "¡Meta cumplida! El perrito rompió la cinta.",
};

export const GOAL_MOOD_LABELS: Record<GoalMood, string> = {
  sleeping: "Perrito dormido",
  walking: "Perrito caminando",
  running: "Perrito corriendo",
  excited: "Perrito emocionado",
  celebrating: "Perrito celebrando",
};

const monthFormat = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  timeZone: "UTC",
});

// "2026-11" → "noviembre".
export function goalMonthName(month: string) {
  return monthFormat.format(new Date(`${month}-15T12:00:00Z`));
}

export function formatPercent(percent: number) {
  return `${Math.floor(percent)}%`;
}
