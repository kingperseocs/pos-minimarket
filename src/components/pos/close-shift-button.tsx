"use client";

import { LockIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  getShiftUi,
  getShiftUiOnServer,
  requestShiftView,
  subscribeShiftUi,
} from "./shift-ui-store";

// "Cerrar caja" in the cashier header, next to "Salir": only while a shift
// is open. Opens the closing count of the cash panel.
export function CloseShiftButton() {
  const { hasOpenShift } = useSyncExternalStore(subscribeShiftUi, getShiftUi, getShiftUiOnServer);
  if (!hasOpenShift) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => requestShiftView("close")}
      className="h-8 gap-1.5 border-amber-500 px-3 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-500/10"
    >
      <LockIcon className="size-4" aria-hidden />
      Cerrar caja
    </Button>
  );
}
