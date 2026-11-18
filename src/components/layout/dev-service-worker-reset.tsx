"use client";

import { useEffect } from "react";

/**
 * Solo en desarrollo: Serwist no registra el service worker en dev, pero uno
 * registrado antes (p. ej. tras `pnpm start`) sigue activo y sirve HTML/CSS/JS
 * viejos desde su caché, lo que provoca errores fantasma de chunks antiguos.
 * Lo desregistramos y limpiamos sus cachés; si había uno controlando la
 * página, recargamos una vez para que todo venga del dev server.
 */
export function DevServiceWorkerReset() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;

      await Promise.all(registrations.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if (navigator.serviceWorker.controller) window.location.reload();
    })();
  }, []);

  return null;
}
