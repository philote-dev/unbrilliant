import { describe, expect, it } from "vitest"
import { emptySave, isComplete, type TrialSaveState } from "./saveState"

describe("trial save-state", () => {
  it("emptySave starts at the first segment, not complete", () => {
    const s = emptySave("trial-1-linear", "mission-a", "a1")
    expect(s.completed).toBe(false)
    expect(s.segmentId).toBe("a1")
    expect(s.unlockedSegments).toEqual(["a1"])
  })
  it("isComplete reflects the completed flag", () => {
    const s: TrialSaveState = { ...emptySave("t", "m", "s"), completed: true }
    expect(isComplete(s)).toBe(true)
  })
})
