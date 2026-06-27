import { describe, it, expect } from "vitest"

import { lessonStats } from "./analytics"

describe("lessonStats (Progress drill-down analytics)", () => {
  it("is empty for a never-started lesson", () => {
    expect(lessonStats("stacks-and-queues", undefined)).toMatchObject({
      started: false,
      completed: false,
      attempted: 0,
      correct: 0,
      accuracy: 0,
      mastery: 0,
    })
  })

  it("derives accuracy from correct over attempts (excluding the attempts key)", () => {
    const s = lessonStats("stacks-and-queues", {
      counters: { pops: 3, dequeues: 3, scenarios: 4, attempts: 12 },
      currentPart: "scenario",
      completed: true,
    })
    expect(s.correct).toBe(10)
    expect(s.attempted).toBe(12)
    expect(s.accuracy).toBeCloseTo(10 / 12)
    expect(s.mastery).toBe(1)
    expect(s.completed).toBe(true)
    expect(s.started).toBe(true)
  })

  it("computes Arrays mastery against its own total", () => {
    const s = lessonStats("arrays", {
      counters: { a1: 1, a3: 1, a2: 1, attempts: 5 },
      currentPart: "a2-skin",
      completed: false,
    })
    expect(s.correct).toBe(3)
    expect(s.mastery).toBeCloseTo(3 / 7)
    expect(s.accuracy).toBeCloseTo(3 / 5)
  })
})
