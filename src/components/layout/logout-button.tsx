"use client";

import { LockIcon, LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useSyncExternalStore } from "react";
import {
  getShiftUi,
  getShiftUiOnServer,
  requestShiftView,
  subscribeShiftUi,
} from "@/components/pos/shift-ui-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const timeFormat = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });

export function LogoutButton({ className }: { className?: string }) {
  // At the till, the cash has to be closed (and handed over) before leaving.
  const { hasOpenShift, openedAt } = useSyncExternalStore(
    subscribeShiftUi,
    getShiftUi,
    getShiftUiOnServer,
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Cerrar sesión"
            className={cn(
              "h-8 gap-1.5 border-destructive px-3 text-destructive hover:bg-destructive hover:text-white",
              className,
            )}
          />
        }
      >
        <LogOutIcon className="size-4" aria-hidden />
        {/* Hidden when the admin sidebar collapses to icons. */}
        <span className="group-data-[collapsible=icon]:hidden">Salir</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {hasOpenShift ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Primero cierra tu caja</AlertDialogTitle>
              <AlertDialogDescription>
                Tienes la caja abierta
                {openedAt ? ` desde las ${timeFormat.format(new Date(openedAt))}` : ""}.
                Ciérrala para entregar el dinero y luego podrás salir.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => requestShiftView("close")}>
                <LockIcon data-icon="inline-start" />
                Cerrar caja ahora
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Seguro que quieres cerrar sesión?</AlertDialogTitle>
              <AlertDialogDescription>
                Tendrás que volver a ingresar tu usuario y contraseña.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Cerrar sesión
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
