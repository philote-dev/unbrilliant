import { describe, it, expect, vi } from "vitest"
import { precomputeBoundaryHints } from "./precompute"
import { InMemoryHintCache, hintCacheKey } from "./hintCache"
import type { Completer } from "../openai"
import type { HintArgs } from "./hint"

const shape: HintArgs = {
  stageId: "arrays",
  skill: "grow",
  discipline: "array",
  learnerOrder: ["grow the block by one slot"],
  boundary: true,
  configKey: "full-block",
  diagnosis: { kind: "grow-by-one", stepNumber: 0 },
}

function completer(reply: string): Completer {
  return { complete: vi.fn().mockResolvedValue(reply) }
}

describe("precomputeBoundaryHints", () => {
  it("generates and stores each boundary shape", async () => {
    const cache = new InMemoryHintCache()
    const res = await precomputeBoundaryHints({
      completer: completer("What does the next add make you redo?"),
      model: "m",
      cache,
      shapes: [shape],
    })
    expect(res).toEqual({ attempted: 1, cached: 1 })
    expect(await cache.get(hintCacheKey(shape))).toBe("What does the next add make you redo?")
  })

  it("does not count a shape whose hint never verifies", async () => {
    const cache = new InMemoryHintCache()
    // "double" is a withheld P3 token for grow -> both attempts rejected -> null.
    const res = await precomputeBoundaryHints({
      completer: { complete: vi.fn().mockResolvedValue("Just double it.") },
      model: "m",
      cache,
      shapes: [shape],
    })
    expect(res).toEqual({ attempted: 1, cached: 0 })
  })
})
