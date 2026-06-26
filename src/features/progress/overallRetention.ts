import { conceptsForLesson } from "@/features/progress/concepts"
import { strength, type ConceptReview } from "@/features/progress/conceptReview"

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 1)

/**
 * App-wide retention as a weakest-link signal: the MIN strength() across the
 * retrievable concepts (that have a review) of every completed lesson. The
 * floor of 1 means unseen concepts and reviewless lessons read as fresh, so the
 * willow only yellows once something real has decayed. Pure: the clock is
 * injected, so it stays unit-testable.
 */
export function overallRetention(
  completedLessonIds: string[],
  reviews: ReadonlyMap<string, ConceptReview>,
  now: number,
): number {
  let min = 1
  for (const lessonId of completedLessonIds) {
    for (const concept of conceptsForLesson(lessonId)) {
      if (!concept.retrievable) continue
      const review = reviews.get(concept.id)
      if (!review) continue
      const s = strength(review, now)
      if (s < min) min = s
    }
  }
  return clamp01(min)
}
