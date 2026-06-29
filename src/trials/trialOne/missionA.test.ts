import { describe, expect, it } from "vitest"

import { classify } from "@/features/trials/capability"
import { gradePrediction, type LineOp } from "@/features/trials/simulate"
import type {
  DesignState,
  Position,
  SegmentSpec,
  StructureKind,
  Verdict,
} from "@/features/trials/types"

import { a1Intake, a2Cancellation, a3Undo, a4Review, missionA } from "./missionA"

/** Place every required op at exactly its required position: the "correct" board. */
function correctDesign(segment: SegmentSpec, structure: StructureKind): DesignState {
  const mapping: Record<string, Position> = {}
  for (const { op, position } of segment.required) mapping[op] = position
  return { structure, mapping }
}

// The expected verdict for a correctly-mapped board on each offered structure,
// pinned straight to the design spec's Mission A table (section 7).
const capabilityCases: {
  segment: SegmentSpec
  expected: Partial<Record<StructureKind, Verdict>>
}[] = [
  {
    segment: a1Intake,
    expected: { queue: "viable", "linked-list": "viable", array: "strained" },
  },
  {
    segment: a2Cancellation,
    expected: { "linked-list": "viable", array: "strained", queue: "broken" },
  },
  {
    segment: a3Undo,
    expected: { stack: "viable", queue: "broken", array: "broken", "linked-list": "broken" },
  },
]

describe("Mission A capability segments grade as authored", () => {
  for (const { segment, expected } of capabilityCases) {
    for (const structure of segment.offeredStructures) {
      const want = expected[structure]
      it(`${segment.id}: ${structure} -> ${want}`, () => {
        expect(want).toBeDefined()
        expect(classify(correctDesign(segment, structure), segment).status).toBe(want)
      })
    }
  }
})

describe("Mission A final review (a4) prediction", () => {
  it("front after the mixed script is B", () => {
    const script = a4Review.eventScript as LineOp[]
    expect(gradePrediction(script, { front: "B" }).correct).toBe(true)
  })

  it("a different front is wrong, and truth reports B", () => {
    const script = a4Review.eventScript as LineOp[]
    const g = gradePrediction(script, { front: "D" })
    expect(g.correct).toBe(false)
    expect(g.truth.front).toBe("B")
  })
})

describe("Mission A assembly", () => {
  it("orders the four segments a1..a4", () => {
    expect(missionA.segments.map((s) => s.id)).toEqual([
      "a1-intake",
      "a2-cancellation",
      "a3-undo",
      "a4-review",
    ])
  })
})
