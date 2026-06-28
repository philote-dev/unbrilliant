import type { TrialId } from "./types"

export interface TrialUnlockInput {
  trialId: TrialId
  order: TrialId[]
  completed: Set<TrialId>
  /** the capping curriculum unit for this trial is finished */
  unitComplete: boolean
}

export function trialUnlocked({ trialId, order, completed, unitComplete }: TrialUnlockInput): boolean {
  if (!unitComplete) return false
  const idx = order.indexOf(trialId)
  if (idx <= 0) return true
  return completed.has(order[idx - 1])
}
