import { describe, expect, it } from "vitest"
import {
  conceptId,
  conceptsForLesson,
  risenConcepts,
} from "@/features/progress/concepts"
import { createArrays, toProgressArrays } from "@/features/lesson/arraysEngine"
import { createGraphs, toProgressGraphs } from "@/features/lesson/graphsEngine"
import { createHashTables, toProgressHash } from "@/features/lesson/hashTablesEngine"
import { createHeaps, toProgressHeaps } from "@/features/lesson/heapsEngine"
import {
  createLinkedLists,
  toProgressLinkedLists,
} from "@/features/lesson/linkedListsEngine"
import {
  createStacksQueues,
  toProgress as toProgressStacksQueues,
} from "@/features/lesson/stacksQueuesEngine"
import { createTrees, toProgressTrees } from "@/features/lesson/treesEngine"

describe("concept taxonomy", () => {
  it("derives the 8 stacks-and-queues sub-skills", () => {
    const ids = conceptsForLesson("stacks-and-queues").map((c) => c.id)
    expect(ids).toContain("stacks-and-queues:stackPredict")
    expect(ids).toContain("stacks-and-queues:classify")
    expect(ids).toContain("stacks-and-queues:contrast")
    expect(ids).toHaveLength(8)
  })

  it("marks predict/classify/contrast load-bearing and construction scaffolding", () => {
    const byId = new Map(
      conceptsForLesson("stacks-and-queues").map((c) => [c.id, c]),
    )
    const retrievable = (skill: string) =>
      byId.get(`stacks-and-queues:${skill}`)?.retrievable
    const loadBearing = ["stackPredict", "queuePredict", "classify", "contrast"]
    const scaffolding = [
      "stackRealworld",
      "stackConstruct",
      "queueRealworld",
      "queueConstruct",
    ]
    for (const skill of loadBearing) expect(retrievable(skill)).toBe(true)
    for (const skill of scaffolding) expect(retrievable(skill)).toBe(false)
  })

  it("returns [] for an unknown lesson (safe for not-yet-mapped lessons)", () => {
    expect(conceptsForLesson("nope")).toEqual([])
  })

  it("conceptId composes lesson + sub-skill", () => {
    expect(conceptId("arrays", "a1")).toBe("arrays:a1")
  })

  it("risenConcepts reports only counters that increased, never attempts", () => {
    const prev = { stackPredict: 0, classify: 1, attempts: 4 }
    const next = { stackPredict: 1, classify: 1, attempts: 7 }
    expect(risenConcepts("stacks-and-queues", prev, next)).toEqual([
      "stacks-and-queues:stackPredict",
    ])
  })

  // Drift guard: LESSON_SUBSKILLS must stay identical to each engine's durable
  // counter keys (minus `attempts`). If an engine adds, renames, or drops a
  // counter, the matching row fails loudly instead of the taxonomy going stale.
  const liveCounterKeys = (counters: Record<string, number>): string[] =>
    Object.keys(counters)
      .filter((k) => k !== "attempts")
      .sort()

  it.each([
    {
      lessonId: "stacks-and-queues",
      counters: toProgressStacksQueues(createStacksQueues(1)).counters,
    },
    { lessonId: "arrays", counters: toProgressArrays(createArrays(1)).counters },
    {
      lessonId: "linked-lists",
      counters: toProgressLinkedLists(createLinkedLists(1)).counters,
    },
    {
      lessonId: "hash-tables",
      counters: toProgressHash(createHashTables(1)).counters,
    },
    { lessonId: "trees", counters: toProgressTrees(createTrees(1)).counters },
    { lessonId: "heaps", counters: toProgressHeaps(createHeaps(1)).counters },
    { lessonId: "graphs", counters: toProgressGraphs(createGraphs(1)).counters },
  ])(
    "$lessonId taxonomy stays locked to the live engine counters",
    ({ lessonId, counters }) => {
      const labels = conceptsForLesson(lessonId)
        .map((c) => c.label)
        .sort()
      expect(labels).toEqual(liveCounterKeys(counters))
    },
  )
})
