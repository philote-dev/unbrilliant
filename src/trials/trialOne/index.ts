import type { TrialSpec } from "@/features/trials/types"

import { missionA } from "./missionA"
import { trialOneRetrospective } from "./retrospective"

export { missionA } from "./missionA"
export { trialOneRetrospective } from "./retrospective"

/**
 * The Linear Systems Trial (id `trial-1-linear`). User-facing it is just "Trial"
 * (no number). Milestone 1 ships Mission A ("The Line Breaks"); the
 * `exercisedConcepts` list is the tunable set of linear sub-skills promoted one
 * ladder rung on a clean completion (design spec section 8). Mission B is added
 * in Milestone 2.
 */
export const trialOneSpec: TrialSpec = {
  id: "trial-1-linear",
  title: "Trial",
  exercisedConcepts: [
    "stacks-and-queues:queuePredict",
    "stacks-and-queues:stackPredict",
    "arrays:deleteCount",
    "arrays:insertCount",
    "linked-lists:insert",
    "linked-lists:delete",
    "linked-lists:traverse",
    "linked-lists:playlist",
  ],
  retrospective: trialOneRetrospective,
  missions: [missionA],
}
