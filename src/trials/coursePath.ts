import type { PathNode, PathNodeState } from "@/components/willow/CoursePath"
import { trialUnlocked } from "@/features/trials/gating"
import type { ProgressByLesson } from "@/lessons/catalog"

import { TRIALS, trialOrder } from "./registry"

/**
 * Which lesson each Trial caps. The Trial renders as an additive node right after
 * that lesson on the course path; it is the only coupling between a Trial and the
 * lesson list (the lesson path itself, `derivePathNodes`, is never touched).
 */
const TRIAL_AFTER_LESSON: Record<string, string> = {
  "trial-1-linear": "linked-lists",
}

/**
 * Insert each Trial as an additive node after the lesson it caps, deriving state
 * from real progress and completed trials. Soft chaining: lessons are never
 * re-gated, so the Trial is "available" once its unit is complete (and the prior
 * Trial is done), "completed" once conquered, else "locked". It never claims
 * "current" - the lesson flow keeps that. Lesson nodes pass through untouched.
 */
export function withTrialNodes(
  lessonNodes: PathNode[],
  progress: ProgressByLesson,
  completedTrials: ReadonlySet<string>,
): PathNode[] {
  const completed = new Set(completedTrials)
  const result = [...lessonNodes]
  for (const trial of TRIALS) {
    const capLesson = TRIAL_AFTER_LESSON[trial.id]
    if (!capLesson) continue
    const idx = result.findIndex((n) => n.id === capLesson)
    if (idx < 0) continue
    const state: PathNodeState = completed.has(trial.id)
      ? "completed"
      : trialUnlocked({
            trialId: trial.id,
            order: trialOrder,
            completed,
            unitComplete: progress[capLesson]?.completed === true,
          })
        ? "available"
        : "locked"
    result.splice(idx + 1, 0, { id: trial.id, name: trial.title, state })
  }
  return result
}
