import { describe, it, expect } from "vitest"

import {
  ARRAYS_TOTAL_PARTS,
  arraysReducer,
  constructReadyA,
  createArrays,
  currentPartArrays,
  gradedCleared,
  isCompleteArrays,
  legalTargetsArrays,
  partQuotaArrays,
  resizeFrames,
  resumeArrays,
  shiftFrames,
  toProgressArrays,
  type ArraysState,
  type ShiftFrame,
} from "./arraysEngine"
import type { LessonAction } from "./engine"

/**
 * Behavior-focused tests for the redesigned Arrays engine: everything is driven
 * through dispatched actions and asserted via external behavior (verdict,
 * counters, combo, completion) with a FIXED seed for determinism. Arrays reuses
 * the shared feedback machine + flame (gradeAnswer).
 */
const SEED = 7

function apply(state: ArraysState, ...actions: LessonAction[]): ArraysState {
  return actions.reduce(arraysReducer, state)
}

const at = (part: string): ArraysState =>
  resumeArrays({ counters: {}, currentPart: part, completed: false }, SEED)

/** Solve whatever the current beat is, correctly. */
function solve(s: ArraysState): ArraysState {
  const q = s.question!
  if (s.construct) {
    let t = s
    for (const id of q.correctOps!) t = arraysReducer(t, { type: "rewire", from: id, to: "end" })
    return arraysReducer(t, { type: "check" })
  }
  if (q.options == null && q.answerIndex != null) {
    return apply(s, { type: "select", letter: String(q.answerIndex) }, { type: "check" })
  }
  return apply(s, { type: "select", letter: q.answer! }, { type: "check" })
}

/** Drive the whole lesson, every beat correct. */
function happyPath(seed = SEED): ArraysState {
  let s = createArrays(seed)
  s = apply(s, { type: "continue" }, { type: "continue" }) // demo, teach-access -> a1
  s = apply(solve(s), { type: "next" }) // a1 -> a3 step0
  s = apply(solve(s), { type: "next" }) // a3 step0 -> a3 step1
  s = apply(solve(s), { type: "next" }) // a3 step1 -> shift-demo
  s = apply(s, { type: "continue" }, { type: "continue" }) // shift-demo, teach-shift -> a2
  s = apply(solve(s), { type: "next" }) // a2 -> a2-skin
  s = apply(solve(s), { type: "next" }) // a2-skin -> a4
  s = apply(solve(s), { type: "next" }) // a4 -> a5
  s = apply(solve(s), { type: "next" }) // a5 -> a6 step0
  s = apply(solve(s), { type: "next" }) // a6 step0 -> a6 step1
  s = apply(solve(s), { type: "next" }) // a6 step1 -> completed
  return s
}

const a3Step1 = (): ArraysState => apply(solve(at("a3-contrast")), { type: "next" })
const a6Step1 = (): ArraysState => apply(solve(at("a6-grow")), { type: "next" })

describe("Arrays — flow (11 beats, intro vs graded)", () => {
  it("starts on the demo and steps through the intro beats on continue", () => {
    const s = createArrays(SEED)
    expect(currentPartArrays(s)).toBe("demo")
    expect(ARRAYS_TOTAL_PARTS).toBe(11)
    const s1 = apply(s, { type: "continue" })
    expect(currentPartArrays(s1)).toBe("teach-access")
    const s2 = apply(s1, { type: "continue" })
    expect(currentPartArrays(s2)).toBe("a1-access")
  })

  it("a graded beat ignores continue (advances via next, not continue)", () => {
    const s = at("a1-access")
    expect(apply(s, { type: "continue" })).toBe(s)
  })

  it("shows n/8 only on graded beats", () => {
    expect(partQuotaArrays(createArrays(SEED))).toBeNull() // demo
    expect(partQuotaArrays(at("a1-access"))).toEqual({ done: 0, total: 8 })
  })
})

