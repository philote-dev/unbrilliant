import { useCallback } from "react"

import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { lessonRetentionFor } from "@/features/progress/retentionAdapter"

/**
 * Returns a weakest-link retention reader for any lesson (0..1, or null when the
 * lesson has no load-bearing concepts). Reads the shared per-concept review cache
 * from the substrate's `ConceptReviewProvider`; deprogression never persists its
 * own memory state.
 */
export function useLessonRetention(): (lessonId: string, now?: number) => number | null {
  const { reviews } = useConceptReviews()
  return useCallback(
    (lessonId: string, now: number = Date.now()) =>
      lessonRetentionFor(lessonId, reviews, now),
    [reviews],
  )
}
