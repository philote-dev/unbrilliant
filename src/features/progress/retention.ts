/**
 * Pure deprogression policy: derive a per-lesson "retention + needs-review" view
 * from already-computed per-concept strengths. Decoupled from the spaced-repetition
 * substrate by design (it takes strengths, not reviews), so it is unit-testable on
 * its own and the substrate adapter lives separately. See
 * `docs/plans/specs/2026-06-25-spiky-pov-deprogression-design.md`.
 */

/** Below this retention a completed lesson reads "needs review". Tunable. */
export const REVIEW_THRESHOLD = 0.5

export type RetentionBand = "fresh" | "fading" | "rusty" | "lost"

/** Band lower edges, highest first. Tunable; mirrors the spec's bands. */
const BAND_EDGES: { band: RetentionBand; min: number }[] = [
  { band: "fresh", min: 0.8 },
  { band: "fading", min: 0.5 },
  { band: "rusty", min: 0.2 },
  { band: "lost", min: 0 },
]

export interface ConceptStrength {
  /** Whether this sub-skill is load-bearing (enters the deck). */
  retrievable: boolean
  /** 0..1 retrievability for the current time, or null if it has no review row yet. */
  strength: number | null
}

/**
 * Weakest-link retention: the minimum strength across a lesson's load-bearing
 * concepts. `null` means the lesson has no load-bearing concepts to track. A
 * load-bearing concept with no review row falls back to 1 (treat as freshly
 * earned), so a not-started lesson reads fresh and we never flag on missing data.
 */
export function lessonRetention(concepts: ConceptStrength[]): number | null {
  const load = concepts.filter((c) => c.retrievable)
  if (load.length === 0) return null
  return Math.min(...load.map((c) => c.strength ?? 1))
}

/** True only for a real, sub-threshold retention (never for null). */
export function needsReview(retention: number | null): boolean {
  return retention !== null && retention < REVIEW_THRESHOLD
}

/** The band a retention fraction falls in. */
export function retentionBand(retention: number): RetentionBand {
  const hit = BAND_EDGES.find((b) => retention >= b.min)
  return (hit ?? BAND_EDGES[BAND_EDGES.length - 1]).band
}

/**
 * The shown mastery, decayed. `earnedMastery` (the peak record) is left untouched;
 * we multiply by retention for display so the earned record stays honest.
 */
export function currentMastery(
  earnedMastery: number,
  retention: number | null,
): number {
  return retention === null ? earnedMastery : earnedMastery * retention
}