describe("Arrays — A1 access-predict (de-cued, 0-indexed)", () => {
  it("clears a1 when the tapped cell index matches the ask", () => {
    const s = at("a1-access")
    const q = s.question!
    expect(q.answerIndex).toBeGreaterThanOrEqual(0)
    const done = solve(s)
    expect(done.feedback).toBe("correct")
    expect(done.a1).toBe(1)
    expect(done.combo).toBe(1)
  })

  it("a wrong tap nudges then fails; a1 stays 0", () => {
    const s = at("a1-access")
    const wrong = String((s.question!.answerIndex! + 1) % s.question!.cells.length)
    let t = apply(s, { type: "select", letter: wrong }, { type: "check" })
    expect(t.feedback).toBe("nudge")
    t = apply(t, { type: "select", letter: wrong }, { type: "check" })
    expect(t.feedback).toBe("fail")
    expect(t.a1).toBe(0)
    expect(t.combo).toBe(0)
  })
})

describe("Arrays — A3 access-vs-search (one gate, two asks)", () => {
  it("step 0 is the index jump; step 1 is the value scan over the same row", () => {
    const s = at("a3-contrast")
    expect(s.step).toBe(0)
    expect(s.question!.ask).toBe("index")
    expect(s.question!.answerIndex).toBe(s.question!.k)

    const step1 = a3Step1()
    expect(step1.step).toBe(1)
    expect(step1.question!.ask).toBe("value")
    // same row carried across the two asks
    expect(step1.question!.cells).toEqual(s.question!.cells)
    // the searched value resolves to its first (and only) index
    const v = step1.question!.value!
    expect(step1.question!.cells.indexOf(v)).toBe(step1.question!.answerIndex)
    expect(step1.question!.cells.filter((c) => c === v)).toHaveLength(1) // unique
  })

  it("clears a3 only after the second ask (step 0 does not bump it)", () => {
    const afterStep0 = solve(at("a3-contrast"))
    expect(afterStep0.feedback).toBe("correct")
    expect(afterStep0.a3).toBe(0) // step 0 only unlocks step 1
    const afterStep1 = solve(a3Step1())
    expect(afterStep1.a3).toBe(1)
  })

  it("the scan cost scales with the search distance; the jump is free", () => {
    expect(at("a3-contrast").question!.cost.word).toBe("free")
    expect(a3Step1().question!.cost.word).toBe("scales")
  })
})

describe("Arrays — A2 shift-predict (resulting row) + A2 skin (count)", () => {
  it("A2: the winning option is the spliced row; correct clears a2", () => {
    const s = at("a2-shift")
    const q = s.question!
    const op = q.op!
    const expected =
      op.kind === "insert"
        ? [...q.cells.slice(0, op.index), "X", ...q.cells.slice(op.index)]
        : [...q.cells.slice(0, op.index), ...q.cells.slice(op.index + 1)]
    expect(q.answer).toBe(expected.join(" · "))
    const done = solve(s)
    expect(done.a2).toBe(1)
  })

  it("A2 skin: the answer is the moved-row count; correct clears a2Skin", () => {
    const s = at("a2-skin")
    const q = s.question!
    const op = q.op!
    const moved = op.kind === "insert" ? q.cells.length - op.index : q.cells.length - 1 - op.index
    expect(q.answer).toBe(`n${moved}`)
    expect(q.cost.count).toBe(moved)
    expect(solve(s).a2Skin).toBe(1)
  })
})

describe("Arrays — A4 classify-by-position (no tie, end cheapest)", () => {
  it("the answer is the end and the three costs are distinct", () => {
    const q = at("a4-classify").question!
    const { n, midK } = q.classify!
    const costs = [n, n - midK, 0] // front, middle, end
    expect(new Set(costs).size).toBe(3) // no tie
    expect(Math.min(...costs)).toBe(0)
    expect(q.answer).toBe("end")
    expect(solve(at("a4-classify")).a4).toBe(1)
  })
})

