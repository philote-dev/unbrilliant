import type { TrialId, TrialSpec } from "@/features/trials/types"

import { trialOneSpec } from "./trialOne"

/**
 * Every authored Trial, in campaign order. The single source of truth the host
 * resolves against and the gating reads; kept as a module-level singleton so the
 * resolved spec is referentially stable (no per-render rebuilds).
 */
export const TRIALS: TrialSpec[] = [trialOneSpec]

/** Resolve a Trial by id; undefined for an unknown id (host renders not-found). */
export function getTrial(id: string): TrialSpec | undefined {
  return TRIALS.find((trial) => trial.id === id)
}

/** Trial ids in campaign order; consumed by soft trial-to-trial gating. */
export const trialOrder: TrialId[] = TRIALS.map((trial) => trial.id)
