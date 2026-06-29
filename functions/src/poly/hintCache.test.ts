import { describe, it, expect } from "vitest"
import { hintCacheKey, InMemoryHintCache } from "./hintCache"
import type { HintArgs } from "./hint"

const args: HintArgs = {
  stageId: "linked-lists",
  skill: "llInsert",
  discipline: "linked-list",
  learnerOrder: [],
  diagnosis: { kind: "orphaned-tail", stepNumber: 1 },
  boundary: true,
  configKey: "head-insert",
  mode: "hint",
}

describe("hintCacheKey", () => {
  it("is deterministic and safe as a doc id", () => {
    const k = hintCacheKey(args)
    expect(k).toBe("linked-list_llInsert_hint_orphaned-tail_1_head-insert")
    expect(k).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("ignores phrasing-only fields (attemptIndex)", () => {
    expect(hintCacheKey({ ...args, attemptIndex: 5 })).toBe(hintCacheKey(args))
  })

  it("defaults mode to hint and missing diagnosis to none/0", () => {
    const k = hintCacheKey({ ...args, mode: undefined, diagnosis: undefined })
    expect(k).toBe("linked-list_llInsert_hint_none_0_head-insert")
  })
})

describe("InMemoryHintCache", () => {
  it("stores and returns by key, missing returns null", async () => {
    const c = new InMemoryHintCache()
    expect(await c.get("k")).toBeNull()
    await c.set("k", "a nudge")
    expect(await c.get("k")).toBe("a nudge")
  })
})