describe("Arrays — A5 construct-to-target (append order, drag)", () => {
  it("appends are pinned to the open end while loose cells remain", () => {
    const s = at("a5-construct")
    expect(legalTargetsArrays(s)).toEqual(new Set(["end"]))
    expect(constructReadyA(s)).toBe(false)
  })

  it("a correct append order clears a5; check is gated until all are placed", () => {
    const s = at("a5-construct")
    const ops = s.question!.correctOps!
    // check before placing everything is a no-op
    const partial = arraysReducer(s, { type: "rewire", from: ops[0], to: "end" })
    expect(arraysReducer(partial, { type: "check" })).toBe(partial)
    const done = solve(s)
    expect(constructReadyA(arraysReducer(s, { type: "rewire", from: ops[0], to: "end" }))).toBe(false)
    expect(done.feedback).toBe("correct")
    expect(done.a5).toBe(1)
  })

  it("a wrong order nudges and resets the bin, then fails on a second miss", () => {
    const s = at("a5-construct")
    const ops = s.question!.correctOps!
    if (ops.length < 2) throw new Error("A5 needs >= 2 loose cells to test order")
    const wrong = [...ops].reverse()
    let t = s
    for (const id of wrong) t = arraysReducer(t, { type: "rewire", from: id, to: "end" })
    t = arraysReducer(t, { type: "check" })
    expect(t.feedback).toBe("nudge")
    expect(t.construct!.placed).toHaveLength(0) // bin reset
    expect(t.construct!.loose).toHaveLength(ops.length)
    expect(t.a5).toBe(0)
    // miss again -> full fail
    for (const id of wrong) t = arraysReducer(t, { type: "rewire", from: id, to: "end" })
    t = arraysReducer(t, { type: "check" })
    expect(t.feedback).toBe("fail")
    expect(t.a5).toBe(0)
  })
})

describe("Arrays — A6 grow synthesis (two graded checks)", () => {
  it("step 0 grows+copies a full block; clears a6Grow", () => {
    const s = at("a6-grow")
    expect(s.question!.answer).toBe("grow")
    expect(s.question!.resize).toMatchObject({ resizes: true })
    expect(s.question!.resize!.size).toBe(s.question!.resize!.capacity) // full
    expect(solve(s).a6Grow).toBe(1)
  })

  it("step 1 verdict is 'expensive' (it copied everything); clears a6Cheap", () => {
    const s = a6Step1()
    expect(s.step).toBe(1)
    expect(s.question!.answer).toBe("expensive")
    expect(solve(s).a6Cheap).toBe(1)
  })

  it("the grow chip uses the locked house word, gloss in why only", () => {
    const q = at("a6-grow").question!
    expect(q.cost.word).toBe("usually free")
    expect(q.cost.word).not.toBe("scales")
    expect(q.why).toMatch(/usually free, with the occasional big reshuffle/i)
  })
})

describe("Arrays — gate, flame, completion", () => {
  it("completes only after all 8 graded beats, combo spans every correct check", () => {
    const s = happyPath()
    expect(gradedCleared(s)).toBe(8)
    expect(isCompleteArrays(s)).toBe(true)
    expect(s.completed).toBe(true)
    expect(s.combo).toBe(9) // a3 and a6 each contribute two correct checks
  })

  it("a full fail anywhere breaks the combo; revealed/failed never count", () => {
    const s = at("a2-shift")
    const wrong = s.question!.options!.find((o) => o.id !== s.question!.answer)!.id
    const failed = apply(
      s,
      { type: "select", letter: wrong },
      { type: "check" },
      { type: "select", letter: wrong },
      { type: "check" },
    )
    expect(failed.feedback).toBe("fail")
    expect(failed.a2).toBe(0)
    const revealed = apply(failed, { type: "reveal" })
    expect(revealed.showWhy).toBe(true)
    expect(revealed.a2).toBe(0)
  })
})

describe("Arrays — resume / progress", () => {
  it("squashes to the 8-skill counters map (plus attempts)", () => {
    const p = toProgressArrays(happyPath())
    expect(p.counters).toEqual({
      a1: 1,
      a3: 1,
      a2: 1,
      a2Skin: 1,
      a4: 1,
      a5: 1,
      a6Grow: 1,
      a6Cheap: 1,
      attempts: 9,
    })
    expect(p.completed).toBe(true)
  })

  it("restores the persisted part + counts with a cold combo", () => {
    const s = resumeArrays(
      { counters: { a1: 1, a3: 1 }, currentPart: "a2-shift", completed: false },
      SEED,
    )
    expect(currentPartArrays(s)).toBe("a2-shift")
    expect(s.a1).toBe(1)
    expect(s.a3).toBe(1)
    expect(s.combo).toBe(0)
    expect(s.completed).toBe(false)
  })

  it("migrates an old run cleanly: unknown part restarts, completion is preserved", () => {
    const inProgress = resumeArrays(
      { counters: { shiftPredict: 3, costCount: 3 }, currentPart: "shift", completed: false },
      SEED,
    )
    expect(currentPartArrays(inProgress)).toBe("demo") // unknown part -> restart
    expect(gradedCleared(inProgress)).toBe(0)
    const done = resumeArrays(
      { counters: { resizePredict: 2 }, currentPart: "resize", completed: true },
      SEED,
    )
    expect(done.completed).toBe(true) // a finished old run stays finished
  })
})

