// Motor del bot: función pura que decide qué responder a cada mensaje entrante.

import { MAIN_MENU, MAIN_OPTIONS } from "./flow";
import type { IncomingMessage, OutgoingMessage } from "./types";

function mainMenu(message: IncomingMessage): OutgoingMessage {
  return {
    kind: "menu",
    to: message.from,
    body: MAIN_MENU.greeting(message.name),
    footer: MAIN_MENU.footer,
    buttonLabel: MAIN_MENU.buttonLabel,
    sectionTitle: MAIN_MENU.sectionTitle,
    rows: MAIN_OPTIONS.map(({ id, title, description }) => ({ id, title, description })),
  };
}

export function decide(message: IncomingMessage): OutgoingMessage[] {
  if (message.kind === "option") {
    const option = MAIN_OPTIONS.find((o) => o.id === message.optionId);
    // Opción desconocida (p. ej. de un menú antiguo): se vuelve a mostrar el menú.
    if (!option) return [mainMenu(message)];
    return [{ kind: "text", to: message.from, text: option.reply }];
  }

  // Cualquier otro mensaje (texto, imagen, audio...) abre el menú principal.
  return [mainMenu(message)];
}
