import { describe, it, expect } from "vitest"

import { markSplashShown, shouldShowSplash } from "./splash"

/** Minimal in-memory stand-in for the `getItem` / `setItem` slice we use. */
function fakeStorage(): Pick<Storage, "getItem" | "setItem"> {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v)
    },
  }
}

describe("splash session gate", () => {
  it("shows on a fresh session", () => {
    expect(shouldShowSplash(fakeStorage())).toBe(true)
  })

  it("does not show after it is marked shown", () => {
    const s = fakeStorage()
    markSplashShown(s)
    expect(shouldShowSplash(s)).toBe(false)
  })

  it("reading is idempotent (does not mark it shown)", () => {
    const s = fakeStorage()
    expect(shouldShowSplash(s)).toBe(true)
    expect(shouldShowSplash(s)).toBe(true)
  })

  it("independent storages do not leak", () => {
    const a = fakeStorage()
    const b = fakeStorage()
    markSplashShown(a)
    expect(shouldShowSplash(a)).toBe(false)
    expect(shouldShowSplash(b)).toBe(true)
  })
})
