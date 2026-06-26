import { describe, expect, it } from "vitest"

import { overallRetention } from "./overallRetention"
import { conceptId } from "@/features/progress/concepts"
import { newReview, type ConceptReview } from "@/features/progress/conceptReview"

const DAY = 86_400_000
const NOW = new Date(2026, 0, 14).getTime()

/**
 * A fresh review at level 0 has half-life = 1 day, so strength() is exactly
 * 2^(-ageDays). `aged(id, days)` yields a known strength: 0 days -> 1,
 * 1 day -> 0.5, 2 days -> 0.25.
 */
function aged(id: string, days: number): [string, ConceptReview] {
  return [id, newReview(id, NOW - days * DAY)]
}

describe("overallRetention", () => {
  it("returns 1 when no lessons are completed (even if reviews exist)", () => {
    const reviews = new Map([aged(conceptId("graphs", "read"), 5)])
    expect(overallRetention([], reviews, NOW)).toBe(1)
  })

  it("returns 1 for completed lessons that have no reviews (fresh)", () => {
    expect(overallRetention(["graphs"], new Map(), NOW)).toBe(1)
  })

  it("returns the minimum strength across a lesson's retrievable concepts", () => {
    const reviews = new Map([
      aged(conceptId("graphs", "read"), 0), // 1
      aged(conceptId("graphs", "draw"), 1), // 0.5
      aged(conceptId("graphs", "same"), 2), // 0.25 (weakest link)
    ])
    expect(overallRetention(["graphs"], reviews, NOW)).toBeCloseTo(0.25, 5)
  })

  it("takes the weakest link across multiple completed lessons", () => {
    const reviews = new Map([
      aged(conceptId("graphs", "read"), 1), // 0.5
      aged(conceptId("trees", "locate"), 3), // 0.125 (weakest link)
    ])
    expect(overallRetention(["graphs", "trees"], reviews, NOW)).toBeCloseTo(
      0.125,
      5,
    )
  })

  it("ignores non-retrievable concepts even when they are weaker", () => {
    const reviews = new Map([
      aged(conceptId("stacks-and-queues", "stackPredict"), 1), // retrievable, 0.5
      aged(conceptId("stacks-and-queues", "stackRealworld"), 4), // scaffolding, ~0.0625
    ])
    expect(overallRetention(["stacks-and-queues"], reviews, NOW)).toBeCloseTo(
      0.5,
      5,
    )
  })
})
