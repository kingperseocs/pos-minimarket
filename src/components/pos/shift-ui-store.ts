// Links the till (POS screen) with the cashier header, which lives in a
// server layout: whether a shift is open (to show "Cerrar caja" next to
// "Salir") and which form of the cash panel to open. Browser-only state.

export type ShiftView = "in" | "out" | "close";

type State = {
  hasOpenShift: boolean;
  // When the open shift started (ISO), for "Primero cierra tu caja".
  openedAt: string | null;
  request: { view: ShiftView; at: number } | null;
};

let state: State = { hasOpenShift: false, openedAt: null, request: null };
const listeners = new Set<() => void>();

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeShiftUi(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getShiftUi(): State {
  return state;
}

const SERVER_STATE: State = { hasOpenShift: false, openedAt: null, request: null };
export function getShiftUiOnServer(): State {
  return SERVER_STATE;
}

export function setHasOpenShift(open: boolean, openedAt: string | null = null) {
  if (state.hasOpenShift !== open || state.openedAt !== openedAt) {
    emit({ hasOpenShift: open, openedAt: open ? openedAt : null });
  }
}

// Asks the cash panel to open on a form (each request is new, even if the
// same form is asked twice).
export function requestShiftView(view: ShiftView) {
  emit({ request: { view, at: Date.now() } });
}
