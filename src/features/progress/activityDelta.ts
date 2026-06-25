/**
 * Pure helpers for turning a run's monotonic counters into per-day activity
 * deltas. Kept out of React so the recording seam stays StrictMode-safe: deltas
 * come from the change in cumulative counters, never from how often an effect
 * fires.
 */

/** Total checked answers (`attempted`) and correct answers from a counters map. */
export function answerTallies(counters: Record<string, number>): {
  attempted: number
  correct: number
} {
  let correct = 0
  let attempted = 0
  for (const [k, v] of Object.entries(counters)) {
    if (k === "attempts") attempted = v
    else correct += v
  }
  return { attempted, correct }
}

/** The non-negative increase from `prev` to `next` ({0,0} when not advancing). */
export function activityDelta(
  prev: { attempted: number; correct: number },
  next: { attempted: number; correct: number },
): { attempted: number; correct: number } {
  return {
    attempted: Math.max(0, next.attempted - prev.attempted),
    correct: Math.max(0, next.correct - prev.correct),
  }
}
