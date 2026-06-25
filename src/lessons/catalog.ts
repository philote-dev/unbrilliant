import type { ComponentType } from "react"

import type { PathNode, PathNodeState } from "@/components/willow/CoursePath"
import type { LessonProgress } from "@/features/lesson/engine"

/**
 * Static catalog for the platform. Course/lesson *metadata* lives here; all
 * progress-dependent state (course percentages, path node states, unlocks) is
 * DERIVED from real `LessonProgress` via the helpers below. Never stored on the
 * catalog, never faked.
 */
export type CourseState = "available" | "soon"

export interface Course {
  id: string
  title: string
  subtitle: string
  icon: "data-structures" | "algorithms" | "probability"
  state: CourseState
}

export const COURSES: Course[] = [
  {
    id: "data-structures",
    title: "Data Structures",
    subtitle: "How data is stored and moved",
    icon: "data-structures",
    state: "available",
  },
  {
    id: "algorithms",
    title: "Algorithms",
    subtitle: "Step-by-step problem solving",
    icon: "algorithms",
    state: "soon",
  },
  {
    id: "probability",
    title: "Probability",
    subtitle: "Reasoning under uncertainty",
    icon: "probability",
    state: "soon",
  },
]

/**
 * Single source of truth for the Data Structures lessons (id, display name, and
 * (for not-yet-playable previews) a lazy `load` thunk). A lesson WITHOUT a
 * `load` is playable (rendered eagerly by LessonPlayer); the lazy registry and
 * the derived path are both derived from this list, so adding a real lesson is
 * one entry here plus its module.
 */
export interface LessonDef {
  id: string
  name: string
  load?: () => Promise<{ default: ComponentType }>
}

export const DATA_STRUCTURES_LESSONS: LessonDef[] = [
  { id: "stacks-and-queues", name: "Stacks & Queues" },
  { id: "arrays", name: "Arrays" },
  { id: "linked-lists", name: "Linked Lists" },
  { id: "hash-tables", name: "Hash Tables" },
  { id: "trees", name: "Trees" },
  { id: "heaps", name: "Heaps" },
  { id: "graphs", name: "Graphs" },
]

/** Lessons per course (only Data Structures has real lessons in the MVP). */
export const COURSE_LESSONS: Record<string, LessonDef[]> = {
  "data-structures": DATA_STRUCTURES_LESSONS,
}

export function courseLessons(courseId: string): LessonDef[] {
  return COURSE_LESSONS[courseId] ?? []
}

/** The first eager, playable lesson: the descriptor with no lazy `load`. */
export const LIVE_LESSON_ID: string =
  DATA_STRUCTURES_LESSONS.find((l) => !l.load)?.id ?? "stacks-and-queues"

/** Real progress, keyed by lessonId (a missing entry means "not started"). */
export type ProgressByLesson = Record<string, LessonProgress | undefined>

/**
 * Is a lesson actually playable (has a real module, not a lazy preview)? In the
 * MVP that's whichever lesson lacks a `load` thunk.
 */
export function isLessonPlayable(lessonId: string): boolean {
  const def = DATA_STRUCTURES_LESSONS.find((l) => l.id === lessonId)
  return !!def && !def.load
}

/**
 * Is a lesson unlocked (the gating rule)? Sequential: the first lesson is always
 * unlocked, and each subsequent lesson unlocks once the previous one is
 * completed, so finishing Stacks & Queues really unlocks Arrays.
 */
export function isLessonUnlocked(
  lessonId: string,
  progress: ProgressByLesson,
): boolean {
  const index = DATA_STRUCTURES_LESSONS.findIndex((l) => l.id === lessonId)
  if (index <= 0) return true
  const prev = DATA_STRUCTURES_LESSONS[index - 1]
  return progress[prev.id]?.completed === true
}

/** The Data Structures path with honest, progress-derived node states. */
export function derivePathNodes(progress: ProgressByLesson): PathNode[] {
  let currentAssigned = false
  return DATA_STRUCTURES_LESSONS.map(({ id, name }) => {
    const completed = progress[id]?.completed ?? false
    const open = isLessonPlayable(id) && isLessonUnlocked(id, progress)
    let state: PathNodeState
    if (completed) {
      state = "completed"
    } else if (open && !currentAssigned) {
      state = "current"
      currentAssigned = true
    } else if (open) {
      state = "available"
    } else {
      state = "locked"
    }
    return { id, name, state }
  })
}

/** The lesson a learner should Start/Continue/resume into for a course. */
export function currentLessonId(progress: ProgressByLesson): string {
  const nodes = derivePathNodes(progress)
  const node =
    nodes.find((n) => n.state === "current") ??
    nodes.find((n) => n.state === "available") ??
    nodes.find((n) => n.state === "completed") ??
    nodes[0]
  return node?.id ?? LIVE_LESSON_ID
}

/** Real course completion as a 0-100 percentage, from completed lessons. */
export function deriveCourseProgress(
  courseId: string,
  progress: ProgressByLesson,
): number {
  const lessons = courseLessons(courseId)
  if (lessons.length === 0) return 0
  const done = lessons.filter((l) => progress[l.id]?.completed).length
  return Math.round((done / lessons.length) * 100)
}

export function getCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id)
}

export function lessonName(lessonId: string): string {
  return (
    DATA_STRUCTURES_LESSONS.find((l) => l.id === lessonId)?.name ?? "this lesson"
  )
}
