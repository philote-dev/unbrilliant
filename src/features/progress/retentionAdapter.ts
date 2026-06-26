import { conceptsForLesson } from "@/features/progress/concepts"
import { strength, type ConceptReview } from "@/features/progress/conceptReview"

import { lessonRetention } from "./retention"

/**
 * Bridge the per-concept memory substrate into the pure weakest-link policy: look
 * up each load-bearing concept's review, compute its strength for `now`, and
 * reduce. The only deprogression file that depends on the substrate, keeping
 * `retention.ts` decoupled and trivially testable.
 */
export function lessonRetentionFor(
  lessonId: string,
  reviews: ReadonlyMap<string, ConceptReview>,
  now: number,
): number | null {
  const concepts = conceptsForLesson(lessonId).map((c) => {
    const review = reviews.get(c.id)
    return {
      retrievable: c.retrievable,
      strength: review ? strength(review, now) : null,
    }
  })
  return lessonRetention(concepts)
}
