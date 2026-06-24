import { describe, it, expect } from "vitest"

import {
  cycleTarget,
  isWithin,
  resolveDropTarget,
  resolveIntent,
  type TargetRect,
} from "./core"

/**
 * Behavior tests for the rewire surface's pure geometry/keyboard/intent core.
 * No DOM, no React — same inputs always yield the same intent (the deterministic
 * guarantee the PRD relies on). DOM glue (pointer capture, focus) is proven by
 * the component test + the consuming lesson's Playwright tracer, not here.
 */

const rect = (
  id: string,
  left: number,
  top: number,
  right: number,
  bottom: number,
): TargetRect => ({ id, left, top, right, bottom })

describe("isWithin", () => {
  const r = rect("t", 100, 100, 200, 160)

  it("is true for a point inside the rect", () => {
    expect(isWithin({ x: 150, y: 130 }, r)).toBe(true)
  })

  it("is true on the edge", () => {
    expect(isWithin({ x: 100, y: 100 }, r)).toBe(true)
    expect(isWithin({ x: 200, y: 160 }, r)).toBe(true)
  })

  it("is false clearly outside with no tolerance", () => {
    expect(isWithin({ x: 90, y: 130 }, r)).toBe(false)
    expect(isWithin({ x: 150, y: 175 }, r)).toBe(false)
  })

  it("accepts a near-miss once a forgiving tolerance is applied", () => {
    expect(isWithin({ x: 88, y: 130 }, r)).toBe(false)
    expect(isWithin({ x: 88, y: 130 }, r, 16)).toBe(true)
  })
})

describe("resolveDropTarget", () => {
  const targets = [
    rect("a", 0, 0, 100, 100),
    rect("b", 200, 0, 300, 100),
  ]

  it("returns the id of the hit target", () => {
    expect(resolveDropTarget({ x: 250, y: 50 }, targets)).toBe("b")
  })

  it("returns null when the point hits nothing", () => {
    expect(resolveDropTarget({ x: 150, y: 50 }, targets)).toBeNull()
  })

  it("respects tolerance for a forgiving near-miss", () => {
    expect(resolveDropTarget({ x: 108, y: 50 }, targets)).toBeNull()
    expect(resolveDropTarget({ x: 108, y: 50 }, targets, 16)).toBe("a")
  })

  it("picks the nearest center deterministically when rects overlap", () => {
    const overlapping = [
      rect("big", 0, 0, 200, 200),
      rect("small", 90, 90, 130, 130),
    ]
    // (110,110) is the center of "small" and inside "big" too → nearest wins.
    expect(resolveDropTarget({ x: 110, y: 110 }, overlapping)).toBe("small")
  })

  it("returns null for an empty target set", () => {
    expect(resolveDropTarget({ x: 0, y: 0 }, [])).toBeNull()
  })
})

describe("resolveIntent", () => {
  it("produces a from→to intent when a target was hit", () => {
    expect(resolveIntent("p1", "n3")).toEqual({ from: "p1", to: "n3" })
  })

  it("produces nothing (snap-back) when no target was hit", () => {
    expect(resolveIntent("p1", null)).toBeNull()
  })
})

describe("cycleTarget", () => {
  const ids = ["a", "b", "c"]

  it("starts at the first target when nothing is selected and moving forward", () => {
    expect(cycleTarget(null, ids, 1)).toBe("a")
  })

  it("starts at the last target when nothing is selected and moving backward", () => {
    expect(cycleTarget(null, ids, -1)).toBe("c")
  })

  it("advances forward and wraps around the end", () => {
    expect(cycleTarget("a", ids, 1)).toBe("b")
    expect(cycleTarget("c", ids, 1)).toBe("a")
  })

  it("advances backward and wraps around the start", () => {
    expect(cycleTarget("b", ids, -1)).toBe("a")
    expect(cycleTarget("a", ids, -1)).toBe("c")
  })

  it("treats an unknown current id as a fresh start", () => {
    expect(cycleTarget("zzz", ids, 1)).toBe("a")
  })

  it("returns null when there are no targets", () => {
    expect(cycleTarget(null, [], 1)).toBeNull()
    expect(cycleTarget("a", [], -1)).toBeNull()
  })

  it("stays on the only target in a singleton list", () => {
    expect(cycleTarget("only", ["only"], 1)).toBe("only")
    expect(cycleTarget("only", ["only"], -1)).toBe("only")
  })
})
