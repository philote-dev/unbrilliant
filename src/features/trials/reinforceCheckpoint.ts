import { GAP_LADDER_MS, MAX_LEVEL, type ConceptReview } from "@/features/progress/conceptReview"

// conceptReview.ts keeps its gap helper private, so we mirror it here (clamped
// the same way) rather than reaching into that module's internals.
function gapForLevel(level: number): number {
  return GAP_LADDER_MS[Math.min(Math.max(level, 0), GAP_LADDER_MS.length - 1)]
}

/**
 * The only path that promotes a concept on massed practice. Called once per
 * Trial completion, per exercised concept. Clean pass climbs one rung; a
 * revised pass only refreshes recency so the concept reads strong again.
 */
export function reinforceCheckpoint(
  r: ConceptReview,
  ev: { at: number; cleanPass: boolean },
): ConceptReview {
  const seen = r.seen + 1
  if (ev.cleanPass) {
    const level = Math.min(r.level + 1, MAX_LEVEL)
    return {
      ...r,
      level,
      seen,
      lastSeenAt: ev.at,
      dueAt: ev.at + gapForLevel(level),
      graduated: level >= MAX_LEVEL,
    }
  }
  return { ...r, seen, lastSeenAt: ev.at, dueAt: ev.at + gapForLevel(r.level) }
}