describe("Arrays — determinism", () => {
  it("same seed yields identical runs and questions", () => {
    expect(createArrays(SEED)).toEqual(createArrays(SEED))
    expect(at("a2-shift").question).toEqual(at("a2-shift").question)
    expect(happyPath(11)).toEqual(happyPath(11))
  })
})

/* ------------------------- shift frame selector (pure) ------------------------ */

const labelsBySlot = (f: ShiftFrame): (string | null)[] =>
  Array.from({ length: f.columns }, (_, i) => f.cells.find((c) => c.slot === i)?.label ?? null)
const movingId = (f: ShiftFrame): string | null => f.cells.find((c) => c.moving)?.id ?? null

describe("Arrays — shiftFrames (deterministic per-cell wave)", () => {
  it("inserts by rippling from the end, then placing the new cell", () => {
    const frames = shiftFrames(["A", "B", "C", "D"], { kind: "insert", index: 2, inserted: "X" })
    expect(frames).toHaveLength(4)
    expect(frames.every((f) => f.columns === 5)).toBe(true)
    expect(movingId(frames[0])).toBeNull()
    expect(movingId(frames[1])).toBe("c3")
    expect(movingId(frames[2])).toBe("c2")
    expect(movingId(frames[3])).toBe("ins")
    expect(labelsBySlot(frames[1])).toEqual(["A", "B", "C", null, "D"])
    expect(labelsBySlot(frames[3])).toEqual(["A", "B", "X", "C", "D"])
  })

  it("deletes by dropping the cell, then rippling the tail left", () => {
    const frames = shiftFrames(["A", "B", "C", "D", "E"], { kind: "delete", index: 1 })
    expect(frames).toHaveLength(5)
    expect(labelsBySlot(frames[1])).toEqual(["A", null, "C", "D", "E"])
    expect(labelsBySlot(frames[4])).toEqual(["A", "C", "D", "E", null])
  })

  it("end-insert ripples nothing (rest + placement only)", () => {
    const frames = shiftFrames(["A", "B", "C"], { kind: "insert", index: 3, inserted: "X" })
    expect(frames).toHaveLength(2) // no cell moves; just rest + drop-in
    expect(labelsBySlot(frames[1])).toEqual(["A", "B", "C", "X"])
  })

  it("is pure: identical args yield identical frames", () => {
    const op = { kind: "insert" as const, index: 1, inserted: "X" }
    expect(shiftFrames(["A", "B", "C"], op)).toEqual(shiftFrames(["A", "B", "C"], op))
  })
})

describe("Arrays — resizeFrames (deterministic doubling)", () => {
  it("doubles and copies every item when full", () => {
    const frames = resizeFrames({ size: 4, capacity: 4, resizes: true })
    expect(frames).toHaveLength(7)
    expect(frames[0]).toMatchObject({ phase: "full", capacity: 4, filled: 4 })
    expect(frames[1]).toMatchObject({ phase: "allocate", capacity: 8, filled: 0 })
    expect(frames.filter((f) => f.phase === "copy").map((f) => f.copying)).toEqual([0, 1, 2, 3])
    expect(frames[frames.length - 1]).toMatchObject({ phase: "place", capacity: 8, filled: 5 })
  })

  it("drops the item straight in when there is room", () => {
    const frames = resizeFrames({ size: 2, capacity: 4, resizes: false })
    expect(frames).toHaveLength(2)
    expect(frames.some((f) => f.phase === "copy")).toBe(false)
  })
})
