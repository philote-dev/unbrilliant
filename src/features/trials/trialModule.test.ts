import { describe, expect, it } from "vitest"
import {
  createTrialModule,
  createTrialRun,
  resume,
  toProgress,
  trialReducer,
} from "./trialModule"
import type { TrialSpec } from "./types"

/**
 * A 2-segment, one-mission fixture. Segment `a1` is the A1 shape (a service line:
 * queue/linked-list/array offered, arrival -> back, serve -> front). Segment `a2`
 * is a trivial second capability segment so we can exercise advancing between
 * segments and to completion. Both grade on the capability matrix.
 */
const SPEC: TrialSpec = {
  id: "trial-test-linear",
  title: "Trial Test: Linear",
  exercisedConcepts: [],
  missions: [
    {
      id: "mission-a",
      clientSkin: "check-in desk",
      segments: [
        {
          id: "a1",
          clientPrompt: "Students arrive at the back; serve whoever waited longest.",
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
          nudges: { ends: "Watch which end moves." },
          strainedNudgeId: "ends",
          brokenNudgeId: "ends",
        },
        {
          id: "a2",
          clientPrompt: "Peek at who is next without removing them.",
          offeredStructures: ["queue", "stack"],
          operations: [{ id: "peek", label: "peek next", allowedPositions: ["front", "top"] }],
          required: [{ op: "peek", position: "front" }],
          grading: "capability",
          explanations: { viable: "v", strained: "s", broken: "b" },
          nudges: {},
        },
      ],
    },
  ],
}

describe("trialReducer: run-stress verdicts", () => {
  it("queue with both A1 ops placed runs viable and enters the verdict phase", () => {
    let s = createTrialRun(SPEC)
    s = trialReducer(s, { type: "choose-structure", structure: "queue" })
    s = trialReducer(s, { type: "place-op", op: "arrival", position: "back" })
    s = trialReducer(s, { type: "place-op", op: "serve", position: "front" })
    s = trialReducer(s, { type: "run-stress" })

    expect(s.verdict?.status).toBe("viable")
    expect(s.phase).toBe("verdict")
    expect(s.verdicts).toEqual({ a1: "viable" })
    expect(s.stressTestsRun).toEqual(["a1"])
  })

  it("stack on a line is broken, and advancing while broken is a no-op", () => {
    let s = createTrialRun(SPEC)
    s = trialReducer(s, { type: "choose-structure", structure: "stack" })
    s = trialReducer(s, { type: "place-op", op: "arrival", position: "back" })
    s = trialReducer(s, { type: "place-op", op: "serve", position: "front" })
    s = trialReducer(s, { type: "run-stress" })

    expect(s.verdict?.status).toBe("broken")
    expect(s.phase).toBe("verdict")

    const after = trialReducer(s, { type: "advance" })
    expect(after.segmentIndex).toBe(0)
    expect(after.phase).toBe("verdict")
  })
})

describe("trialReducer: cleanPass", () => {
  it("a broken first run permanently clears cleanPass even after revising to viable", () => {
    let s = createTrialRun(SPEC)
    s = trialReducer(s, { type: "choose-structure", structure: "stack" })
    s = trialReducer(s, { type: "place-op", op: "arrival", position: "back" })
    s = trialReducer(s, { type: "place-op", op: "serve", position: "front" })
    s = trialReducer(s, { type: "run-stress" })
    expect(s.cleanPass).toBe(false)

    s = trialReducer(s, { type: "revise" })
    expect(s.phase).toBe("design")
    expect(s.verdict).toBeNull()

    s = trialReducer(s, { type: "choose-structure", structure: "queue" })
    s = trialReducer(s, { type: "run-stress" })
    expect(s.verdict?.status).toBe("viable")
    expect(s.cleanPass).toBe(false)
  })

  it("a fully viable run advances to completion with cleanPass intact", () => {
    const mod = createTrialModule(SPEC)
    let s = mod.create()

    s = trialReducer(s, { type: "choose-structure", structure: "queue" })
    s = trialReducer(s, { type: "place-op", op: "arrival", position: "back" })
    s = trialReducer(s, { type: "place-op", op: "serve", position: "front" })
    s = trialReducer(s, { type: "run-stress" })
    expect(s.verdict?.status).toBe("viable")

    s = trialReducer(s, { type: "advance" })
    expect(s.segmentIndex).toBe(1)
    expect(s.phase).toBe("design")
    expect(s.structure).toBeNull()
    expect(s.mapping).toEqual({})

    s = trialReducer(s, { type: "choose-structure", structure: "queue" })
    s = trialReducer(s, { type: "place-op", op: "peek", position: "front" })
    s = trialReducer(s, { type: "run-stress" })
    expect(s.verdict?.status).toBe("viable")

    s = trialReducer(s, { type: "advance" })
    expect(s.phase).toBe("complete")
    expect(s.cleanPass).toBe(true)
    expect(mod.completed(s)).toBe(true)
  })
})

describe("trialReducer: guards", () => {
  it("run-stress is a no-op until every required op is placed", () => {
    let s = createTrialRun(SPEC)
    s = trialReducer(s, { type: "choose-structure", structure: "queue" })
    s = trialReducer(s, { type: "place-op", op: "arrival", position: "back" })

    const after = trialReducer(s, { type: "run-stress" })
    expect(after.verdict).toBeNull()
    expect(after.phase).toBe("design")
    expect(after.stressTestsRun).toEqual([])
  })
})

describe("trialModule: toProgress / resume", () => {
  it("round-trips missionIndex, segmentIndex, cleanPass, and verdicts", () => {
    let s = createTrialRun(SPEC)
    s = trialReducer(s, { type: "choose-structure", structure: "queue" })
    s = trialReducer(s, { type: "place-op", op: "arrival", position: "back" })
    s = trialReducer(s, { type: "place-op", op: "serve", position: "front" })
    s = trialReducer(s, { type: "run-stress" })
    s = trialReducer(s, { type: "advance" })

    const slice = toProgress(s)
    const restored = resume(slice, SPEC)

    expect(restored.missionIndex).toBe(0)
    expect(restored.segmentIndex).toBe(1)
    expect(restored.cleanPass).toBe(true)
    expect(restored.verdicts).toEqual({ a1: "viable" })
  })
})
