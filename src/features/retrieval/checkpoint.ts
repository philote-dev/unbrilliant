import { conceptsForLesson } from "@/features/progress/concepts"
import { strength, type ConceptReview } from "@/features/progress/conceptReview"
import type { ProgressByLesson } from "@/lessons/catalog"

/**
 * The retrieval system's only part of Type 2: deciding WHEN a course checkpoint is
 * due. The checkpoint experience, scenario pool, and grading belong to the
 * mastery-question effort. Catalog-driven config so it scales to future courses.
 */
export type CheckpointId = string

interface Checkpoint {
  id: CheckpointId
  courseId: string
  afterLessons: string[]
  minStrength: number // average concept strength across afterLessons to be "ready"
}

export const CHECKPOINTS: Checkpoint[] = [
  {
    id: "ds-linear-check",
    courseId: "data-structures",
    afterLessons: ["stacks-and-queues", "arrays", "linked-lists"],
    minStrength: 0.4,
  },
]

export function checkpointDue(
  courseId: string,
  progress: ProgressByLesson,
  reviews: ConceptReview[],
  now: number,
  passed: Set<CheckpointId> = new Set(),
): CheckpointId | null {
  const byId = new Map(reviews.map((r) => [r.conceptId, r]))
  for (const cp of CHECKPOINTS) {
    if (cp.courseId !== courseId || passed.has(cp.id)) continue
    if (!cp.afterLessons.every((id) => progress[id]?.completed)) continue
    const strengths = cp.afterLessons.flatMap((id) =>
      conceptsForLesson(id).map((c) => {
        const r = byId.get(c.id)
        return r ? strength(r, now) : 0
      }),
    )
    const avg =
      strengths.length === 0
        ? 0
        : strengths.reduce((a, b) => a + b, 0) / strengths.length
    if (avg >= cp.minStrength) return cp.id
  }
  return null
}
