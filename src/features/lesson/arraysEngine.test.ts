import { describe, it, expect } from "vitest"

import {
  ARRAYS_TOTAL_PARTS,
  arraysReducer,
  createArrays,
  currentPartArrays,
  isCompleteArrays,
  resizeFrames,
  resumeArrays,
  shiftFrames,
  toProgressArrays,
  type ArraysState,
  type ShiftFrame,
} from "./arraysEngine"
import type { LessonAction } from "./engine"

/**
 * Behavior-focused tests for the Arrays engine. Like the S&Q engine, everything
 * is driven through dispatched actions and asserted via external behavior —
 * verdict, counters, combo, completion — with a FIXED seed for determinism.
 * Arrays reuses the shared feedback machine + flame (gradeAnswer).
 */
const SEED = 7

function apply(state: ArraysState, ...actions: LessonAction[]): ArraysState {
  return actions.reduce(arraysReducer, state)
}

/** Answer the current question correctly (the engine exposes the winning id). */
function answerCorrect(s: ArraysState): ArraysState {
  return apply(s, { type: "select", letter: s.question!.answer }, { type: "check" })
}

/** Answer with any non-winning option (always wrong). */
function answerWrong(s: ArraysState): ArraysState {
  const wrong = s.question!.options.find((o) => o.id !== s.question!.answer)
  if (!wrong) throw new Error("question has no wrong option")
  return apply(s, { type: "select", letter: wrong.id }, { type: "check" })
}

function atShift(): ArraysState {
  return apply(createArrays(SEED), { type: "continue" })
}

/** Drive the full mastery path: 3 shift + 3 cost + 2 resize, all correct. */
function happyPath(seed = SEED): ArraysState {
  let s = apply(createArrays(seed), { type: "continue" }) // access -> shift
  for (let i = 0; i < 3; i++) s = apply(answerCorrect(s), { type: "next" })
  for (let i = 0; i < 3; i++) s = apply(answerCorrect(s), { type: "next" })
  for (let i = 0; i < 2; i++) s = apply(answerCorrect(s), { type: "next" })
  return s
}

describe("Arrays — access intro (instant access is free)", () => {
  it("starts on the access part and advances to shift on continue", () => {
    const s = createArrays(SEED)
    expect(currentPartArrays(s)).toBe("access")
    expect(apply(s, { type: "check" })).toBe(s) // no check on the intro
    expect(currentPartArrays(apply(s, { type: "continue" }))).toBe("shift")
  })
})

describe("Arrays — shift prediction (predict-next-state)", () => {
  it("a correct result is correct, climbs the combo, and bumps shiftPredict", () => {
    const s = answerCorrect(atShift())
    expect(s.feedback).toBe("correct")
    expect(s.shiftCorrect).toBe(1)
    expect(s.combo).toBe(1)
  })

  it("first wrong nudges (count untouched); second wrong fails and breaks combo", () => {
    let s = answerWrong(atShift())
    expect(s.feedback).toBe("nudge")
    expect(s.shiftCorrect).toBe(0)
    s = answerWrong(s)
    expect(s.feedback).toBe("fail")
    expect(s.combo).toBe(0)
    expect(s.shiftCorrect).toBe(0)
  })
})

describe("Arrays — cost/count and resize verdicts", () => {
  it("counts a correct cost answer and a correct resize answer", () => {
    const atCost = resumeArrays(
      { counters: { shiftPredict: 3 }, currentPart: "cost", completed: false },
      SEED,
    )
    expect(currentPartArrays(atCost)).toBe("cost")
    expect(answerCorrect(atCost).costCorrect).toBe(1)

    const atResize = resumeArrays(
      {
        counters: { shiftPredict: 3, costCount: 3 },
        currentPart: "resize",
        completed: false,
      },
      SEED,
    )
    expect(currentPartArrays(atResize)).toBe("resize")
    expect(answerCorrect(atResize).resizeCorrect).toBe(1)
  })
})

