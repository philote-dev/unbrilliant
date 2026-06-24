import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  BIN_QUOTA,
  GATE_TOTAL,
  HEAPS_PARTS,
  HEAPS_TOTAL_PARTS,
  applySwaps,
  createHeaps,
  currentPartHeaps,
  extractIntroFrame,
  hasDistinctKeys,
  heapId,
  heapsReducer,
  isCompleteHeaps,
  isIntroPart,
  isMaxHeap,
  largerChildIndex,
  leftIndex,
  mappingAnswer,
  parentIndex,
  partQuotaHeaps,
  resumeHeaps,
  rightIndex,
  siftDownExtract,
  siftDownSmallerChild,
  siftUp,
  slotId,
  toProgressHeaps,
  type HeapsPart,
  type HeapsState,
} from "@/features/lesson/heapsEngine"

const SEED = 12345

function run(state: HeapsState, ...actions: LessonAction[]): HeapsState {
  return actions.reduce(heapsReducer, state)
}

const cont = (s: HeapsState) => run(s, { type: "continue" })

/** Pick an option/slot id, then Check. */
function pick(state: HeapsState, id: string): HeapsState {
  return run(state, { type: "select", letter: id }, { type: "check" })
}

/** Clear the current graded beat correctly and advance. */
function clearBeat(state: HeapsState): HeapsState {
  const q = state.question!
  const r = pick(state, q.answer)
  expect(r.feedback).toBe("correct")
  return run(r, { type: "next" })
}

/** Walk to a given part on the happy path. */
function atPart(target: HeapsPart, seed = SEED): HeapsState {
  let s = createHeaps(seed)
  let guard = 0
  while (currentPartHeaps(s) !== target && guard++ < 50) {
    s = isIntroPart(currentPartHeaps(s)) ? cont(s) : clearBeat(s)
  }
  return s
}

/** Play the whole lesson on the happy path to completion. */
function playToEnd(seed = SEED): HeapsState {
  let s = createHeaps(seed)
  let guard = 0
  while (!s.completed && guard++ < 50) {
    s = isIntroPart(currentPartHeaps(s)) ? cont(s) : clearBeat(s)
  }
  return s
}

