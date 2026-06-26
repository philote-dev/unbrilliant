import { describe, expect, it } from "vitest"

import { newReview, type ConceptReview } from "@/features/progress/conceptReview"
import { seedFromUid, selectDueDrill } from "@/features/retrieval/selectDrill"

const DONE = new Set(["stacks-and-queues"])
const row = (id: string, dueAt: number): ConceptReview => ({
  ...newReview(id, 0),
  dueAt,
})

describe("selectDueDrill", () => {
  it("returns null when nothing is due", () => {
    expect(
      selectDueDrill([row("stacks-and-queues:classify", 10_000)], {
        completedLessonIds: DONE,
        now: 5_000,
        userSeed: 1,
      }),
    ).toBeNull()
  })

  it("returns null when the concept's lesson is not completed", () => {
    expect(
      selectDueDrill([row("stacks-and-queues:classify", 0)], {
        completedLessonIds: new Set(),
        now: 5_000,
        userSeed: 1,
      }),
    ).toBeNull()
  })

  it("picks the most-overdue due concept and builds one item by default", () => {
    const reviews = [
      row("stacks-and-queues:classify", 4_000),
      row("stacks-and-queues:stackPredict", 1_000),
    ]
    const drill = selectDueDrill(reviews, {
      completedLessonIds: DONE,
      now: 5_000,
      userSeed: 1,
    })
    expect(drill?.conceptId).toBe("stacks-and-queues:stackPredict")
    expect(drill?.items).toHaveLength(1)
  })

  it("honors itemCount up to 3", () => {
    const drill = selectDueDrill([row("stacks-and-queues:classify", 0)], {
      completedLessonIds: DONE,
      now: 5_000,
      userSeed: 1,
      itemCount: 3,
    })
    expect(drill?.items).toHaveLength(3)
  })

  it("seedFromUid is stable", () => {
    expect(seedFromUid("abc")).toBe(seedFromUid("abc"))
  })
})
