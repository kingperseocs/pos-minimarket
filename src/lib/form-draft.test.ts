import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearDraft, DRAFT_MAX_AGE_MS, readDraft, writeDraft } from "./form-draft";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const EMPTY = { name: "", ruc: "" };

describe("form drafts", () => {
  it("restores what was typed", () => {
    const storage = memoryStorage();
    assert.equal(writeDraft("supplier:new", { name: "Backus", ruc: "" }, EMPTY, { storage }), true);
    assert.deepEqual(readDraft("supplier:new", EMPTY, { storage }), { name: "Backus", ruc: "" });
  });

  it("matches the baseline regardless of key order", () => {
    const storage = memoryStorage();
    writeDraft("k", { name: "A", ruc: "" }, { name: "", ruc: "" }, { storage });
    assert.deepEqual(readDraft("k", { ruc: "", name: "" }, { storage }), { name: "A", ruc: "" });
  });

  it("ignores the random React key of form rows", () => {
    const storage = memoryStorage();
    const blank = { lines: [{ key: "a1", quantity: "" }] };
    assert.equal(
      writeDraft("k", { lines: [{ key: "b2", quantity: "" }] }, blank, { storage }),
      false,
    );
    writeDraft("k", { lines: [{ key: "b2", quantity: "3" }] }, blank, { storage });
    assert.deepEqual(
      readDraft("k", { lines: [{ key: "zz", quantity: "" }] }, { storage }),
      { lines: [{ key: "b2", quantity: "3" }] },
    );
  });

  it("stores nothing when the form is untouched", () => {
    const storage = memoryStorage();
    writeDraft("k", { name: "A", ruc: "" }, EMPTY, { storage });
    assert.equal(writeDraft("k", { ...EMPTY }, EMPTY, { storage }), false);
    assert.equal(storage.data.size, 0);
  });

  it("drops a draft whose record changed meanwhile", () => {
    const storage = memoryStorage();
    writeDraft("supplier:1", { name: "Mine" }, { name: "Old" }, { storage });
    assert.equal(readDraft("supplier:1", { name: "Changed by someone" }, { storage }), null);
    assert.equal(storage.data.size, 0);
  });

  it("forgets drafts older than a week", () => {
    const storage = memoryStorage();
    writeDraft("k", { name: "A" }, EMPTY, { storage, now: 0 });
    assert.equal(readDraft("k", EMPTY, { storage, now: DRAFT_MAX_AGE_MS + 1 }), null);
  });

  it("clears on demand", () => {
    const storage = memoryStorage();
    writeDraft("k", { name: "A" }, EMPTY, { storage });
    clearDraft("k", { storage });
    assert.equal(readDraft("k", EMPTY, { storage }), null);
  });

  it("never throws when storage is blocked", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    assert.equal(writeDraft("k", { name: "A" }, EMPTY, { storage: broken }), false);
    assert.equal(readDraft("k", EMPTY, { storage: broken }), null);
    clearDraft("k", { storage: broken });
  });

  it("works without storage (server render)", () => {
    assert.equal(readDraft("k", EMPTY, { storage: null }), null);
    assert.equal(writeDraft("k", { name: "A" }, EMPTY, { storage: null }), false);
  });
});
