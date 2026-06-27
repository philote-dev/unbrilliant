/**
 * Shared top-to-bottom reveal timing (seconds) for the average-cost summary, so the
 * figure (GrowSummary) and the explanation (GrowSummaryPart) stay in step. The page
 * reads as a sequence: the title is already there to read, then each column cascades
 * in from the top (its label, the full block, the arrow, the slow copy, the total),
 * and finally the explanation arises. Reduced motion ignores all of it (instant).
 *
 * `oldBlock` is handed to CopyGrow as its `baseDelay`; CopyGrow derives the arrow
 * (+0.3) and the copy (+0.6) from it, so the within-column order stays top-to-bottom.
 */
export const SUMMARY_REVEAL = {
  colTitle: 0.8,
  oldBlock: 1.2,
  total: 3.0,
  explain: 3.5,
} as const
