import { SkillTarget } from "./types"

// Maps a graded skill id (from the client's SQ_SKILLS, kept as plain strings so
// the rubric stays server-only) to the rubric concept and the proposition(s) a
// wrong answer on that skill implicates. AI hints fire only on the construct
// beats, so only those skills are mapped. A wrong build violates the ordering
// rule (P1) and its consequence/preservation (P3); top-only / two-ended access
// (P2) is not the primary build-order violation.
export const skillTargets: Record<string, SkillTarget> = {
  stackConstruct: { conceptId: "stacks", propositionIds: ["P1", "P3"] },
  queueConstruct: { conceptId: "queues", propositionIds: ["P1", "P3"] },
}

export function targetsForSkill(skill: string): SkillTarget | undefined {
  return skillTargets[skill]
}
