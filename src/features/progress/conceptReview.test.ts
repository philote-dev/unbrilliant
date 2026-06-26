import { describe, expect, it } from "vitest"
import {
  applyReview,
  GAP_LADDER_MS,
  MAX_LEVEL,
  MIN_GAP_MS,
  newReview,
  strength,
  type ConceptReview,
} from "@/features/progress/conceptReview"

const DAY = 86_400_000

describe("conceptReview substrate", () => {
  it("newReview starts at level 0, due one gap out, nothing seen", () => {
    const r = newReview("stacks-and-queues:classify", 1_000)
    expect(r.level).toBe(0)
    expect(r.correctStreak).toBe(0)
    expect(r.seen).toBe(0)
    expect(r.dueAt).toBe(1_000 + GAP_LADDER_MS[0])
    expect(r.graduated).toBe(false)
  })

  it("a spaced correct rep promotes a level and lengthens the gap", () => {
    const r0 = newReview("c", 0)
    const at = GAP_LADDER_MS[0] + 5 // past the level-0 gap => spaced
    const r1 = applyReview(r0, { correct: true, at })
    expect(r1.level).toBe(1)
    expect(r1.correctStreak).toBe(1)
    expect(r1.seen).toBe(1)
    expect(r1.dueAt).toBe(at + GAP_LADDER_MS[1])
  })

  it("a massed correct rep holds the level (no ladder inflation)", () => {
    const r0 = newReview("c", 0)
    const r1 = applyReview(r0, { correct: true, at: 5 }) // within the gap
    expect(r1.level).toBe(0)
    expect(r1.correctStreak).toBe(0)
    expect(r1.seen).toBe(1)
    expect(r1.dueAt).toBe(5 + GAP_LADDER_MS[0])
  })

  it("a wrong rep demotes, resets the streak, and re-tests after MIN_GAP", () => {
    const r0 = applyReview(newReview("c", 0), { correct: true, at: GAP_LADDER_MS[0] + 1 })
    const at = r0.lastSeenAt + GAP_LADDER_MS[1] + 1
    const r1 = applyReview(r0, { correct: false, at })
    expect(r1.level).toBe(0)
    expect(r1.correctStreak).toBe(0)
    expect(r1.lapses).toBe(1)
    expect(r1.dueAt).toBe(at + MIN_GAP_MS)
  })

  it("graduates after MAX_LEVEL spaced correct reps and clamps the gap", () => {
    let r = newReview("c", 0)
    let at = 0
    for (let i = 0; i < MAX_LEVEL; i++) {
      at += GAP_LADDER_MS[Math.min(r.level, GAP_LADDER_MS.length - 1)] + 1
      r = applyReview(r, { correct: true, at })
    }
    expect(r.level).toBe(MAX_LEVEL)
    expect(r.graduated).toBe(true)
    const topGap = GAP_LADDER_MS[GAP_LADDER_MS.length - 1]
    expect(r.dueAt).toBe(at + topGap)
  })

  it("strength is 1 at lastSeenAt and 0.5 after one half-life (the level gap)", () => {
    const r: ConceptReview = { ...newReview("c", 0), level: 1, lastSeenAt: 0 }
    expect(strength(r, 0)).toBeCloseTo(1, 5)
    expect(strength(r, GAP_LADDER_MS[1])).toBeCloseTo(0.5, 5)
  })

  it("uses the day-scaled default ladder", () => {
    expect(GAP_LADDER_MS).toEqual([DAY, 3 * DAY, 7 * DAY, 21 * DAY])
  })
})
