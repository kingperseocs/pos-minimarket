"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps a server-rendered list current without a "refresh" button: reloads
// its data every few seconds while the tab is visible (and right away when
// the cashier comes back to it). Documents change on their own as the motor
// issues them, so the screen must follow.
export function LiveRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
  return null;
}
