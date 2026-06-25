/**
 * Pure, deterministic patient data for the ER triage skin of the sift-up beat.
 * A heap of distinct integer keys becomes a board of patients whose `severity`
 * IS the key, so the heap's "distinct keys, unique sift path" guarantee carries
 * straight over as "no two patients share a priority". No React, no randomness:
 * `patientFor(severity, heap)` always returns the same patient for the same
 * inputs, and the board NEVER computes correctness. It only dresses values the
 * engine already fixed.
 *
 * `level` is the patient's 1-based urgency rank on the CURRENT board (1 = most
 * urgent = the heap root), derived purely from how many values outrank them, so
 * the colour accent tracks the max-heap idea ("the most urgent is always on top").
 */

export type PatientIcon =
  | "heart"
  | "activity"
  | "bone"
  | "thermometer"
  | "stethoscope"
  | "pill"
  | "bandage"
  | "brain"

export interface Patient {
  name: string
  /** The triage priority: the distinct heap key itself. */
  severity: number
  /** 1-based urgency rank on the current board (1 = most urgent). */
  level: number
  icon: PatientIcon
  /** Hex accent for the card's urgency stripe. */
  accent: string
}

// A prime-length pool keeps the curated heaps collision-free (every distinct
// severity maps to a distinct name under the modulo).
const NAMES = [
  "Reyes",
  "Okafor",
  "Nguyen",
  "Patel",
  "Santos",
  "Kim",
  "Ahmed",
  "Walsh",
  "Ferreira",
  "Becker",
  "Osei",
  "Larsen",
  "Romano",
] as const

const ICONS: PatientIcon[] = [
  "heart",
  "activity",
  "bone",
  "thermometer",
  "stethoscope",
  "pill",
  "bandage",
  "brain",
]

/** Clinical urgency palette, most-urgent (level 1) first; deeper levels reuse the last. */
const LEVEL_ACCENT = ["#dc2626", "#ea580c", "#d97706", "#0891b2", "#475569"] as const

/** A stable non-negative index from a key, so negative keys still map cleanly. */
const idx = (key: number, mod: number): number => ((Math.trunc(key) % mod) + mod) % mod

/** The 1-based urgency rank of `severity` on `heap` (1 = most urgent / the root). */
export function triageLevel(severity: number, heap: number[]): number {
  let above = 0
  for (const v of heap) if (v > severity) above++
  return above + 1
}

/** The deterministic patient for a severity (the heap key) on the current board. */
export function patientFor(severity: number, heap: number[]): Patient {
  const level = triageLevel(severity, heap)
  return {
    name: NAMES[idx(severity, NAMES.length)],
    severity,
    level,
    icon: ICONS[idx(severity, ICONS.length)],
    accent: LEVEL_ACCENT[Math.min(level - 1, LEVEL_ACCENT.length - 1)],
  }
}