describe("heap helpers (pure)", () => {
  it("index arithmetic: children 2i+1 / 2i+2, parent (i-1)/2", () => {
    expect(leftIndex(0)).toBe(1)
    expect(rightIndex(0)).toBe(2)
    expect(leftIndex(1)).toBe(3)
    expect(rightIndex(1)).toBe(4)
    expect(parentIndex(1)).toBe(0)
    expect(parentIndex(2)).toBe(0)
    expect(parentIndex(4)).toBe(1)
    expect(parentIndex(0)).toBe(-1) // root has no parent; (0-1)>>1 = -1
  })

  it("largerChildIndex picks the bigger child, or -1 for a leaf", () => {
    const heap = [9, 7, 6, 3, 2]
    expect(largerChildIndex(heap, 0)).toBe(1) // 7 > 6
    expect(largerChildIndex(heap, 1)).toBe(3) // only a left child (3)
    expect(largerChildIndex(heap, 2)).toBe(-1) // leaf
  })

  it("siftUp appends then swaps up the parent chain (unique path, distinct keys)", () => {
    const { result, path, start } = siftUp([7, 5, 6, 3, 2], 8)
    expect(start).toEqual([7, 5, 6, 3, 2, 8])
    expect(result).toEqual([8, 5, 7, 3, 2, 6])
    expect(path).toEqual([
      { a: 5, b: 2 },
      { a: 2, b: 0 },
    ])
    expect(isMaxHeap(result)).toBe(true)
    expect(hasDistinctKeys(result)).toBe(true)
  })

  it("siftDownExtract moves last→root, sinks via the larger child (extracted == heap[0])", () => {
    const { extracted, result, path, start } = siftDownExtract([9, 7, 6, 3, 2])
    expect(extracted).toBe(9)
    expect(start).toEqual([2, 7, 6, 3]) // last (2) lifted to the root, last slot dropped
    expect(result).toEqual([7, 3, 6, 2])
    expect(path).toEqual([
      { a: 0, b: 1 },
      { a: 1, b: 3 },
    ])
    expect(isMaxHeap(result)).toBe(true)
    expect(hasDistinctKeys(result)).toBe(true)
  })

  it("siftDownSmallerChild is the wrong-direction twin (different from the correct sift)", () => {
    const correct = siftDownExtract([9, 7, 6, 3, 2]).result
    const wrong = siftDownSmallerChild([9, 7, 6, 3, 2]).result
    expect(wrong).toEqual([6, 7, 2, 3])
    expect(wrong).not.toEqual(correct)
  })

  it("mappingAnswer resolves child/parent by arithmetic", () => {
    const heap = [9, 7, 6, 3, 2]
    expect(mappingAnswer(heap, 0, "largerChild")).toBe(1)
    expect(mappingAnswer(heap, 4, "parent")).toBe(1)
  })

  it("applySwaps replays the first k swaps", () => {
    const start = [7, 5, 6, 3, 2, 8]
    const path = [
      { a: 5, b: 2 },
      { a: 2, b: 0 },
    ]
    expect(applySwaps(start, path, 0)).toEqual([7, 5, 6, 3, 2, 8])
    expect(applySwaps(start, path, 1)).toEqual([7, 5, 8, 3, 2, 6])
    expect(applySwaps(start, path, 2)).toEqual([8, 5, 7, 3, 2, 6])
  })

  it("extractIntroFrame marks the top leaving (0) and the last item filling it (n-1)", () => {
    expect(extractIntroFrame([9, 7, 6, 3, 2])).toEqual({
      heap: [9, 7, 6, 3, 2],
      leavingSlot: 0,
      fillerSlot: 4,
    })
  })

  it("extractIntroFrame returns a copy of the heap (no aliasing the input)", () => {
    const input = [9, 7, 6, 3, 2]
    const frame = extractIntroFrame(input)
    expect(frame.heap).toEqual(input)
    expect(frame.heap).not.toBe(input)
  })
})

describe("flow + structure", () => {
  it("starts at the demo and has 12 parts (gate of 8)", () => {
    const s = createHeaps(SEED)
    expect(currentPartHeaps(s)).toBe<HeapsPart>("demo")
    expect(HEAPS_TOTAL_PARTS).toBe(12)
    expect(GATE_TOTAL).toBe(8)
  })

  it("continue only advances on intro/teach beats", () => {
    let s = createHeaps(SEED)
    s = cont(s)
    expect(currentPartHeaps(s)).toBe<HeapsPart>("teach-array")
    s = cont(s)
    expect(currentPartHeaps(s)).toBe<HeapsPart>("teach-rule")
    s = cont(s)
    expect(currentPartHeaps(s)).toBe<HeapsPart>("siftup-1")
    // continue is a no-op on a graded arrangement beat
    expect(currentPartHeaps(cont(s))).toBe<HeapsPart>("siftup-1")
  })

  it("every generated heap is a complete max-heap with distinct keys (single pinned op)", () => {
    for (const part of HEAPS_PARTS) {
      const s = atPart(part)
      const q = s.question!
      expect(hasDistinctKeys(q.heap), `${part} given heap distinct`).toBe(true)
      expect(isMaxHeap(q.heap), `${part} given heap is a max-heap`).toBe(true)
      if (q.path.length > 0) {
        expect(isMaxHeap(q.resultHeap), `${part} result is a max-heap`).toBe(true)
        expect(hasDistinctKeys(q.resultHeap), `${part} result distinct`).toBe(true)
      }
    }
  })
})

