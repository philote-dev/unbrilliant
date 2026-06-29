import { describe, it, expect, vi } from "vitest"
import { firestoreHintCache } from "./firestoreHintCache"

function fakeDb(existing?: string) {
  const docRef = {
    get: vi.fn().mockResolvedValue({
      exists: existing !== undefined,
      get: (_f: string) => existing,
    }),
    set: vi.fn().mockResolvedValue(undefined),
  }
  const db = { collection: vi.fn(() => ({ doc: vi.fn(() => docRef) })) }
  return { db, docRef }
}

describe("firestoreHintCache", () => {
  it("returns the stored hint when the doc exists", async () => {
    const { db } = fakeDb("cached nudge")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = firestoreHintCache(db as any)
    expect(await cache.get("k")).toBe("cached nudge")
  })
  it("returns null when the doc is missing", async () => {
    const { db } = fakeDb(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = firestoreHintCache(db as any)
    expect(await cache.get("k")).toBeNull()
  })
  it("writes the hint on set when no allowlist is configured", async () => {
    const { db, docRef } = fakeDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = firestoreHintCache(db as any)
    await cache.set("k", "h")
    expect(docRef.set).toHaveBeenCalledWith(expect.objectContaining({ hint: "h" }))
  })
  it("writes an allowlisted key but silently ignores a non-allowlisted key", async () => {
    const { db, docRef } = fakeDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = firestoreHintCache(db as any, { allowlist: new Set(["ok"]) })
    await cache.set("nope", "h")
    expect(docRef.set).not.toHaveBeenCalled()
    await cache.set("ok", "h")
    expect(docRef.set).toHaveBeenCalledWith(expect.objectContaining({ hint: "h" }))
  })
})
