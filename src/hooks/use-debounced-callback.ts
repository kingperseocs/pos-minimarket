"use client";

import { useCallback, useEffect, useRef } from "react";

// Calls `callback` only once the calls stop for `delay` ms (typing in a
// search box: one search per pause, not per key). Pending calls are dropped
// on unmount.
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay = 300,
) {
  const latest = useRef(callback);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = callback;
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