describe("siftUp bin (predict-next-state, de-cued)", () => {
  it("beat 4 grades the curated insert and climbs the combo", () => {
    const s = atPart("siftup-1")
    const q = s.question!
    expect(q.bin).toBe("siftUp")
    expect(q.answer).toBe("8,5,7,3,2,6")
    expect(q.path.length).toBe(2)
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.siftUpCorrect).toBe(1)
    expect(ok.combo).toBe(1)
  })

  it("offers four distinct arrangements; exactly one is the valid max-heap answer", () => {
    const q = atPart("siftup-1").question!
    const ids = q.options.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length) // de-duped
    expect(ids.length).toBe(4)
    const winners = q.options.filter((o) => o.id === q.answer)
    expect(winners.length).toBe(1)
    // Every non-answer option is a genuinely different (wrong) arrangement.
    for (const o of q.options) {
      if (o.id === q.answer) continue
      expect(o.heap).not.toEqual(q.options.find((x) => x.id === q.answer)!.heap)
    }
  })

  it("a wrong arrangement nudges, then fails at the wrong-limit (counter untouched)", () => {
    const s = atPart("siftup-1")
    const wrongId = s.question!.options.find((o) => o.id !== s.question!.answer)!.id
    const nudged = pick(s, wrongId)
    expect(nudged.feedback).toBe("nudge")
    expect(nudged.siftUpCorrect).toBe(0)
    const failed = pick(nudged, wrongId)
    expect(failed.feedback).toBe("fail")
    expect(failed.combo).toBe(0)
    expect(failed.siftUpCorrect).toBe(0)
  })

  it("beat 5 is the leaderboard skin (sift-up), same predict mechanic", () => {
    const s = atPart("siftup-skin")
    expect(s.question!.leaderboard).toBe(true)
    expect(s.question!.bin).toBe("siftUp")
    const ok = pick(s, s.question!.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.siftUpCorrect).toBe(2)
  })

  it("siftup-skin (ER triage skin) still grades on the engine's answer id", () => {
    // The skin only re-dresses the figure; the verdict id must be untouched so the
    // e2e tracer's data-answer pick keeps grading the same winning arrangement.
    const s = atPart("siftup-skin")
    const q = s.question!
    expect(q.bin).toBe("siftUp")
    expect(q.leaderboard).toBe(true)
    expect(q.answer).toBe(heapId(q.resultHeap)) // the post-sift arrangement id
    const wrongId = q.options.find((o) => o.id !== q.answer)!.id
    expect(pick(s, wrongId).feedback).toBe("nudge") // skin never alters the verdict
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.siftUpCorrect).toBe(2)
  })

  it("is deterministic — same seed yields the same option order", () => {
    const a = atPart("siftup-1", SEED).question!.options.map((o) => o.id)
    const b = atPart("siftup-1", SEED).question!.options.map((o) => o.id)
    expect(a).toEqual(b)
  })
})

describe("siftDown bin (extract-top, larger child first)", () => {
  it("beat 7 extracts the top and sifts down (extracted == heap[0])", () => {
    const s = atPart("siftdown-1")
    const q = s.question!
    expect(q.extracted).toBe(q.heap[0])
    expect(q.answer).toBe("7,3,6,2")
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.siftDownCorrect).toBe(1)
  })

  it("the smaller-child-first / stop-early / sorted distractors are all wrong", () => {
    const s = atPart("siftdown-1")
    const q = s.question!
    for (const o of q.options) {
      if (o.id === q.answer) continue
      const r = pick(s, o.id)
      expect(r.feedback).toBe("nudge")
      expect(r.siftDownCorrect).toBe(0)
    }
  })

  it("beat 8 is deeper — the sift travels at least two levels", () => {
    const s = atPart("siftdown-2")
    const q = s.question!
    expect(q.path.length).toBeGreaterThanOrEqual(2)
    const deepest = Math.max(...q.path.flatMap((p) => [p.a, p.b]))
    expect(deepest).toBeGreaterThanOrEqual(3) // index 3 sits at depth 2
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.siftDownCorrect).toBe(2)
  })
})

