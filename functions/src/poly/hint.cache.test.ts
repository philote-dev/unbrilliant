import { describe, it, expect, vi } from "vitest"
import { generateHint } from "./hint"
import { InMemoryHintCache, hintCacheKey } from "./hintCache"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

const boundaryArgs = {
  stageId: "arrays",
  skill: "grow",
  discipline: "array" as const,
  learnerOrder: ["grow the block by one slot"],
  boundary: true,
  configKey: "full-block",
  diagnosis: { kind: "grow-by-one", stepNumber: 0 },
}

describe("generateHint cache branching", () => {
  it("stores a boundary hint on a miss, then serves it without a model call", async () => {
    const cache = new InMemoryHintCache()
    const c1 = completer("What does the next add make you redo?")
    const r1 = await generateHint(c1, "m", boundaryArgs, cache)
    expect(r1.hint).toBe("What does the next add make you redo?")
    expect(await cache.get(hintCacheKey(boundaryArgs))).toBe(
      "What does the next add make you redo?",
    )

    const c2 = completer("SHOULD NOT BE CALLED")
    const r2 = await generateHint(c2, "m", boundaryArgs, cache)
    expect(r2.hint).toBe("What does the next add make you redo?")
    expect(c2.complete).not.toHaveBeenCalled()
  })

  it("does NOT touch the cache for an interior (non-boundary) mistake", async () => {
    const cache = new InMemoryHintCache()
    const getSpy = vi.spyOn(cache, "get")
    const setSpy = vi.spyOn(cache, "set")
    const c = completer("A live, uncached nudge.")
    const r = await generateHint(c, "m", { ...boundaryArgs, boundary: false }, cache)
    expect(r.hint).toBe("A live, uncached nudge.")
    expect(getSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
  })

  it("applies phrasing at serve time on both miss and hit", async () => {
    const cache = new InMemoryHintCache()
    await generateHint(completer("Look again."), "m", boundaryArgs, cache)
    const hit = await generateHint(
      completer("UNUSED"),
      "m",
      { ...boundaryArgs, attemptIndex: 1 },
      cache,
    )
    expect(hit.hint).toBe("One more look: Look again.")
  })

  it("stores the un-phrased base and phrases per attempt at serve time", async () => {
    const cache = new InMemoryHintCache()
    const miss = await generateHint(
      completer("Look again."),
      "m",
      { ...boundaryArgs, attemptIndex: 1 },
      cache,
    )
    expect(miss.hint).toBe("One more look: Look again.") // miss path phrases
    expect(await cache.get(hintCacheKey(boundaryArgs))).toBe("Look again.") // stored base is bare
    const hit = await generateHint(
      completer("UNUSED"),
      "m",
      { ...boundaryArgs, attemptIndex: 0 },
      cache,
    )
    expect(hit.hint).toBe("Look again.") // hit re-derives from the bare base
  })
})
