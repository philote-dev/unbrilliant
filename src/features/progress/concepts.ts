import { SQ_SKILLS } from "@/features/lesson/stacksQueuesEngine"
import type { ConceptId } from "@/features/progress/conceptReview"

export type { ConceptId }

export interface Concept {
  id: ConceptId
  lessonId: string
  courseId: string
  label: string // the sub-skill key; for tiles/debug, never a recall prompt
  retrievable: boolean // load-bearing sub-skills enter the SR deck
}

/**
 * Each lesson's durable correct-count sub-skills, mirroring the engine's
 * `toProgress().counters` keys (minus `attempts`). Keep in sync with the engine
 * when its counters change.
 */
const LESSON_SUBSKILLS: Record<string, string[]> = {
  "stacks-and-queues": [...SQ_SKILLS],
  arrays: ["a1", "a3", "a2", "a2Skin", "a4", "a5", "a6Grow", "a6Cheap"],
  "linked-lists": [
    "traverse",
    "insert",
    "delete",
    "predict",
    "playlist",
    "contrastInsert",
    "contrastReach",
  ],
  "hash-tables": ["hash", "collision", "lookup"],
  trees: ["locate", "sequence", "comparison"],
  heaps: ["siftUp", "siftDown", "mapping", "contrast"],
  graphs: ["read", "draw", "same"],
}

/**
 * Sub-skills that are construction/scaffolding rather than load-bearing
 * assessment, so they stay OUT of the SR deck and out of decay aggregation.
 * Only stacks-and-queues is curated here (its skills are understood); other
 * lessons currently treat every sub-skill as retrievable. Narrowing the rest is
 * a fast follow-up alongside the per-concept item providers.
 */
const NON_RETRIEVABLE: Record<string, ReadonlySet<string>> = {
  "stacks-and-queues": new Set([
    "stackRealworld",
    "stackConstruct",
    "queueRealworld",
    "queueConstruct",
  ]),
}

const COURSE_ID = "data-structures"

export function conceptId(lessonId: string, subSkill: string): ConceptId {
  return `${lessonId}:${subSkill}`
}

export function conceptsForLesson(lessonId: string): Concept[] {
  const skills = LESSON_SUBSKILLS[lessonId] ?? []
  const nonRet = NON_RETRIEVABLE[lessonId] ?? new Set<string>()
  return skills.map((s) => ({
    id: conceptId(lessonId, s),
    lessonId,
    courseId: COURSE_ID,
    label: s,
    retrievable: !nonRet.has(s),
  }))
}

/**
 * Concept ids whose durable correct-count rose between two counter snapshots
 * (excludes `attempts`). Pure; drives the in-lesson recovery hook.
 */
export function risenConcepts(
  lessonId: string,
  prev: Record<string, number>,
  next: Record<string, number>,
): ConceptId[] {
  const out: ConceptId[] = []
  for (const [key, value] of Object.entries(next)) {
    if (key === "attempts") continue
    if (value > (prev[key] ?? 0)) out.push(conceptId(lessonId, key))
  }
  return out
}
