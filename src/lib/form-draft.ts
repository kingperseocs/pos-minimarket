// Unsaved form contents kept in the browser, so a form closed by accident
// (X, Esc, Cancelar, a reload) comes back as it was. A draft lives until the
// form is saved or "Limpiar" is pressed — or for a week at most.
//
// Every access is wrapped: private mode, a full or blocked storage just means
// "no draft", never a broken form.

const PREFIX = "pos-draft:v1:";
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type StoredDraft<T> = {
  values: T;
  // What the form started from (empty for "new", the saved record when
  // editing). If the record changed since, the draft is stale.
  baseline: string;
  savedAt: number;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Compares form contents: order-independent for plain objects, so { a, b }
// and { b, a } match, and blind to `key` — the random React list key of form
// rows (newLotLine(), newLine()…), which is not data. Without that, two
// identical empty rows would never compare equal.
export function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .filter(([k]) => k !== "key")
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}

export function readDraft<T>(
  key: string,
  baseline: unknown,
  { storage = browserStorage(), now = Date.now() } = {},
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft<T>;
    const stale =
      draft.baseline !== fingerprint(baseline) ||
      now - draft.savedAt > DRAFT_MAX_AGE_MS;
    if (stale) {
      storage.removeItem(PREFIX + key);
      return null;
    }
    return draft.values;
  } catch {
    return null;
  }
}

// Returns whether a draft is now stored. Values equal to the baseline (form
// opened and closed untouched) leave nothing behind.
export function writeDraft<T>(
  key: string,
  values: T,
  baseline: unknown,
  { storage = browserStorage(), now = Date.now() } = {},
): boolean {
  if (!storage) return false;
  try {
    const base = fingerprint(baseline);
    if (fingerprint(values) === base) {
      storage.removeItem(PREFIX + key);
      return false;
    }
    const draft: StoredDraft<T> = { values, baseline: base, savedAt: now };
    storage.setItem(PREFIX + key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string, { storage = browserStorage() } = {}) {
  try {
    storage?.removeItem(PREFIX + key);
  } catch {
    // Nothing to do: without storage there is no draft either.
  }
}
