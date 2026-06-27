import { SkillTarget } from "./types"

// Maps a graded skill id (kept as plain strings so the rubric stays server-only)
// to the rubric concept and the proposition(s) a wrong answer on that skill
// implicates. Only skills that have a live AI hint are mapped: the S&Q construct
// beats (a wrong build violates the ordering rule P1 and its consequence P3) and
// the arrays grow beat (picking "grow by one" implicates P2 and P3). Skills
// without a hint are intentionally absent.
export const skillTargets: Record<string, SkillTarget> = {
  stackConstruct: { conceptId: "stacks", propositionIds: ["P1", "P3"] },
  queueConstruct: { conceptId: "queues", propositionIds: ["P1", "P3"] },
  // Arrays grow: the learner who picks "grow by one" violates P2 (copies pile up)
  // and implicates P3 (a proportionally bigger block keeps copies rare). Both are
  // withheld so the model nudges without naming "double".
  grow: { conceptId: "arrays", propositionIds: ["P2", "P3"] },
}

export function targetsForSkill(skill: string): SkillTarget | undefined {
  return skillTargets[skill]
}
