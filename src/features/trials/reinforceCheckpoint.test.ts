import { describe, expect, it } from "vitest"
import { reinforceCheckpoint } from "./reinforceCheckpoint"
import { MAX_LEVEL, type ConceptReview } from "@/features/progress/conceptReview"

const base = (over: Partial<ConceptReview> = {}): ConceptReview => ({
  conceptId: "arrays:deleteCount",
  level: 1,
  correctStreak: 1,
  lapses: 0,
  seen: 3,
  lastSeenAt: 1000,
  dueAt: 5000,
  graduated: false,
  ...over,
})

describe("reinforceCheckpoint", () => {
  it("clean pass promotes one rung and refreshes due date", () => {
    const r = reinforceCheckpoint(base({ level: 1 }), { at: 10_000, cleanPass: true })
    expect(r.level).toBe(2)
    expect(r.seen).toBe(4)
    expect(r.lastSeenAt).toBe(10_000)
    expect(r.dueAt).toBeGreaterThan(10_000)
  })
  it("clean pass never exceeds MAX_LEVEL and sets graduated", () => {
    const r = reinforceCheckpoint(base({ level: MAX_LEVEL }), { at: 10_000, cleanPass: true })
    expect(r.level).toBe(MAX_LEVEL)
    expect(r.graduated).toBe(true)
  })
  it("revised pass refreshes recency but does not promote", () => {
    const r = reinforceCheckpoint(base({ level: 1 }), { at: 10_000, cleanPass: false })
    expect(r.level).toBe(1)
    expect(r.lastSeenAt).toBe(10_000)
    expect(r.dueAt).toBeGreaterThan(10_000)
  })
})