describe("Arrays — quota gating + completion (3 / 3 / 2)", () => {
  it("cannot leave shift until shiftPredict === 3", () => {
    let s = atShift()
    s = apply(answerCorrect(s), { type: "next" })
    expect(currentPartArrays(s)).toBe("shift")
    s = apply(answerCorrect(s), { type: "next" })
    expect(currentPartArrays(s)).toBe("shift")
    s = apply(answerCorrect(s), { type: "next" })
    expect(currentPartArrays(s)).toBe("cost") // 3rd correct advances
  })

  it("completes only after the full 3 / 3 / 2 gate", () => {
    const s = happyPath()
    expect(s.shiftCorrect).toBe(3)
    expect(s.costCorrect).toBe(3)
    expect(s.resizeCorrect).toBe(2)
    expect(s.completed).toBe(true)
    expect(isCompleteArrays(s)).toBe(true)
  })
})

describe("Arrays — failed/revealed never count; combo behavior", () => {
  it("a full fail leaves the count untouched", () => {
    const failed = answerWrong(answerWrong(atShift()))
    expect(failed.feedback).toBe("fail")
    expect(failed.shiftCorrect).toBe(0)
    const revealed = apply(answerWrong(atShift()), { type: "reveal" })
    expect(revealed.showWhy).toBe(true)
    expect(revealed.shiftCorrect).toBe(0)
  })

  it("the on-fire combo carries across Arrays parts and maxes on the happy path", () => {
    expect(happyPath().combo).toBe(8) // 3 + 3 + 2 correct, no breaks
  })
})

describe("Arrays — resume / progress", () => {
  it("squashes to a lesson-shaped counters map (with attempt tally)", () => {
    const p = toProgressArrays(happyPath())
    expect(p.counters).toEqual({
      shiftPredict: 3,
      costCount: 3,
      resizePredict: 2,
      attempts: 8, // 8 correct answers, no wrong attempts
    })
    expect(p.completed).toBe(true)
  })

  it("restores the persisted part + counts with a cold combo", () => {
    const s = resumeArrays(
      {
        counters: { shiftPredict: 3, costCount: 1, resizePredict: 0 },
        currentPart: "cost",
        completed: false,
      },
      SEED,
    )
    expect(currentPartArrays(s)).toBe("cost")
    expect(s.shiftCorrect).toBe(3)
    expect(s.costCorrect).toBe(1)
    expect(s.combo).toBe(0)
    expect(s.completed).toBe(false)
  })

  it("has the access part plus the three quota parts", () => {
    expect(ARRAYS_TOTAL_PARTS).toBe(4)
  })
})

/* ------------------------- shift frame selector (pure) ------------------------ */

const labelsBySlot = (f: ShiftFrame): (string | null)[] =>
  Array.from({ length: f.columns }, (_, i) => f.cells.find((c) => c.slot === i)?.label ?? null)
const movingId = (f: ShiftFrame): string | null =>
  f.cells.find((c) => c.moving)?.id ?? null

