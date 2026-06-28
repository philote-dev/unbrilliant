import { describe, expect, it } from "vitest"
import { classify, costAt } from "./capability"
import type { DesignState, SegmentSpec } from "./types"

const A1: SegmentSpec = {
  id: "a1",
  clientPrompt: "",
  offeredStructures: ["queue", "linked-list", "array"],
  operations: [
    { id: "arrival", label: "new arrival", allowedPositions: ["front", "back", "middle"] },
    { id: "serve", label: "serve next", allowedPositions: ["front", "back", "middle"] },
  ],
  required: [
    { op: "arrival", position: "back" },
    { op: "serve", position: "front" },
  ],
  grading: "capability",
  explanations: { viable: "v", strained: "s", broken: "b" },
  nudges: { n: "watch the ends" },
  strainedNudgeId: "n",
  brokenNudgeId: "n",
}

const design = (over: Partial<DesignState>): DesignState => ({
  structure: "queue",
  mapping: { arrival: "back", serve: "front" },
  ...over,
})

describe("costAt", () => {
  it("treats undeclared positions as impossible", () => {
    expect(costAt("queue", "middle")).toBe("impossible")
    expect(costAt("stack", "front")).toBe("impossible")
    expect(costAt("array", "front")).toBe("expensive")
    expect(costAt("linked-list", "middle")).toBe("cheap")
  })
})

describe("classify", () => {
  it("queue with correct ends is viable", () => {
    expect(classify(design({ structure: "queue" }), A1).status).toBe("viable")
  })
  it("array front-serve is strained", () => {
    expect(classify(design({ structure: "array" }), A1).status).toBe("strained")
  })
  it("stack cannot own a line: broken", () => {
    expect(classify(design({ structure: "stack" }), A1).status).toBe("broken")
  })
  it("misplaced op (serve at back) is broken", () => {
    const d = design({ structure: "queue", mapping: { arrival: "back", serve: "back" } })
    expect(classify(d, A1).status).toBe("broken")
  })
  it("unmapped required op is broken", () => {
    const d = design({ structure: "queue", mapping: { arrival: "back" } })
    expect(classify(d, A1).status).toBe("broken")
  })
  it("non-viable verdicts carry a nudgeId", () => {
    expect(classify(design({ structure: "array" }), A1).nudgeId).toBe("n")
  })
})
