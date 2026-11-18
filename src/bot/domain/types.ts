// Mensajes del bot, independientes de WhatsApp: el motor solo conoce estos tipos.

export type IncomingMessage = {
  /** id del mensaje en WhatsApp (sirve para deduplicar y marcar como leído). */
  id: string;
  /** Número del cliente en formato internacional sin "+", p. ej. "51987654321". */
  from: string;
  /** Nombre de perfil de WhatsApp, si Meta lo envía. */
  name?: string;
} & (
  | { kind: "text"; text: string }
  | { kind: "option"; optionId: string }
  | { kind: "other" }
);

export type MenuRow = { id: string; title: string; description?: string };

export type OutgoingMessage =
  | { kind: "text"; to: string; text: string }
  | {
      kind: "menu";
      to: string;
      header?: string;
      body: string;
      footer?: string;
      buttonLabel: string;
      sectionTitle: string;
      rows: MenuRow[];
    };
