import { describe, expect, it } from "vitest"
import {
  conceptId,
  conceptsForLesson,
  risenConcepts,
} from "@/features/progress/concepts"

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
    expect(byId.get("stacks-and-queues:stackPredict")?.retrievable).toBe(true)
    expect(byId.get("stacks-and-queues:stackConstruct")?.retrievable).toBe(false)
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
})
