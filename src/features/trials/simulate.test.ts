import { describe, expect, it } from "vitest"
import { gradePrediction, simulateLine, type LineOp } from "./simulate"

const script: LineOp[] = [
  { t: "arrive", id: "A" },
  { t: "arrive", id: "B" },
  { t: "arrive", id: "C" },
  { t: "arrive", id: "D" },
  { t: "arrive", id: "E" },
  { t: "leaveMiddle", id: "C" },
  { t: "serve" }, // serves A
  { t: "serve" }, // serves B
  { t: "undo" }, // reverses the second serve -> B returns to front
  { t: "arrive", id: "F" },
]

describe("simulateLine", () => {
  it("computes the final front and what undo reversed", () => {
    const r = simulateLine(script)
    expect(r.front).toBe("B")
    expect(r.lastUndoReversed).toBe("serve")
    expect(r.line).toEqual(["B", "D", "E", "F"])
  })
})

describe("gradePrediction", () => {
  it("passes when predicted front matches truth", () => {
    expect(gradePrediction(script, { front: "B" }).correct).toBe(true)
  })
  it("fails and reports truth when wrong", () => {
    const g = gradePrediction(script, { front: "D" })
    expect(g.correct).toBe(false)
    expect(g.truth.front).toBe("B")
  })
})
