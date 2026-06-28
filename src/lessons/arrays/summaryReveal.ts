/**
 * Shared reveal timing (seconds) for the average-cost summary, so the figure
 * (GrowSummary) and the explanation (GrowSummaryPart) stay in step. This is a teach
 * page the learner lingers on, so the whole thing is deliberately slow and reads as
 * one causal sequence. Each column grows its block twice, in sync with the ledger:
 *
 *   title (read) -> column label -> full block + chip #1 -> resize, copy in a new
 *   block + chip #2 -> resize again, copy into a bigger block + chip #3 -> the
 *   remaining run chips fill in -> the total loads -> the explanation arises.
 *
 * Chips #1/#2/#3 are pinned to the three blocks (full, first resize, second resize).
 * Each block's empty frame is allocated ~1s before its cells copy in. Reduced motion
 * ignores all of it (instant).
 */
export const SUMMARY_REVEAL = {
  colLabel: 0.8,
  full: 2.0, // block 1 (the full block) + chip #1
  copy: 5.0, // block 2 fills (first resize) + chip #2
  copy2: 8.6, // block 3 fills (second resize) + chip #3
  restStart: 11.4, // remaining ledger chips (#4..#8) begin
  restStagger: 0.36,
  total: 13.6, // the total, after the ledger has filled
  explain: 14.4, // the explanation, last
} as const
