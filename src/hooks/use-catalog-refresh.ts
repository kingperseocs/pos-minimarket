"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// A till stays open for hours: without this, products, categories or
// discounts the admin changes only show up after a manual reload. Refetches
// the page's server data when the cashier comes back to the tab or the
// internet returns. router.refresh() keeps client state (the basket, the
// open shift), and is skipped offline so the cached page keeps working.
export function useCatalogRefresh(catalogAt: string, minAgeMs = 60_000) {
  const router = useRouter();
  // Latest catalog time without re-subscribing the listeners on every refresh.
  const catalogAtRef = useRef(catalogAt);
  useEffect(() => {
    catalogAtRef.current = catalogAt;
  }, [catalogAt]);

  useEffect(() => {
    let lastRequest = 0;

    function refreshIfStale() {
      if (!navigator.onLine) return;
      const now = Date.now();
      const age = now - new Date(catalogAtRef.current).getTime();
      if (age < minAgeMs || now - lastRequest < minAgeMs) return;
      lastRequest = now;
      router.refresh();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") refreshIfStale();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [router, minAgeMs]);
}
