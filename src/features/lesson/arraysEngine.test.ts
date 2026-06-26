import { describe, it, expect } from "vitest"

import {
  ARRAYS_GATE,
  ARRAYS_TOTAL_PARTS,
  arraysReducer,
  createArrays,
  currentPartArrays,
  gapTargetsArrays,
  gradedCleared,
  hasProgressArrays,
  isCompleteArrays,
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
 * Behavior-focused tests for the rebuilt Arrays engine (the "predict, then act,
 * then see" redesign). Everything is driven through dispatched actions and
 * asserted via external behavior (verdict, counters, combo, completion) under a
 * FIXED seed for determinism. Arrays reuses the shared feedback machine + flame.
 */
const SEED = 7

function apply(state: ArraysState, ...actions: LessonAction[]): ArraysState {
  return actions.reduce(arraysReducer, state)
}

const at = (part: string): ArraysState =>
  resumeArrays({ counters: {}, currentPart: part, completed: false }, SEED)

/** Solve whatever the current beat is, correctly. */
function solve(s: ArraysState): ArraysState {
  const part = currentPartArrays(s)
  const q = s.question!
  if (part === "place-cheapest") {
    return apply(s, { type: "rewire", from: "X", to: q.answer! }, { type: "check" })
  }
  if (q.options == null && q.answerIndex != null) {
    return apply(s, { type: "select", letter: String(q.answerIndex) }, { type: "check" })
  }
  return apply(s, { type: "select", letter: q.answer! }, { type: "check" })
}

/** Drive the whole lesson, every beat correct. */
function happyPath(seed = SEED): ArraysState {
  let s = createArrays(seed)
  s = apply(s, { type: "continue" }) // play-access -> jump
  s = apply(solve(s), { type: "next" }) // jump -> scan
  s = apply(solve(s), { type: "next" }) // scan -> play-mutate
  s = apply(s, { type: "continue" }) // play-mutate -> insert
  s = apply(solve(s), { type: "next" }) // insert -> delete
  s = apply(solve(s), { type: "next" }) // delete -> place-cheapest
  s = apply(solve(s), { type: "next" }) // place-cheapest -> realworld
  s = apply(solve(s), { type: "next" }) // realworld -> teach-grow (intro)
  s = apply(s, { type: "continue" }) // teach-grow -> grow step 0
  s = apply(solve(s), { type: "next" }) // grow step 0 -> grow step 1
  s = apply(solve(s), { type: "next" }) // grow step 1 -> completed
  return s
}

const growStep1 = (): ArraysState => apply(solve(at("grow")), { type: "next" })

describe("Arrays — flow (10 beats, intro vs graded)", () => {
  it("starts on the access playground and steps to the first graded beat", () => {
    const s = createArrays(SEED)
    expect(currentPartArrays(s)).toBe("play-access")
    expect(ARRAYS_TOTAL_PARTS).toBe(10)
    expect(ARRAYS_GATE).toBe(8)
    expect(currentPartArrays(apply(s, { type: "continue" }))).toBe("jump")
  })

  it("teaches dynamic-array context (an intro beat) right before the grow problem", () => {
    const teach = at("teach-grow")
    expect(partQuotaArrays(teach)).toBeNull() // intro, not graded
    expect(currentPartArrays(apply(teach, { type: "continue" }))).toBe("grow")
  })

  it("a graded beat ignores continue (advances via next, not continue)", () => {
    const s = at("jump")
    expect(apply(s, { type: "continue" })).toBe(s)
  })

  it("shows n/8 only on graded beats", () => {
    expect(partQuotaArrays(createArrays(SEED))).toBeNull() // play-access
    expect(partQuotaArrays(at("jump"))).toEqual({ done: 0, total: 8 })
    expect(partQuotaArrays(at("play-mutate"))).toBeNull()
  })
})

describe("Arrays — jump (de-cued access, 0-indexed)", () => {
  it("clears accessIndex when the tapped cell index matches the ask", () => {
    const s = at("jump")
    expect(s.question!.answerIndex).toBeGreaterThanOrEqual(0)
    const done = solve(s)
    expect(done.feedback).toBe("correct")
    expect(done.accessIndex).toBe(1)
    expect(done.combo).toBe(1)
  })

  it("a wrong tap nudges then fails; accessIndex stays 0", () => {
    const s = at("jump")
    const wrong = String((s.question!.answerIndex! + 1) % s.question!.cells.length)
    let t = apply(s, { type: "select", letter: wrong }, { type: "check" })
    expect(t.feedback).toBe("nudge")
    t = apply(t, { type: "select", letter: wrong }, { type: "check" })
    expect(t.feedback).toBe("fail")
    expect(t.accessIndex).toBe(0)
    expect(t.combo).toBe(0)
  })
})

describe("Arrays — scan (value search walks the row)", () => {
  it("the searched value is unique and resolves to its first index", () => {
    const q = at("scan").question!
    const v = q.value!
    expect(q.cells.indexOf(v)).toBe(q.answerIndex)
    expect(q.cells.filter((c) => c === v)).toHaveLength(1)
  })

  it("the scan cost scales with the search distance (steps = index + 1)", () => {
    const q = at("scan").question!
    expect(q.cost.word).toBe("scales")
    expect(q.cost.count).toBe(q.answerIndex! + 1)
  })

  it("committing the matching cell clears accessScan", () => {
    expect(solve(at("scan")).accessScan).toBe(1)
  })
})

describe("Arrays — insert (predict the shift count)", () => {
  it("the answer is the moved count n - k; correct clears insertCount", () => {
    const s = at("insert")
    const q = s.question!
    const op = q.op!
    expect(op.kind).toBe("insert")
    const moved = q.cells.length - op.index
    expect(q.answer).toBe(`n${moved}`)
    expect(q.cost.count).toBe(moved)
    expect(q.cost.word).toBe("scales")
    expect(solve(s).insertCount).toBe(1)
  })
})

describe("Arrays — delete (predict the shift count)", () => {
  it("the answer is the moved count n - 1 - k; correct clears deleteCount", () => {
    const s = at("delete")
    const q = s.question!
    const op = q.op!
    expect(op.kind).toBe("delete")
    const moved = q.cells.length - 1 - op.index
    expect(q.answer).toBe(`n${moved}`)
    expect(q.cost.count).toBe(moved)
    expect(solve(s).deleteCount).toBe(1)
  })
})

describe("Arrays — place-cheapest (meaningful gap drag)", () => {
  it("exposes a drop target at every gap while building; the end is cheapest", () => {
    const s = at("place-cheapest")
    const n = s.question!.cells.length
    const gaps = gapTargetsArrays(s)
    expect(gaps.size).toBe(n + 1) // gaps 0..n
    expect(gaps.has(`gap-${n}`)).toBe(true)
    expect(s.question!.answer).toBe(`gap-${n}`) // the end (zero ripple)
    expect(s.question!.cost.word).toBe("free")
  })

  it("dropping the cell at the end clears placeCheapest; a middle drop fails", () => {
    const s = at("place-cheapest")
    expect(solve(s).placeCheapest).toBe(1)

    let t = apply(s, { type: "rewire", from: "X", to: "gap-1" }, { type: "check" })
    expect(t.feedback).toBe("nudge")
    expect(t.placeCheapest).toBe(0)
  })

  it("no gap targets once the beat is terminal", () => {
    const done = solve(at("place-cheapest"))
    expect(gapTargetsArrays(done).size).toBe(0)
  })
})

describe("Arrays — realworld (spreadsheet shift count)", () => {
  it("the answer is the moved-row count; correct clears realworld", () => {
    const s = at("realworld")
    const q = s.question!
    const op = q.op!
    const moved = op.kind === "insert" ? q.cells.length - op.index : q.cells.length - 1 - op.index
    expect(q.answer).toBe(`n${moved}`)
    expect(solve(s).realworld).toBe(1)
  })
})

describe("Arrays — grow synthesis (two graded checks)", () => {
  it("step 0 grows+copies a full block; clears grow", () => {
    const s = at("grow")
    expect(s.question!.answer).toBe("grow")
    expect(s.question!.resize).toMatchObject({ resizes: true })
    expect(s.question!.resize!.size).toBe(s.question!.resize!.capacity) // full
    expect(solve(s).grow).toBe(1)
  })

  it("step 1 verdict is 'expensive' (it copied everything); clears growVerdict", () => {
    const s = growStep1()
    expect(s.step).toBe(1)
    expect(s.question!.answer).toBe("expensive")
    expect(solve(s).growVerdict).toBe(1)
  })

  it("the grow chip uses the locked house word, gloss in why only", () => {
    const q = at("grow").question!
    expect(q.cost.word).toBe("usually free")
    expect(q.cost.word).not.toBe("scales")
    expect(q.why).toMatch(/usually free, with the occasional big reshuffle/i)
  })
})

describe("Arrays — gate, flame, completion", () => {
  it("completes only after all 8 graded beats; combo spans every correct check", () => {
    const s = happyPath()
    expect(gradedCleared(s)).toBe(8)
    expect(isCompleteArrays(s)).toBe(true)
    expect(s.completed).toBe(true)
    expect(s.combo).toBe(8) // jump, scan, insert, delete, place, realworld, grow x2
  })

  it("a full fail breaks the combo; revealed/failed never count", () => {
    const s = at("insert")
    const wrong = s.question!.options!.find((o) => o.id !== s.question!.answer)!.id
    const failed = apply(
      s,
      { type: "select", letter: wrong },
      { type: "check" },
      { type: "select", letter: wrong },
      { type: "check" },
    )
    expect(failed.feedback).toBe("fail")
    expect(failed.insertCount).toBe(0)
    const revealed = apply(failed, { type: "reveal" })
    expect(revealed.showWhy).toBe(true)
    expect(revealed.insertCount).toBe(0)
  })
})

describe("Arrays — resume / progress", () => {
  it("squashes to the 8-skill counters map (plus attempts)", () => {
    const p = toProgressArrays(happyPath())
    expect(p.counters).toEqual({
      accessIndex: 1,
      accessScan: 1,
      insertCount: 1,
      deleteCount: 1,
      placeCheapest: 1,
      realworld: 1,
      grow: 1,
      growVerdict: 1,
      attempts: 8,
    })
    expect(p.completed).toBe(true)
  })

  it("restores the persisted part + counts with a cold combo", () => {
    const s = resumeArrays(
      { counters: { accessIndex: 1, accessScan: 1 }, currentPart: "insert", completed: false },
      SEED,
    )
    expect(currentPartArrays(s)).toBe("insert")
    expect(s.accessIndex).toBe(1)
    expect(s.accessScan).toBe(1)
    expect(s.combo).toBe(0)
    expect(hasProgressArrays(s)).toBe(true)
  })

  it("migrates an old run: maps old counters, drops a5, unknown part restarts", () => {
    const migrated = resumeArrays(
      {
        counters: { a1: 1, a3: 1, a2: 1, a2Skin: 1, a4: 1, a5: 1, a6Grow: 1, a6Cheap: 1 },
        currentPart: "a6-grow",
        completed: false,
      },
      SEED,
    )
    expect(currentPartArrays(migrated)).toBe("play-access") // unknown part -> restart
    expect(migrated.accessIndex).toBe(1)
    expect(migrated.accessScan).toBe(1)
    expect(migrated.insertCount).toBe(1)
    expect(migrated.realworld).toBe(1)
    expect(migrated.placeCheapest).toBe(1)
    expect(migrated.grow).toBe(1)
    expect(migrated.growVerdict).toBe(1)
    expect(migrated.deleteCount).toBe(0) // new skill, re-earned
    expect(gradedCleared(migrated)).toBe(7)

    const done = resumeArrays({ counters: {}, currentPart: "resize", completed: true }, SEED)
    expect(done.completed).toBe(true) // a finished old run stays finished
  })
})

describe("Arrays — determinism", () => {
  it("same seed yields identical runs and questions", () => {
    expect(createArrays(SEED)).toEqual(createArrays(SEED))
    expect(at("insert").question).toEqual(at("insert").question)
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
    expect(frames).toHaveLength(2)
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
