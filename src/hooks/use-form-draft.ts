"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { clearDraft, fingerprint, readDraft, writeDraft } from "@/lib/form-draft";

export type DraftStatus = "none" | "saved" | "restored";

// Keeps a form's values in a browser draft while `enabled` (dialog open, page
// mounted). The form decides when to load it:
// - dialogs: `restore()` when opening, before showing the fields;
// - pages: `restore()` in a mount effect (localStorage does not exist on the
//   server, so reading it during render would break hydration).
// Nothing is written until restore() ran, so the empty initial render can't
// overwrite the stored draft. Call clear() after a successful save.
export function useFormDraft<T>({
  key,
  values,
  baseline,
  enabled,
  onRestore,
}: {
  key: string;
  values: T;
  // What "untouched" looks like: empty for a new record, the saved one when
  // editing. Equal values store nothing.
  baseline: T;
  enabled: boolean;
  // Page forms: restore automatically after mounting, handing the draft here.
  // Dialogs leave it out and call restore() when opening.
  onRestore?: (draft: T) => void;
}) {
  const [status, setStatus] = useState<DraftStatus>("none");
  const loadedKey = useRef<string | null>(null);

  const valuesPrint = fingerprint(values);
  const baselinePrint = fingerprint(baseline);
  const latest = useRef({ values, baseline });
  // Before the effects below: they and restore() read the current values.
  useLayoutEffect(() => {
    latest.current = { values, baseline };
  });

  useEffect(() => {
    if (!enabled || loadedKey.current !== key) return;
    const stored = writeDraft(key, latest.current.values, latest.current.baseline);
    setStatus((prev) => (stored ? (prev === "restored" ? prev : "saved") : "none"));
  }, [key, valuesPrint, baselinePrint, enabled]);

  const restore = useCallback((): T | null => {
    loadedKey.current = key;
    const draft = readDraft<T>(key, latest.current.baseline);
    setStatus(draft ? "restored" : "none");
    return draft;
  }, [key]);

  const clear = useCallback(() => {
    clearDraft(key);
    setStatus("none");
  }, [key]);

  // Pages: load the draft once mounted (never during render: the server has
  // no localStorage, and reading it there would break hydration).
  const restoreOnMount = useRef(onRestore);
  useLayoutEffect(() => {
    restoreOnMount.current = onRestore;
  });
  const autoRestore = Boolean(onRestore);
  useEffect(() => {
    if (!autoRestore) return;
    const draft = restore();
    if (draft) restoreOnMount.current?.(draft);
  }, [autoRestore, restore]);

  return { status, restore, clear };
}
