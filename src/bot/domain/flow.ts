// Definición del flujo del bot como datos. Para crecer (p. ej. "Necesito ayuda" →
// "Producto atascado" / "Moneda atascada"), se agregan opciones y respuestas aquí.

import type { MenuRow } from "./types";

// Límites de WhatsApp para mensajes de lista.
export const LIST_LIMITS = {
  rows: 10,
  rowTitle: 24,
  rowDescription: 72,
  buttonLabel: 20,
} as const;

export const MAIN_MENU = {
  greeting: (name?: string) =>
    `¡Hola${name ? ` ${name}` : ""}! 👋 Soy el asistente virtual de *Naveguz*.\n¿En qué te puedo ayudar?`,
  footer: "Máquinas expendedoras · Huánuco",
  buttonLabel: "Ver opciones",
  sectionTitle: "Elige una opción",
} as const;

export type MainOption = MenuRow & { reply: string };

export const MAIN_OPTIONS: MainOption[] = [
  {
    id: "ayuda",
    title: "Necesito ayuda",
    description: "Tengo un problema con una máquina",
    reply:
      "Gracias por escribirnos. Pronto te enviaremos los pasos para solucionar el problema con la máquina. 🛠️",
  },
  {
    id: "pedidos",
    title: "Deseo realizar pedidos",
    reply: "¡Genial! En breve un asesor te atenderá para tomar tu pedido. 📦",
  },
  {
    id: "adquirir",
    title: "Deseo adquirir máquinas",
    reply: "¡Excelente! Un asesor te contactará con la información de nuestras máquinas. 🏪",
  },
  {
    id: "asesoria",
    title: "Quiero una asesoría",
    reply: "Con gusto. Un asesor se comunicará contigo pronto. 🤝",
  },
];
