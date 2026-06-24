import { describe, it, expect } from "vitest"

import {
  DATA_STRUCTURES_LESSONS,
  LIVE_LESSON_ID,
  deriveCourseProgress,
  derivePathNodes,
  getCourse,
  isLessonPlayable,
  type ProgressByLesson,
} from "@/lessons/catalog"
import { FUTURE_LESSONS, isFutureLesson } from "@/lessons/registry"

/**
 * Invariants for the lesson layer. Node states and course percentages are
 * DERIVED from real progress (never stored), so these pin both the
 * single-descriptor consistency and the "honest states only" rule.
 */
function completedLessons(...ids: string[]): ProgressByLesson {
  const p: ProgressByLesson = {}
  for (const id of ids) {
    p[id] = { counters: {}, currentPart: "scenario", completed: true }
  }
  return p
}

describe("lesson catalog", () => {
  it("has all seven Data Structures lessons playable, none left in the lazy registry", () => {
    expect(LIVE_LESSON_ID).toBe("stacks-and-queues")
    for (const id of [
      "stacks-and-queues",
      "arrays",
      "linked-lists",
      "hash-tables",
      "trees",
      "heaps",
      "graphs",
    ]) {
      expect(isLessonPlayable(id)).toBe(true)
      expect(isFutureLesson(id)).toBe(false)
    }
    expect(Object.keys(FUTURE_LESSONS)).toEqual([])
  })

  it("registers a lazy component for every not-yet-playable lesson (no drift)", () => {
    const lazy = DATA_STRUCTURES_LESSONS.map((l) => l.id).filter(
      (id) => !isLessonPlayable(id),
    )
    for (const id of lazy) expect(isFutureLesson(id)).toBe(true)
    expect(Object.keys(FUTURE_LESSONS).sort()).toEqual([...lazy].sort())
  })

  it("keeps the course lookup working", () => {
    expect(getCourse("data-structures")?.title).toBe("Data Structures")
    expect(getCourse("nope")).toBeUndefined()
  })
})

describe("derived path nodes (honest states only)", () => {
  it("with no progress: the live lesson is current and the rest are locked", () => {
    const nodes = derivePathNodes({})
    expect(nodes[0]).toMatchObject({ id: LIVE_LESSON_ID, state: "current" })
    expect(nodes.slice(1).every((n) => n.state === "locked")).toBe(true)
  })

  it("keeps Arrays locked until S&Q is done, then flips it to current", () => {
    expect(derivePathNodes({}).find((n) => n.id === "arrays")?.state).toBe(
      "locked",
    )
    const after = derivePathNodes(completedLessons(LIVE_LESSON_ID))
    expect(after.find((n) => n.id === LIVE_LESSON_ID)?.state).toBe("completed")
    expect(after.find((n) => n.id === "arrays")?.state).toBe("current")
  })

  it("unlocks Linked Lists as current once S&Q and Arrays are done (the completion CTA)", () => {
    const after = derivePathNodes(completedLessons("stacks-and-queues", "arrays"))
    expect(after.find((n) => n.id === "arrays")?.state).toBe("completed")
    expect(after.find((n) => n.id === "linked-lists")?.state).toBe("current")
  })

  it("never shows a non-playable lesson as available or current", () => {
    const nodes = derivePathNodes(completedLessons(LIVE_LESSON_ID))
    for (const n of nodes) {
      if (n.state === "available" || n.state === "current") {
        expect(isLessonPlayable(n.id)).toBe(true)
      }
    }
  })
})

describe("derived course progress (no fake percentages)", () => {
  it("is 0 with no completed lessons", () => {
    expect(deriveCourseProgress("data-structures", {})).toBe(0)
  })

  it("is derived from completed lessons over the course size", () => {
    expect(
      deriveCourseProgress("data-structures", completedLessons(LIVE_LESSON_ID)),
    ).toBe(Math.round((1 / DATA_STRUCTURES_LESSONS.length) * 100))
  })

  it("is 0 for a coming-soon course with no lessons yet", () => {
    expect(deriveCourseProgress("algorithms", {})).toBe(0)
  })
})