describe("mapping bin (index-map locate, tap a slot)", () => {
  it("beat 9: larger child of slot 0 is slot 1", () => {
    const s = atPart("map-child")
    const q = s.question!
    expect(q.mode).toBe("slot")
    expect(q.subjectSlot).toBe(0)
    expect(q.answer).toBe(slotId(1))
    expect(q.correctSlot).toBe(1)
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.mappingCorrect).toBe(1)
  })

  it("beat 10: parent of slot 4 is slot 1 (reverse)", () => {
    const s = atPart("map-parent")
    const q = s.question!
    expect(q.dir).toBe("parent")
    expect(q.answer).toBe(slotId(1))
    const wrong = pick(s, slotId(0)) // grandparent-ish off-by-one
    expect(wrong.feedback).toBe("nudge")
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.mappingCorrect).toBe(2)
  })
})

describe("contrast bin (heap-vs-BST + same-data)", () => {
  it("11a: the heap arrangement differs from the sorted/BST distractor", () => {
    const s = atPart("contrast-place")
    const q = s.question!
    expect(q.bin).toBe("contrast")
    const sorted = [...q.heap, q.insertKey!].slice().sort((a, b) => b - a)
    expect(q.resultHeap).not.toEqual(sorted) // a heap is not sorted by value
    expect(q.options.some((o) => o.id === sorted.join(","))).toBe(true) // foil is on offer
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.contrastCorrect).toBe(1)
  })

  it("11b: same data lives at the same index (tap cell i)", () => {
    const s = atPart("contrast-samedata")
    const q = s.question!
    expect(q.mode).toBe("slot")
    expect(q.treeSlot).toBe(q.slotIndex)
    expect(q.answer).toBe(slotId(q.slotIndex!))
    const ok = pick(s, q.answer)
    expect(ok.feedback).toBe("correct")
    expect(ok.contrastCorrect).toBe(2)
  })
})

describe("gate, completion, determinism, persistence", () => {
  it("partQuota is cumulative n of 8 (null on intro/teach)", () => {
    expect(partQuotaHeaps(createHeaps(SEED))).toBeNull() // demo
    const atBeat4 = atPart("siftup-1")
    expect(partQuotaHeaps(atBeat4)).toEqual({ done: 0, total: 8 })
    const afterBeat4 = clearBeat(atBeat4) // → siftup-skin
    expect(partQuotaHeaps(afterBeat4)).toEqual({ done: 1, total: 8 })
  })

  it("clears all 12 beats to a 2/2/2/2 gate with combo 8", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteHeaps(s)).toBe(true)
    expect(s.siftUpCorrect).toBe(BIN_QUOTA)
    expect(s.siftDownCorrect).toBe(BIN_QUOTA)
    expect(s.mappingCorrect).toBe(BIN_QUOTA)
    expect(s.contrastCorrect).toBe(BIN_QUOTA)
    expect(s.combo).toBe(8) // eight consecutive correct, flame never broke
  })

  it("the gate flips only at 2/2/2/2 — three full bins is not enough", () => {
    const partial: HeapsState = {
      ...createHeaps(SEED),
      siftUpCorrect: 2,
      siftDownCorrect: 2,
      mappingCorrect: 2,
      contrastCorrect: 1,
    }
    expect(isCompleteHeaps(partial)).toBe(false)
  })

  it("round-trips progress and resumes on the same beat with a cold combo", () => {
    const s = clearBeat(atPart("siftup-1")) // beat 4 done → siftup-skin
    const progress = toProgressHeaps(s)
    expect(progress.counters.siftUp).toBe(1)
    expect(progress.currentPart).toBe<HeapsPart>("siftup-skin")

    const resumed = resumeHeaps(progress, SEED)
    expect(currentPartHeaps(resumed)).toBe<HeapsPart>("siftup-skin")
    expect(resumed.siftUpCorrect).toBe(1)
    expect(resumed.combo).toBe(0) // flame is transient — cold on resume
  })

  it("a completed run resumes as completed", () => {
    const done = toProgressHeaps(playToEnd())
    expect(done.completed).toBe(true)
    expect(resumeHeaps(done, SEED).completed).toBe(true)
  })
})