describe("Arrays — shiftFrames (deterministic per-cell wave)", () => {
  it("inserts by rippling from the end, then placing the new cell", () => {
    const frames = shiftFrames(["A", "B", "C", "D"], { kind: "insert", index: 2, inserted: "X" })

    // rest + (4 - 2) shifts + 1 placement = 4 frames, all over 5 address slots.
    expect(frames).toHaveLength(4)
    expect(frames.every((f) => f.columns === 5)).toBe(true)

    expect(movingId(frames[0])).toBeNull() // the rest frame moves nothing
    expect(movingId(frames[1])).toBe("c3") // D slides right first
    expect(movingId(frames[2])).toBe("c2") // then C
    expect(movingId(frames[3])).toBe("ins") // finally X drops in

    // mid-wave there is a real gap where the next cell will land.
    expect(labelsBySlot(frames[1])).toEqual(["A", "B", "C", null, "D"])
    // the final frame is the end-state: splice(["A","B","C","D"], 2, 0, "X").
    expect(labelsBySlot(frames[3])).toEqual(["A", "B", "X", "C", "D"])
  })

  it("deletes by dropping the cell, then rippling the tail left to close the gap", () => {
    const frames = shiftFrames(["A", "B", "C", "D", "E"], { kind: "delete", index: 1 })

    // rest + removal + (5 - 1 - 1) shifts = 5 frames, over the original 5 slots.
    expect(frames).toHaveLength(5)
    expect(frames.every((f) => f.columns === 5)).toBe(true)

    // the removal frame has the deleted cell gone and a gap at its index.
    expect(frames[1].cells.some((c) => c.label === "B")).toBe(false)
    expect(labelsBySlot(frames[1])).toEqual(["A", null, "C", "D", "E"])

    expect(movingId(frames[2])).toBe("c2") // C slides left
    expect(movingId(frames[3])).toBe("c3") // then D
    expect(movingId(frames[4])).toBe("c4") // then E

    // the end-state: splice(["A","B","C","D","E"], 1, 1) = A,C,D,E (slot 4 freed).
    expect(labelsBySlot(frames[4])).toEqual(["A", "C", "D", "E", null])
  })

  it("is a pure function: identical args yield identical frames", () => {
    const op = { kind: "insert" as const, index: 1, inserted: "X" }
    expect(shiftFrames(["A", "B", "C"], op)).toEqual(shiftFrames(["A", "B", "C"], op))
  })
})

/* ------------------------ resize frame selector (pure) ----------------------- */

describe("Arrays — resizeFrames (deterministic doubling)", () => {
  it("doubles the block and copies every item over when full", () => {
    const frames = resizeFrames({ size: 4, capacity: 4, resizes: true })

    // full + allocate + (4 copies) + place = size + 3 frames.
    expect(frames).toHaveLength(7)
    expect(frames[0]).toMatchObject({ phase: "full", capacity: 4, filled: 4 })
    expect(frames[1]).toMatchObject({ phase: "allocate", capacity: 8, filled: 0 })

    const copies = frames.filter((f) => f.phase === "copy")
    expect(copies).toHaveLength(4)
    expect(copies.map((f) => f.copying)).toEqual([0, 1, 2, 3])

    const last = frames[frames.length - 1]
    expect(last).toMatchObject({ phase: "place", capacity: 8, filled: 5 })
  })

  it("just drops the item in when there is room (no reshuffle)", () => {
    const frames = resizeFrames({ size: 2, capacity: 4, resizes: false })
    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({ phase: "settled", capacity: 4, filled: 2 })
    expect(frames[1]).toMatchObject({ phase: "place", capacity: 4, filled: 3 })
    expect(frames.some((f) => f.phase === "copy")).toBe(false)
  })
})

/* --------------------- resize cost chip = the house word --------------------- */

/** Re-roll the resize instance deterministically until it lands on a given verdict. */
function atResizeAnswer(answer: "yes" | "no"): ArraysState {
  let s = resumeArrays(
    { counters: { shiftPredict: 3, costCount: 3 }, currentPart: "resize", completed: false },
    SEED,
  )
  for (let guard = 0; s.question!.answer !== answer; guard++) {
    if (guard > 64) throw new Error(`no '${answer}' resize instance found`)
    s = arraysReducer(s, { type: "reattempt" })
  }
  return s
}

describe("Arrays — resize cost chip uses the locked house word", () => {
  it("a triggered resize (doubling) reads 'usually free', never 'scales'", () => {
    const s = atResizeAnswer("yes")
    expect(s.question!.cost.word).toBe("usually free")
    expect(s.question!.cost.word).not.toBe("scales")
    expect(s.question!.cost.unit).toBe("items copied")
  })

  it("keeps the longer gloss in why-copy only (never on the chip word)", () => {
    const s = atResizeAnswer("yes")
    expect(s.question!.why).toMatch(/usually free, with the occasional big reshuffle/i)
    // the chip is the bare enum value, not the gloss sentence.
    expect(s.question!.cost.word).toBe("usually free")
  })

  it("a no-resize insert stays 'free' (room to spare)", () => {
    const s = atResizeAnswer("no")
    expect(s.question!.cost.word).toBe("free")
  })
})
