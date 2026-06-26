import { describe, expect, it } from "vitest"

import { conceptsForLesson } from "@/features/progress/concepts"
import { newReview, type ConceptReview } from "@/features/progress/conceptReview"
import { checkpointDue } from "@/features/retrieval/checkpoint"
import type { ProgressByLesson } from "@/lessons/catalog"

const completed = (...ids: string[]): ProgressByLesson =>
  Object.fromEntries(
    ids.map((id) => [id, { counters: {}, currentPart: "", completed: true }]),
  )

const strongRows = (lessonId: string, now: number): ConceptReview[] =>
  conceptsForLesson(lessonId).map((c) => ({ ...newReview(c.id, now), level: 3 }))

describe("checkpointDue", () => {
  it("is null until all prerequisite lessons are completed", () => {
    expect(
      checkpointDue("data-structures", completed("stacks-and-queues"), [], 0),
    ).toBeNull()
  })

  it("returns the checkpoint id once prerequisites are done and concepts are strong", () => {
    const now = 1_000_000
    const progress = completed("stacks-and-queues", "arrays", "linked-lists")
    const reviews = [
      ...strongRows("stacks-and-queues", now),
      ...strongRows("arrays", now),
      ...strongRows("linked-lists", now),
    ]
    expect(checkpointDue("data-structures", progress, reviews, now)).toBe(
      "ds-linear-check",
    )
  })

  it("stays null for an already-passed checkpoint", () => {
    const now = 1_000_000
    const progress = completed("stacks-and-queues", "arrays", "linked-lists")
    const reviews = [
      ...strongRows("stacks-and-queues", now),
      ...strongRows("arrays", now),
      ...strongRows("linked-lists", now),
    ]
    expect(
      checkpointDue(
        "data-structures",
        progress,
        reviews,
        now,
        new Set(["ds-linear-check"]),
      ),
    ).toBeNull()
  })
})
