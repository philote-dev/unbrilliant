export type ConceptId = string // "${lessonId}:${subSkill}"

/**
 * The neutral, shared per-concept memory substrate. Retrieval (scheduling) and
 * deprogression (decay) both build on this. `strength` is derived-on-read (a
 * forgetting curve whose half-life is the current ladder gap); nothing here
 * knows about bands, thresholds, drills, or "needs review".
 */
export interface ConceptReview {
  conceptId: ConceptId
  level: number // ladder position (scheduling)
  correctStreak: number // consecutive spaced-correct reps
  lapses: number // wrong reveals, all-time
  seen: number // total encounters (drives the reword encounter index)
  lastSeenAt: number // epoch ms
  dueAt: number // lastSeenAt + gap(level)
  graduated: boolean
}

const DAY = 86_400_000
export const GAP_LADDER_MS = [DAY, 3 * DAY, 7 * DAY, 21 * DAY] // levels 0..3
export const MAX_LEVEL = GAP_LADDER_MS.length // graduate after 4 spaced reps
export const MIN_GAP_MS = 20 * 60 * 60 * 1000 // 20h floor: never same/next-session

export function gapForLevel(level: number): number {
  return GAP_LADDER_MS[Math.min(Math.max(level, 0), GAP_LADDER_MS.length - 1)]
}

export function newReview(conceptId: ConceptId, at: number): ConceptReview {
  return {
    conceptId,
    level: 0,
    correctStreak: 0,
    lapses: 0,
    seen: 0,
    lastSeenAt: at,
    dueAt: at + GAP_LADDER_MS[0],
    graduated: false,
  }
}

/** 0..1 retrievability under a forgetting curve with half-life = gap(level). */
export function strength(r: ConceptReview, now: number): number {
  const elapsed = Math.max(0, now - r.lastSeenAt)
  return Math.pow(2, -elapsed / gapForLevel(r.level))
}

/**
 * The ONE write path. A spaced correct rep promotes (lengthens the gap); a
 * massed correct rep holds (no inflation); a wrong rep keeps the rung but resets
 * the streak toward the next rung (slowed mastery, never a demote) and re-tests
 * after MIN_GAP. Long-term un-mastery is the decay side's job, not one miss. `at`
 * is injected so the substrate stays clock-free and pure.
 */
export function applyReview(
  r: ConceptReview,
  ev: { correct: boolean; at: number },
): ConceptReview {
  const seen = r.seen + 1
  if (ev.correct) {
    const spaced = ev.at - r.lastSeenAt >= gapForLevel(r.level)
    const level = spaced ? Math.min(r.level + 1, MAX_LEVEL) : r.level
    return {
      ...r,
      level,
      correctStreak: spaced ? r.correctStreak + 1 : r.correctStreak,
      seen,
      lastSeenAt: ev.at,
      dueAt: ev.at + gapForLevel(level),
      graduated: level >= MAX_LEVEL,
    }
  }
  // A miss never drops a rung: the learner is shown the answer and will get it
  // next time. Keep the rung (and graduated), reset the streak toward the next
  // rung (slowed mastery), bump lapses, and re-test soon.
  return {
    ...r,
    correctStreak: 0,
    lapses: r.lapses + 1,
    seen,
    lastSeenAt: ev.at,
    dueAt: ev.at + MIN_GAP_MS,
  }
}
