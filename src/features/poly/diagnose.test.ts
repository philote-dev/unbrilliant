import { describe, it, expect } from "vitest"
import { correctLine, diagnoseBufferTrace, type Step } from "./diagnose"

const ARRIVAL = ["A", "B", "C", "D"]
const GOAL = ["B", "A", "D", "C"]

describe("correctLine", () => {
  it("derives the unique forced solution for the buffer permutation", () => {
    expect(correctLine(ARRIVAL, GOAL)).toEqual<Step[]>([
      { op: "push", item: "A" },
      { op: "push", item: "B" },
      { op: "pop" },
      { op: "pop" },
      { op: "push", item: "C" },
      { op: "push", item: "D" },
      { op: "pop" },
      { op: "pop" },
    ])
  })
})

describe("diagnoseBufferTrace", () => {
  it("returns null when the trace follows the correct line", () => {
    expect(diagnoseBufferTrace(ARRIVAL, GOAL, correctLine(ARRIVAL, GOAL))).toBeNull()
  })

  it("flags burying a reachable item: push-all-then-pop-all", () => {
    const trace: Step[] = [
      { op: "push", item: "A" },
      { op: "push", item: "B" },
      { op: "push", item: "C" },
      { op: "push", item: "D" },
      { op: "pop" },
      { op: "pop" },
      { op: "pop" },
      { op: "pop" },
    ]
    const d = diagnoseBufferTrace(ARRIVAL, GOAL, trace)
    expect(d).not.toBeNull()
    expect(d?.stepNumber).toBe(3)
    expect(d?.kind).toBe("covered-a-needed-item")
    expect(d?.learnerStep).toEqual({ op: "push", item: "C" })
  })

  it("flags popping from an empty buffer", () => {
    const trace: Step[] = [{ op: "pop" }]
    const d = diagnoseBufferTrace(ARRIVAL, GOAL, trace)
    expect(d?.kind).toBe("popped-empty")
    expect(d?.stepNumber).toBe(1)
  })

  it("names no answer item in its structural output", () => {
    const trace: Step[] = [
      { op: "push", item: "A" },
      { op: "pop" },
    ]
    const d = diagnoseBufferTrace(ARRIVAL, GOAL, trace)
    expect(d?.kind).toBe("popped-too-early")
  })
})
