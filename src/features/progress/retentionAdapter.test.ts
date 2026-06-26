import { describe, it, expect } from "vitest"

import { newReview, type ConceptReview } from "@/features/progress/conceptReview"
import { conceptsForLesson } from "@/features/progress/concepts"
import { lessonRetentionFor } from "./retentionAdapter"

const DAY = 86_400_000

/** A review whose strength is a known value at `now` (level 0 => half-life 1 day). */
function staleReview(id: string, now: number, daysStale: number): ConceptReview {
  return { ...newReview(id, 0), lastSeenAt: now - daysStale * DAY }
}

describe("lessonRetentionFor (over the real substrate)", () => {
  it("returns the weakest load-bearing concept's strength", () => {
    const now = 60 * DAY
    const load = conceptsForLesson("stacks-and-queues").filter((c) => c.retrievable)
    expect(load.length).toBeGreaterThan(1)
    // first load-bearing concept 2 days stale at level 0 => 2^-2 = 0.25; the rest
    // have no review => treated as fresh (1). min => 0.25.
    const rusty = staleReview(load[0].id, now, 2)
    const reviews = new Map<string, ConceptReview>([[rusty.conceptId, rusty]])
    expect(lessonRetentionFor("stacks-and-queues", reviews, now)).toBeCloseTo(0.25, 5)
  })

  it("ignores a non-load-bearing concept even if its review has rotted", () => {
    const now = 60 * DAY
    const nonRet = conceptsForLesson("stacks-and-queues").find((c) => !c.retrievable)
    expect(nonRet).toBeTruthy()
    const rotten = staleReview(nonRet!.id, now, 10)
    const reviews = new Map<string, ConceptReview>([[rotten.conceptId, rotten]])
    // every load-bearing concept is review-less => fresh => retention 1
    expect(lessonRetentionFor("stacks-and-queues", reviews, now)).toBeCloseTo(1, 5)
  })

  it("returns null for a lesson with no concepts", () => {
    expect(lessonRetentionFor("nope", new Map(), 0)).toBeNull()
  })
})
