import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  BIN_QUOTA,
  BUILD_QUOTA,
  DEFAULT_HEAP_GEN,
  GATE_TOTAL,
  HEAPS_PARTS,
  HEAPS_TOTAL_PARTS,
  SIFTDOWN_QUOTA,
  SYNTHESIS_QUOTA,
  applyBuildSwap,
  applySiftSwap,
  applySwaps,
  applySynthesisSwap,
  buildBeatFromKeys,
  buildMotionFrames,
  createHeaps,
  currentPartHeaps,
  extractIntroFrame,
  generateExtractHeap,
  generateInsertHeap,
  hasDistinctKeys,
  heapsReducer,
  isBuildPart,
  isBuildSolved,
  isCompleteHeaps,
  isCorrectSwap,
  isIntroPart,
  isMaxHeap,
  isSiftPart,
  isSiftSolved,
  isSynthesisPart,
  isSynthesisSolved,
  largerChildIndex,
  leftIndex,
  mappingAnswer,
  nextSwap,
  nodeMotionFrames,
  parentIndex,
  partQuotaHeaps,
  resumeHeaps,
  rightIndex,
  siftBeatFromExtract,
  siftBeatFromInsert,
  siftBeatFromReTriage,
  siftDownExtract,
  siftDownSmallerChild,
  siftFrom,
  siftUp,
  slotId,
  smallerChildIndex,
  synthesisBeatFromSteps,
  synthesisFinalHeap,
  synthesisPhase,
  toProgressHeaps,
  type BuildBeat,
  type HeapsPart,
  type HeapsState,
  type NodeMotionFrame,
  type SynthesisBeat,
  type SynthesisStepSpec,
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

/** Perform every correct swap of a do-the-sift beat until the heap settles. */
function solveSift(state: HeapsState): HeapsState {
  let s = state
  let guard = 0
  while (s.sift && !isSiftSolved(s.sift) && guard++ < 24) {
    const sw = nextSwap(s.sift)!
    s = run(s, { type: "rewire", from: slotId(sw.a), to: slotId(sw.b) })
  }
  return s
}

/** Perform every correct swap of a build-a-heap beat until the whole sequence is placed. */
function solveBuild(state: HeapsState): HeapsState {
  let s = state
  let guard = 0
  while (s.build && !isBuildSolved(s.build) && s.build.sift && guard++ < 60) {
    const sw = nextSwap(s.build.sift)!
    s = run(s, { type: "rewire", from: slotId(sw.a), to: slotId(sw.b) })
  }
  return s
}

/** Perform every correct swap of the ER synthesis beat until every op is performed. */
function solveSynthesis(state: HeapsState): HeapsState {
  let s = state
  let guard = 0
  while (s.synthesis && !isSynthesisSolved(s.synthesis) && s.synthesis.sift && guard++ < 60) {
    const sw = nextSwap(s.synthesis.sift)!
    s = run(s, { type: "rewire", from: slotId(sw.a), to: slotId(sw.b) })
  }
  return s
}

/** Clear the current graded beat correctly and advance (do-the-sift, build, synthesis, or pick). */
function clearBeat(state: HeapsState): HeapsState {
  const part = currentPartHeaps(state)
  const r = isSiftPart(part)
    ? solveSift(state)
    : isBuildPart(part)
      ? solveBuild(state)
      : isSynthesisPart(part)
        ? solveSynthesis(state)
        : pick(state, state.question!.answer)
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
  it("starts at the demo and has 16 parts (gate of 11 with the bigger siftDown bin + synthesis)", () => {
    const s = createHeaps(SEED)
    expect(currentPartHeaps(s)).toBe<HeapsPart>("demo")
    expect(HEAPS_TOTAL_PARTS).toBe(16)
    expect(GATE_TOTAL).toBe(11)
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

describe("siftUp bin (do-the-sift, active, generated)", () => {
  /** Propose a swap of two slots (the do-the-sift gesture). */
  const swap = (s: HeapsState, a: number, b: number): HeapsState =>
    run(s, { type: "rewire", from: slotId(a), to: slotId(b) })

  it("opens a do-the-sift beat at the appended heap (no cards), forcing a real swap", () => {
    const s = atPart("siftup-1")
    const q = s.question!
    expect(q.bin).toBe("siftUp")
    expect(q.options).toHaveLength(0) // it is performed, not picked
    expect(s.sift).not.toBeNull()
    expect(s.sift!.heap).toEqual([...q.heap, q.insertKey]) // the key drops into the next open slot
    expect(s.sift!.step).toBe(0)
    expect(s.sift!.path.length).toBeGreaterThanOrEqual(1) // a non-trivial sift
    expect(nextSwap(s.sift!)).toEqual(s.sift!.path[0])
  })

  it("each correct swap travels one step; settling clears the beat and climbs the combo", () => {
    // The bigger rep is guaranteed multi-swap, so one swap advances without solving.
    const s = atPart("siftup-2")
    expect(s.sift!.path.length).toBeGreaterThanOrEqual(2)
    const first = nextSwap(s.sift!)!
    const one = swap(s, first.a, first.b)
    expect(one.sift!.step).toBe(1)
    expect(one.feedback).toBe("idle") // more swaps remain, not terminal
    expect(one.siftUpCorrect).toBe(s.siftUpCorrect) // unchanged until the sift settles

    const done = solveSift(one)
    expect(isSiftSolved(done.sift!)).toBe(true)
    expect(isMaxHeap(done.sift!.heap)).toBe(true)
    expect(done.feedback).toBe("correct")
    expect(done.siftUpCorrect).toBe(2) // siftup-1 (walk) + siftup-2
    expect(done.combo).toBeGreaterThan(0)
  })

  it("a wrong swap nudges with no state change (no fail wall, combo intact)", () => {
    const s = atPart("siftup-1")
    const before = s.sift!
    const next = nextSwap(before)!
    // Hold the mover, then tap a slot that is not its parent: not the next move.
    const wrongTarget = before.heap.findIndex((_, i) => i !== next.a && i !== next.b)
    const wrong = swap(s, next.a, wrongTarget)
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.sift).toBe(before) // same reference, nothing advanced
    expect(wrong.sift!.step).toBe(0)
    expect(wrong.siftUpCorrect).toBe(s.siftUpCorrect)
    expect(wrong.combo).toBe(0)
    // and a wrong swap never locks the beat: the correct swap still lands after it.
    expect(swap(wrong, next.a, next.b).sift!.step).toBe(1)
  })

  it("the swap is order-insensitive (tap either node first)", () => {
    const s = atPart("siftup-1")
    const next = nextSwap(s.sift!)!
    expect(swap(s, next.b, next.a).sift!.step).toBe(1) // reversed pair, same move
  })

  it("a stray Check or a swap after settling is a no-op", () => {
    const s = atPart("siftup-1")
    expect(run(s, { type: "check" })).toBe(s) // do-the-sift never grades on Check
    const done = solveSift(s)
    expect(done.siftUpCorrect).toBe(1)
    expect(swap(done, 0, 1).siftUpCorrect).toBe(1) // already cleared; no further change
  })

  it("siftup-2 is the bigger rep: a wider heap and a deeper climb than siftup-1", () => {
    const a = atPart("siftup-1")
    const b = atPart("siftup-2")
    expect(b.question!.heap.length).toBeGreaterThan(a.question!.heap.length)
    expect(b.sift!.path.length).toBeGreaterThanOrEqual(2)
    const done = solveSift(b)
    expect(done.feedback).toBe("correct")
    expect(done.siftUpCorrect).toBe(2) // siftup-1 (walk) + siftup-2
  })

  it("the siftUp bin is now exactly the two do-the-sift inserts (siftup-skin left it)", () => {
    // The ER skin was repurposed out of the siftUp bin, so the bin no longer carries
    // a third rep and the siftup-skin beat is no longer a sift-up pick.
    const siftUpParts = HEAPS_PARTS.filter((p) => atPart(p).question?.bin === "siftUp")
    expect(siftUpParts).toEqual<HeapsPart[]>(["siftup-1", "siftup-2"])
    expect(atPart("siftup-skin").question!.bin).not.toBe("siftUp")
  })

  it("is deterministic: same seed yields the same generated sift", () => {
    expect(atPart("siftup-1", SEED).sift!.heap).toEqual(atPart("siftup-1", SEED).sift!.heap)
    expect(atPart("siftup-2", SEED).sift!.heap).toEqual(atPart("siftup-2", SEED).sift!.heap)
  })
})

describe("ER extract skin (repurposed siftup-skin → do-the-sift discharge)", () => {
  const swap = (s: HeapsState, a: number, b: number): HeapsState =>
    run(s, { type: "rewire", from: slotId(a), to: slotId(b) })

  it("is a do-the-sift EXTRACT in the siftDown bin, not a sift-up pick", () => {
    const s = atPart("siftup-skin")
    const q = s.question!
    expect(q.bin).toBe("siftDown") // moved out of siftUp
    expect(q.insertKey).toBeNull() // it no longer admits / sifts up
    expect(q.extracted).toBe(q.heap[0]) // it discharges the most urgent (the root)
    expect(q.options).toHaveLength(0) // performed, not picked (no arrangement cards)
    expect(s.sift).not.toBeNull() // a live do-the-sift beat
    expect(s.sift!.heap[0]).toBe(q.heap[q.heap.length - 1]) // last leaf already fills the top
    expect(s.sift!.path.length).toBeGreaterThanOrEqual(1) // a real sink
  })

  it("performing the discharge sift clears the beat and bumps the siftDown bin", () => {
    const s = atPart("siftup-skin")
    // On the happy path the two plain extracts are already credited before the skin.
    expect(s.siftDownCorrect).toBe(2)
    const done = solveSift(s)
    expect(isMaxHeap(done.sift!.heap)).toBe(true)
    expect(done.feedback).toBe("correct")
    expect(done.siftDownCorrect).toBe(SIFTDOWN_QUOTA) // the skin completes the 3-rep siftDown bin
  })

  it("sinking via the smaller child is a wrong move (nudge, no advance)", () => {
    const s = atPart("siftup-skin")
    const root = s.sift!.heap
    const smaller = smallerChildIndex(root, 0)
    const larger = largerChildIndex(root, 0)
    expect(smaller).not.toBe(larger)
    const wrong = swap(s, 0, smaller) // the correct first move trades with the larger child
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.sift!.step).toBe(0)
    expect(wrong.siftDownCorrect).toBe(2) // untouched
  })
})

describe("siftDown bin (do-the-sift, extract then sink, generated)", () => {
  const swap = (s: HeapsState, a: number, b: number): HeapsState =>
    run(s, { type: "rewire", from: slotId(a), to: slotId(b) })

  it("opens post-handoff (last leaf already lifted to the root), forcing a sink", () => {
    const s = atPart("siftdown-1")
    const q = s.question!
    expect(q.extracted).toBe(q.heap[0])
    expect(s.sift!.heap[0]).toBe(q.heap[q.heap.length - 1]) // the last leaf fills the root
    expect(s.sift!.path.length).toBeGreaterThanOrEqual(1)
    const next = nextSwap(s.sift!)!
    expect(next.a).toBe(0) // the sink starts at the root
    expect(next.b).toBe(largerChildIndex(s.sift!.heap, 0)) // trade with the LARGER child first
  })

  it("sinking the root via the larger child clears the beat and bumps siftDown", () => {
    const s = atPart("siftdown-1")
    const done = solveSift(s)
    expect(isMaxHeap(done.sift!.heap)).toBe(true)
    expect(done.feedback).toBe("correct")
    expect(done.siftDownCorrect).toBe(1)
  })

  it("trading the smaller child is a wrong move (nudge, no advance)", () => {
    const s = atPart("siftdown-1")
    const root = s.sift!.heap
    const smaller = smallerChildIndex(root, 0)
    const larger = largerChildIndex(root, 0)
    expect(smaller).not.toBe(larger) // distinct keys, both root children present
    const wrong = swap(s, 0, smaller) // the correct first move trades with the larger child
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.sift!.step).toBe(0)
    expect(wrong.siftDownCorrect).toBe(0)
  })

  it("siftdown-2 is deeper: a wider heap whose sift travels at least two levels", () => {
    const s = atPart("siftdown-2")
    expect(s.question!.heap.length).toBeGreaterThan(atPart("siftdown-1").question!.heap.length)
    expect(s.sift!.path.length).toBeGreaterThanOrEqual(2)
    const deepest = Math.max(...s.sift!.path.flatMap((p) => [p.a, p.b]))
    expect(deepest).toBeGreaterThanOrEqual(3) // index 3 sits at depth 2
    const done = solveSift(s)
    expect(done.feedback).toBe("correct")
    expect(done.siftDownCorrect).toBe(2) // siftdown-1 already credited on the walk
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
  it("partQuota is cumulative n of 11 (null on intro/teach)", () => {
    expect(partQuotaHeaps(createHeaps(SEED))).toBeNull() // demo
    const atFirst = atPart("siftup-1")
    expect(partQuotaHeaps(atFirst)).toEqual({ done: 0, total: 11 })
    const afterFirst = clearBeat(atFirst) // → siftup-2
    expect(partQuotaHeaps(afterFirst)).toEqual({ done: 1, total: 11 })
  })

  it("clears all 16 beats to a 2/3/2/2/1/1 gate with combo 11", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteHeaps(s)).toBe(true)
    expect(s.siftUpCorrect).toBe(BIN_QUOTA)
    expect(s.siftDownCorrect).toBe(SIFTDOWN_QUOTA) // the bigger siftDown bin (3 reps)
    expect(s.mappingCorrect).toBe(BIN_QUOTA)
    expect(s.contrastCorrect).toBe(BIN_QUOTA)
    expect(s.buildCorrect).toBe(BUILD_QUOTA)
    expect(s.synthesisCorrect).toBe(SYNTHESIS_QUOTA)
    expect(s.combo).toBe(11) // eleven consecutive correct, flame never broke
  })

  it("the gate flips only at 2/3/2/2/1/1 (incl. the bigger siftDown bin and the synthesis bin)", () => {
    const allButSiftDown: HeapsState = {
      ...createHeaps(SEED),
      siftUpCorrect: 2,
      siftDownCorrect: 2, // one short of the siftDown quota of 3
      mappingCorrect: 2,
      contrastCorrect: 2,
      buildCorrect: 1,
      synthesisCorrect: 1,
    }
    expect(isCompleteHeaps(allButSiftDown)).toBe(false)

    const noSynthesis: HeapsState = { ...allButSiftDown, siftDownCorrect: 3, synthesisCorrect: 0 }
    expect(isCompleteHeaps(noSynthesis)).toBe(false)

    const noBuild: HeapsState = { ...allButSiftDown, siftDownCorrect: 3, buildCorrect: 0 }
    expect(isCompleteHeaps(noBuild)).toBe(false)

    // Only with the full 3-rep siftDown bin AND every other bin cleared does it flip.
    expect(isCompleteHeaps({ ...allButSiftDown, siftDownCorrect: 3 })).toBe(true)
  })

  it("keeps the durable LessonProgress shape; counters only gain a `synthesis` key (constraint A)", () => {
    // LessonModule/LessonProgress shape is unchanged: still { counters, currentPart,
    // completed }, and the counters map is the prior set plus the one new `synthesis`
    // key (the persisted counters-map pattern is preserved).
    const progress = toProgressHeaps(createHeaps(SEED))
    expect(Object.keys(progress).sort()).toEqual(["completed", "counters", "currentPart"])
    expect(Object.keys(progress.counters).sort()).toEqual([
      "attempts",
      "build",
      "contrast",
      "mapping",
      "siftDown",
      "siftUp",
      "synthesis",
    ])
  })

  it("round-trips progress and resumes on the same beat with a cold combo", () => {
    const s = clearBeat(atPart("siftup-1")) // first do-the-sift done → siftup-2
    const progress = toProgressHeaps(s)
    expect(progress.counters.siftUp).toBe(1)
    expect(progress.currentPart).toBe<HeapsPart>("siftup-2")

    const resumed = resumeHeaps(progress, SEED)
    expect(currentPartHeaps(resumed)).toBe<HeapsPart>("siftup-2")
    expect(resumed.siftUpCorrect).toBe(1)
    expect(resumed.combo).toBe(0) // flame is transient, cold on resume
  })

  it("a completed run resumes as completed", () => {
    const done = toProgressHeaps(playToEnd())
    expect(done.completed).toBe(true)
    expect(resumeHeaps(done, SEED).completed).toBe(true)
  })

  it("the siftDown bin carries the extra rep; the gate is 11 (constraint A)", () => {
    // siftUp / mapping / contrast keep their 2-each quota and build stays 1; the
    // siftDown bin grows (to 3, with the repurposed ER extract skin) and the new
    // synthesis bin adds 1, so the mastery gate is 2 + 3 + 2 + 2 + 1 + 1 = 11.
    expect(BIN_QUOTA).toBe(2)
    expect(SIFTDOWN_QUOTA).toBe(3)
    expect(BUILD_QUOTA).toBe(1)
    expect(SYNTHESIS_QUOTA).toBe(1)
    expect(GATE_TOTAL).toBe(11)
    const bins = HEAPS_PARTS.map((p) => atPart(p).question?.bin).filter(Boolean)
    expect(bins.filter((b) => b === "siftUp")).toHaveLength(2) // siftup-1, siftup-2
    expect(bins.filter((b) => b === "siftDown")).toHaveLength(3) // siftdown-1, siftdown-2, siftup-skin
    expect(bins.filter((b) => b === "mapping")).toHaveLength(2)
    expect(bins.filter((b) => b === "contrast")).toHaveLength(2)
    expect(bins.filter((b) => b === "build")).toHaveLength(1)
    expect(bins.filter((b) => b === "synthesis")).toHaveLength(1) // er-synthesis
  })

  it("resuming onto a do-the-sift beat rebuilds its sift state", () => {
    const resumed = resumeHeaps(
      { counters: { siftUp: 2 }, currentPart: "siftdown-1", completed: false },
      SEED,
    )
    expect(currentPartHeaps(resumed)).toBe<HeapsPart>("siftdown-1")
    expect(resumed.sift).not.toBeNull()
    expect(isSiftSolved(resumed.sift!)).toBe(false)
    // performing the sift from the resumed beat still grades + bumps the bin.
    const done = solveSift(resumed)
    expect(done.feedback).toBe("correct")
    expect(done.siftDownCorrect).toBe(1)
  })
})

/* ----------------------- A. per-node motion frames ----------------------- */

const slotOf = (f: NodeMotionFrame, v: number): number =>
  f.placements.find((p) => p.value === v)!.slot

describe("nodeMotionFrames (traveling-node animation data)", () => {
  it("sift-up: a setup frame, then one frame per swap, the inserted node travelling 5 -> 2 -> 0", () => {
    const frames = nodeMotionFrames({ kind: "insert", heap: [7, 5, 6, 3, 2], key: 8 })
    // setup frame + one frame per swap (the path has two swaps)
    expect(frames.length).toBe(3)
    // frame 0 is the appended, un-sifted arrangement; nothing is moving yet
    expect(frames[0].heap).toEqual([7, 5, 6, 3, 2, 8])
    expect(frames[0].movingPair).toBeNull()
    expect(frames[0].handoff).toBeNull()
    // the inserted 8 climbs the parent chain, slot by slot
    expect(slotOf(frames[0], 8)).toBe(5)
    expect(slotOf(frames[1], 8)).toBe(2)
    expect(slotOf(frames[2], 8)).toBe(0)
    // each non-setup frame marks the swap that produced it
    expect(frames[1].movingPair).toEqual({ a: 5, b: 2 })
    expect(frames[2].movingPair).toEqual({ a: 2, b: 0 })
    // the last frame is the settled max-heap
    expect(frames[2].heap).toEqual([8, 5, 7, 3, 2, 6])
    expect(isMaxHeap(frames[2].heap)).toBe(true)
  })

  it("placements are a complete value -> slot identity map for every frame", () => {
    const frames = nodeMotionFrames({ kind: "insert", heap: [7, 5, 6, 3, 2], key: 8 })
    for (const f of frames) {
      expect(f.placements.length).toBe(f.heap.length)
      for (const { value, slot } of f.placements) {
        expect(f.heap[slot]).toBe(value)
      }
    }
  })

  it("extract: setup, the intro hand-off (root leaves, last rises), then the sift-down swaps", () => {
    const frames = nodeMotionFrames({ kind: "extract", heap: [9, 7, 6, 3, 2] })
    // setup + intro hand-off + two sift-down swaps
    expect(frames.length).toBe(4)
    // frame 0: the full heap, nothing moving yet
    expect(frames[0].heap).toEqual([9, 7, 6, 3, 2])
    expect(frames[0].movingPair).toBeNull()
    expect(frames[0].handoff).toBeNull()
    // frame 1: the extract hand-off. 9 leaves, the last leaf (2) fills the root
    expect(frames[1].heap).toEqual([2, 7, 6, 3])
    expect(frames[1].movingPair).toBeNull()
    expect(frames[1].handoff).toEqual({ leaving: 9, filler: 2 })
    // the old root value is gone from the placements once it has left
    expect(frames[1].placements.some((p) => p.value === 9)).toBe(false)
    // the filler (2) then sinks via the larger child: slot 0 -> 1 -> 3
    expect(slotOf(frames[1], 2)).toBe(0)
    expect(slotOf(frames[2], 2)).toBe(1)
    expect(slotOf(frames[3], 2)).toBe(3)
    // the swaps that produced the sift-down frames are marked
    expect(frames[2].movingPair).toEqual({ a: 0, b: 1 })
    expect(frames[3].movingPair).toEqual({ a: 1, b: 3 })
    // settles at the correct extract result
    expect(frames[3].heap).toEqual([7, 3, 6, 2])
    expect(isMaxHeap(frames[3].heap)).toBe(true)
  })

  it("is a pure view over the SwapStep line (never mutates the input heap)", () => {
    const insertInput = [7, 5, 6, 3, 2]
    nodeMotionFrames({ kind: "insert", heap: insertInput, key: 8 })
    expect(insertInput).toEqual([7, 5, 6, 3, 2])
    const extractInput = [9, 7, 6, 3, 2]
    nodeMotionFrames({ kind: "extract", heap: extractInput })
    expect(extractInput).toEqual([9, 7, 6, 3, 2])
  })
})

/* ----------------------- B. do-the-sift validator ----------------------- */

describe("do-the-sift validator (active per-swap mechanic)", () => {
  it("siftBeatFromInsert opens at the appended arrangement with the full correct line", () => {
    const beat = siftBeatFromInsert([7, 5, 6, 3, 2], 8)
    expect(beat.heap).toEqual([7, 5, 6, 3, 2, 8])
    expect(beat.path).toEqual([
      { a: 5, b: 2 },
      { a: 2, b: 0 },
    ])
    expect(beat.step).toBe(0)
    expect(nextSwap(beat)).toEqual({ a: 5, b: 2 })
    expect(isSiftSolved(beat)).toBe(false)
  })

  it("a correct swap advances toward the settled heap (order-insensitive)", () => {
    const beat = siftBeatFromInsert([7, 5, 6, 3, 2], 8)
    // proposing the pair reversed (2,5 instead of 5,2) is still the correct move
    const first = applySiftSwap(beat, 2, 5)
    expect(first.accepted).toBe(true)
    expect(first.beat.heap).toEqual([7, 5, 8, 3, 2, 6])
    expect(first.beat.step).toBe(1)
    expect(nextSwap(first.beat)).toEqual({ a: 2, b: 0 })
    const second = applySiftSwap(first.beat, 2, 0)
    expect(second.accepted).toBe(true)
    expect(second.beat.heap).toEqual([8, 5, 7, 3, 2, 6])
    expect(isSiftSolved(second.beat)).toBe(true)
    expect(nextSwap(second.beat)).toBeNull()
  })

  it("a wrong swap is rejected and leaves the beat untouched", () => {
    const beat = siftBeatFromInsert([7, 5, 6, 3, 2], 8)
    const wrong = applySiftSwap(beat, 4, 1) // not the next correct swap
    expect(wrong.accepted).toBe(false)
    expect(wrong.beat).toBe(beat) // same reference, nothing changed
    expect(wrong.beat.heap).toEqual([7, 5, 6, 3, 2, 8])
    expect(wrong.beat.step).toBe(0)
    expect(isCorrectSwap(beat, 4, 1)).toBe(false)
    expect(isCorrectSwap(beat, 5, 2)).toBe(true)
  })

  it("siftBeatFromExtract drives the sift-down from the filled root", () => {
    const beat = siftBeatFromExtract([9, 7, 6, 3, 2])
    expect(beat.heap).toEqual([2, 7, 6, 3]) // the last leaf (2) is already lifted to the root
    expect(beat.path).toEqual([
      { a: 0, b: 1 },
      { a: 1, b: 3 },
    ])
    const a = applySiftSwap(beat, 0, 1)
    expect(a.accepted).toBe(true)
    const b = applySiftSwap(a.beat, 1, 3)
    expect(b.accepted).toBe(true)
    expect(b.beat.heap).toEqual([7, 3, 6, 2])
    expect(isSiftSolved(b.beat)).toBe(true)
  })

  it("'solved' and the heap property agree at every stage", () => {
    const beat = siftBeatFromInsert([7, 5, 6, 3, 2], 8)
    // partway: not solved, and not yet a valid max-heap
    const mid = applySiftSwap(beat, 5, 2).beat
    expect(isSiftSolved(mid)).toBe(false)
    expect(isMaxHeap(mid.heap)).toBe(false)
    // finished: solved, and a valid max-heap
    const done = applySiftSwap(mid, 2, 0).beat
    expect(isSiftSolved(done)).toBe(true)
    expect(isMaxHeap(done.heap)).toBe(true)
  })
})

/* ----------------------- C. generated valid heaps ----------------------- */

describe("generated heaps (replay variety, deterministic)", () => {
  const SEEDS = [1, 2, 7, 42, 99, 100, 256, 1024, 31337, 999983]

  it("generateInsertHeap is deterministic per seed", () => {
    for (const seed of SEEDS) {
      expect(generateInsertHeap(seed)).toEqual(generateInsertHeap(seed))
    }
  })

  it("generateExtractHeap is deterministic per seed", () => {
    for (const seed of SEEDS) {
      expect(generateExtractHeap(seed)).toEqual(generateExtractHeap(seed))
    }
  })

  it("every generated insert is a valid heap whose key forces a real sift-up", () => {
    const [lo, hi] = DEFAULT_HEAP_GEN.value
    const [smin, smax] = DEFAULT_HEAP_GEN.size
    for (const seed of SEEDS) {
      const { heap, key } = generateInsertHeap(seed)
      expect(isMaxHeap(heap)).toBe(true)
      expect(hasDistinctKeys(heap)).toBe(true)
      expect(heap.length).toBeGreaterThanOrEqual(smin)
      expect(heap.length).toBeLessThanOrEqual(smax)
      expect(heap.every((v) => v >= lo && v <= hi)).toBe(true)
      expect(key).toBeGreaterThanOrEqual(lo)
      expect(key).toBeLessThanOrEqual(hi)
      expect(heap.includes(key)).toBe(false) // the key is distinct from the heap
      expect(siftUp(heap, key).path.length).toBeGreaterThanOrEqual(1) // a real, non-trivial swap
    }
  })

  it("every generated extract is a valid heap whose extract forces a real sift-down", () => {
    const [lo, hi] = DEFAULT_HEAP_GEN.value
    const [smin, smax] = DEFAULT_HEAP_GEN.size
    for (const seed of SEEDS) {
      const { heap } = generateExtractHeap(seed)
      expect(isMaxHeap(heap)).toBe(true)
      expect(hasDistinctKeys(heap)).toBe(true)
      expect(heap.length).toBeGreaterThanOrEqual(smin)
      expect(heap.length).toBeLessThanOrEqual(smax)
      expect(heap.every((v) => v >= lo && v <= hi)).toBe(true)
      expect(siftDownExtract(heap).path.length).toBeGreaterThanOrEqual(1) // a real, non-trivial swap
    }
  })

  it("a custom config tunes the size and value ranges (still forces a swap)", () => {
    const config = { size: [5, 5] as [number, number], value: [10, 40] as [number, number] }
    for (const seed of SEEDS) {
      const { heap, key } = generateInsertHeap(seed, config)
      expect(heap.length).toBe(5)
      expect(heap.every((v) => v >= 10 && v <= 40)).toBe(true)
      expect(key).toBeGreaterThanOrEqual(10)
      expect(key).toBeLessThanOrEqual(40)
      expect(isMaxHeap(heap)).toBe(true)
      expect(siftUp(heap, key).path.length).toBeGreaterThanOrEqual(1)

      const ex = generateExtractHeap(seed, config)
      expect(ex.heap.length).toBe(5)
      expect(isMaxHeap(ex.heap)).toBe(true)
      expect(siftDownExtract(ex.heap).path.length).toBeGreaterThanOrEqual(1)
    }
  })

  it("curated shapes are kept where a fixed shape is required (skin, contrast, mapping)", () => {
    // The generator is additive: beats needing a specific pedagogical shape keep a
    // curated heap, while the do-the-sift reps draw a fresh one per seed.
    expect(isMaxHeap(atPart("siftup-skin").question!.heap)).toBe(true)
    expect(isMaxHeap(atPart("contrast-place").question!.heap)).toBe(true)
    expect(isMaxHeap(atPart("map-child").question!.heap)).toBe(true)
    expect(isMaxHeap(atPart("siftup-2").question!.heap)).toBe(true) // generated, still valid
    expect(isMaxHeap(atPart("siftdown-1").question!.heap)).toBe(true) // generated, still valid
  })
})

describe("generated do-the-sift beats (replay variety per lesson seed)", () => {
  const SEEDS = [1, 2, 7, 42, 99, 100, 256, 1024, 31337, 999983]
  const SIFT_BEATS = ["siftup-1", "siftup-2", "siftdown-1", "siftdown-2"] as const

  it("each sift beat is deterministic per lesson seed (same seed -> same instance)", () => {
    for (const seed of SEEDS) {
      for (const part of SIFT_BEATS) {
        expect(atPart(part, seed).sift!.heap).toEqual(atPart(part, seed).sift!.heap)
      }
    }
  })

  it("every sift beat forces a real, settle-to-valid sift across seeds", () => {
    for (const seed of SEEDS) {
      for (const part of SIFT_BEATS) {
        const s = atPart(part, seed)
        expect(s.sift, `${part}@${seed} has a live sift`).not.toBeNull()
        expect(s.sift!.path.length, `${part}@${seed} forces a swap`).toBeGreaterThanOrEqual(1)
        expect(isMaxHeap(s.question!.heap), `${part}@${seed} given heap is a max-heap`).toBe(true)
        expect(hasDistinctKeys(s.question!.heap), `${part}@${seed} distinct keys`).toBe(true)
        const done = solveSift(s)
        expect(isSiftSolved(done.sift!), `${part}@${seed} solves`).toBe(true)
        expect(isMaxHeap(done.sift!.heap), `${part}@${seed} settles to a max-heap`).toBe(true)
        expect(done.feedback, `${part}@${seed} grades correct`).toBe("correct")
      }
    }
  })

  it("the -2 reps are strictly bigger and deeper than the -1 reps (tuned constraints)", () => {
    for (const seed of SEEDS) {
      expect(atPart("siftup-2", seed).question!.heap.length).toBeGreaterThan(
        atPart("siftup-1", seed).question!.heap.length,
      )
      expect(atPart("siftdown-2", seed).question!.heap.length).toBeGreaterThan(
        atPart("siftdown-1", seed).question!.heap.length,
      )
      expect(atPart("siftup-2", seed).sift!.path.length).toBeGreaterThanOrEqual(2)
      expect(atPart("siftdown-2", seed).sift!.path.length).toBeGreaterThanOrEqual(2)
    }
  })
})

/* ----------------------- D. build-a-heap model (chain inserts) ----------------------- */

/** Drive a build beat to completion by always applying the next correct swap. */
function driveBuild(beat: BuildBeat): BuildBeat {
  let b = beat
  let guard = 0
  while (!isBuildSolved(b) && b.sift && guard++ < 80) {
    const sw = nextSwap(b.sift)!
    const r = applyBuildSwap(b, sw.a, sw.b)
    expect(r.accepted).toBe(true)
    b = r.beat
  }
  return b
}

describe("build-a-heap model (a queue of keys + the current heap, per-insert sift)", () => {
  it("opens at the first interactive insert, auto-placing the empty-heap first key", () => {
    const beat = buildBeatFromKeys([5, 9, 3, 12])
    expect(beat.keys).toEqual([5, 9, 3, 12])
    // The first key drops into an empty heap (no swap), so it is placed already and
    // the beat opens on the first insert that actually needs a sift (9 over [5]).
    expect(beat.placed).toBe(1)
    expect(beat.heap).toEqual([5]) // the committed heap before the current insert
    expect(beat.sift!.heap).toEqual([5, 9]) // 9 has dropped into its leaf, ready to climb
    expect(nextSwap(beat.sift!)).toEqual({ a: 1, b: 0 })
    expect(isBuildSolved(beat)).toBe(false)
  })

  it("a correct swap settles the insert, auto-places zero-swap inserts, and opens the next", () => {
    const beat = buildBeatFromKeys([5, 9, 3, 12])
    const r = applyBuildSwap(beat, 1, 0)
    expect(r.accepted).toBe(true)
    // 9 settles to the root, then 3 (smaller than the root) auto-places with no swap,
    // so the next interactive insert is 12 over [9,5,3].
    expect(r.beat.placed).toBe(3)
    expect(r.beat.heap).toEqual([9, 5, 3])
    expect(r.beat.sift!.heap).toEqual([9, 5, 3, 12])
    expect(nextSwap(r.beat.sift!)).toEqual({ a: 3, b: 1 })
  })

  it("the swap is order-insensitive (tap either node first)", () => {
    const beat = buildBeatFromKeys([5, 9, 3, 12])
    expect(applyBuildSwap(beat, 0, 1).accepted).toBe(true) // reversed pair, same move
  })

  it("a wrong swap is rejected and leaves the build untouched (no fail wall)", () => {
    // Advance to a 4-slot insert so a genuinely wrong pair exists.
    const mid = applyBuildSwap(buildBeatFromKeys([5, 9, 3, 12]), 1, 0).beat
    expect(nextSwap(mid.sift!)).toEqual({ a: 3, b: 1 })
    const wrong = applyBuildSwap(mid, 2, 0) // not the next correct swap
    expect(wrong.accepted).toBe(false)
    expect(wrong.beat).toBe(mid) // same reference, nothing advanced
    expect(wrong.beat.placed).toBe(3)
    // and a wrong swap never locks the build: the correct swap still lands after it.
    expect(applyBuildSwap(wrong.beat, 3, 1).accepted).toBe(true)
  })

  it("reports solved exactly when every key is placed into a valid max-heap", () => {
    const solved = driveBuild(buildBeatFromKeys([5, 9, 3, 12]))
    expect(isBuildSolved(solved)).toBe(true)
    expect(solved.placed).toBe(4)
    expect(solved.sift).toBeNull()
    expect(isMaxHeap(solved.heap)).toBe(true)
    expect(hasDistinctKeys(solved.heap)).toBe(true)
    expect(solved.heap).toEqual([12, 9, 3, 5]) // the same heap repeated inserts build
  })

  it("placement-complete always coincides with a valid heap across many sequences", () => {
    const SEQS = [
      [18, 27, 24, 40, 33, 36],
      [10, 20, 30, 40, 50, 60],
      [50, 40, 30, 20, 10],
      [12, 30, 24, 41, 35],
      [7, 3, 9, 1, 8, 6, 5],
    ]
    for (const keys of SEQS) {
      const solved = driveBuild(buildBeatFromKeys(keys))
      expect(solved.placed).toBe(keys.length)
      expect(isBuildSolved(solved)).toBe(true)
      expect(isMaxHeap(solved.heap)).toBe(true)
      expect(new Set(solved.heap)).toEqual(new Set(keys)) // every key landed, none lost
    }
  })

  it("is deterministic and never mutates the input keys", () => {
    const keys = [18, 27, 24, 40, 33, 36]
    const copy = keys.slice()
    expect(buildBeatFromKeys(keys)).toEqual(buildBeatFromKeys(keys.slice()))
    expect(keys).toEqual(copy) // the input array is untouched
  })
})

/* ----------------------- E. watched-build motion frames ----------------------- */

describe("buildMotionFrames (chained insert + sift-up, animated end to end)", () => {
  it("chains one insert's frames after another, settling at the built heap", () => {
    const frames = buildMotionFrames([12, 30, 24, 41, 35])
    // one frame per (drop + each swap) across all five inserts: 1+2+1+3+2 = 9.
    expect(frames.length).toBe(9)
    expect(frames[0].heap).toEqual([12]) // first key dropped into the empty heap
    const last = frames[frames.length - 1]
    expect(last.heap).toEqual([41, 35, 24, 12, 30])
    expect(isMaxHeap(last.heap)).toBe(true)
    expect(hasDistinctKeys(last.heap)).toBe(true)
  })

  it("tags each frame with the key + insert it belongs to, and a complete placement map", () => {
    const frames = buildMotionFrames([12, 30, 24, 41, 35])
    expect(frames[0].key).toBe(12)
    expect(frames[0].insertIndex).toBe(0)
    expect(frames[frames.length - 1].key).toBe(35)
    expect(frames[frames.length - 1].insertIndex).toBe(4)
    for (const f of frames) {
      expect(f.placements.length).toBe(f.heap.length)
      for (const { value, slot } of f.placements) expect(f.heap[slot]).toBe(value)
    }
  })

  it("is a pure view (never mutates the input keys / start heap)", () => {
    const keys = [12, 30, 24, 41, 35]
    const copy = keys.slice()
    buildMotionFrames(keys)
    expect(keys).toEqual(copy)
  })
})

/* ----------------------- F. build-a-heap beat (reducer, graded build bin) ----------------------- */

describe("build-a-heap beat (graded, reuses the do-the-sift mechanic per insert)", () => {
  const swap = (s: HeapsState, a: number, b: number): HeapsState =>
    run(s, { type: "rewire", from: slotId(a), to: slotId(b) })

  it("inserts watched-build then build-a-heap after the sift-up bin, before extract", () => {
    const i = (p: HeapsPart) => HEAPS_PARTS.indexOf(p)
    expect(i("siftup-2")).toBeLessThan(i("watched-build"))
    expect(i("watched-build")).toBeLessThan(i("build-a-heap"))
    expect(i("build-a-heap")).toBeLessThan(i("teach-extract"))
    expect(isBuildPart("build-a-heap")).toBe(true)
    expect(isBuildPart("siftup-1")).toBe(false)
    expect(isBuildPart("watched-build")).toBe(false)
  })

  it("watched-build is an ungraded teach beat that carries its build sequence", () => {
    const s = atPart("watched-build")
    expect(isIntroPart("watched-build")).toBe(true)
    expect(s.question!.bin).toBeNull()
    expect(s.question!.buildKeys).not.toBeNull()
    expect(s.question!.buildKeys!.length).toBeGreaterThan(0)
    expect(s.build).toBeNull() // a teach beat has no working build model
    expect(currentPartHeaps(run(s, { type: "continue" }))).toBe<HeapsPart>("build-a-heap")
  })

  it("opens the build beat with the first key auto-placed and the sift mechanic live", () => {
    const s = atPart("build-a-heap")
    expect(s.question!.bin).toBe("build")
    expect(s.question!.options).toHaveLength(0) // performed, not picked
    expect(s.sift).toBeNull() // build uses its own BuildBeat, not the single sift
    expect(s.build).not.toBeNull()
    expect(s.build!.keys).toEqual([18, 27, 24, 40, 33, 36])
    expect(s.build!.placed).toBe(1)
    expect(s.build!.sift!.heap).toEqual([18, 27])
    expect(s.siftUpCorrect).toBe(BIN_QUOTA) // the 2-rep sift-up bin is already full on the walk
  })

  it("a correct swap advances the build; a wrong swap nudges with no change", () => {
    const s = atPart("build-a-heap")
    const one = swap(s, 1, 0) // settle 27, auto-place 24, open 40 over [27,18,24,40]
    expect(one.feedback).toBe("idle")
    expect(one.build!.placed).toBe(3)
    expect(one.build!.sift!.heap).toEqual([27, 18, 24, 40])
    expect(nextSwap(one.build!.sift!)).toEqual({ a: 3, b: 1 })

    const wrong = swap(one, 2, 0) // not the next correct swap
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.build).toBe(one.build) // unchanged reference
    expect(wrong.buildCorrect).toBe(0)
    expect(swap(wrong, 3, 1).build!.sift!.step).toBe(1) // a correct swap still lands
  })

  it("the swap is order-insensitive, and Check / continue are no-ops on the build beat", () => {
    const s = atPart("build-a-heap")
    expect(swap(s, 0, 1).build!.placed).toBe(3) // reversed first pair, same move
    expect(run(s, { type: "check" })).toBe(s) // build commits via swaps, not Check
    expect(currentPartHeaps(run(s, { type: "continue" }))).toBe<HeapsPart>("build-a-heap")
  })

  it("placing the whole sequence grades correct and bumps the build bin", () => {
    const s = atPart("build-a-heap")
    const done = solveBuild(s)
    expect(isBuildSolved(done.build!)).toBe(true)
    expect(isMaxHeap(done.build!.heap)).toBe(true)
    expect(done.feedback).toBe("correct")
    expect(done.buildCorrect).toBe(BUILD_QUOTA)
    expect(done.combo).toBeGreaterThan(0)
    // On the happy path the sift-up bin (2) is full by the time we build, so the
    // cumulative gate is those 2 plus the freshly earned build rep.
    expect(partQuotaHeaps(done)).toEqual({ done: 3, total: 11 })
  })

  it("round-trips the build counter and rebuilds the working model on resume", () => {
    const after = clearBeat(atPart("build-a-heap")) // build done → advances to teach-extract
    const progress = toProgressHeaps(after)
    expect(progress.counters.build).toBe(1)
    expect(progress.currentPart).toBe<HeapsPart>("teach-extract")

    const resumed = resumeHeaps(
      { counters: { siftUp: 2, build: 0 }, currentPart: "build-a-heap", completed: false },
      SEED,
    )
    expect(currentPartHeaps(resumed)).toBe<HeapsPart>("build-a-heap")
    expect(resumed.build).not.toBeNull()
    expect(isBuildSolved(resumed.build!)).toBe(false)
    // performing the build from the resumed beat still grades + bumps the build bin.
    const done = solveBuild(resumed)
    expect(done.feedback).toBe("correct")
    expect(done.buildCorrect).toBe(1)
  })
})

/* ----------------------- G. re-triage primitive (siftFrom) ----------------------- */

describe("siftFrom (re-triage primitive: re-sift a changed slot up or down)", () => {
  it("sifts UP when the changed value now beats its parent", () => {
    // slot 4 raised to 95 climbs to the root.
    const { result, path, start } = siftFrom([80, 70, 55, 60, 95], 4)
    expect(start).toEqual([80, 70, 55, 60, 95])
    expect(path).toEqual([
      { a: 4, b: 1 },
      { a: 1, b: 0 },
    ])
    expect(result).toEqual([95, 80, 55, 60, 70])
    expect(isMaxHeap(result)).toBe(true)
  })

  it("sinks DOWN via the larger child when the changed value now loses to a child", () => {
    // slot 1 dropped to 45 sinks past its larger child (60).
    const { result, path } = siftFrom([80, 45, 55, 60, 50], 1)
    expect(path).toEqual([{ a: 1, b: 3 }])
    expect(result).toEqual([80, 60, 55, 45, 50])
    expect(isMaxHeap(result)).toBe(true)
  })

  it("does nothing when the changed value already fits (no swap)", () => {
    const { path, result } = siftFrom([80, 70, 55, 60, 50], 4)
    expect(path).toEqual([])
    expect(result).toEqual([80, 70, 55, 60, 50])
  })

  it("never mutates the input heap", () => {
    const input = [80, 70, 55, 60, 95]
    siftFrom(input, 4)
    expect(input).toEqual([80, 70, 55, 60, 95])
  })
})

describe("siftBeatFromReTriage (open a re-triage do-the-sift)", () => {
  it("replaces the slot's value and opens at the changed-but-unsifted board", () => {
    const beat = siftBeatFromReTriage([80, 70, 55, 60, 50], 4, 95)
    expect(beat.heap).toEqual([80, 70, 55, 60, 95]) // 50 → 95 at slot 4, not yet re-sifted
    expect(beat.step).toBe(0)
    expect(nextSwap(beat)).toEqual({ a: 4, b: 1 })
    const a = applySiftSwap(beat, 4, 1)
    const b = applySiftSwap(a.beat, 1, 0)
    expect(isSiftSolved(b.beat)).toBe(true)
    expect(b.beat.heap).toEqual([95, 80, 55, 60, 70])
    expect(isMaxHeap(b.beat.heap)).toBe(true)
  })
})

/* ----------------------- H. er-synthesis model (admit/discharge/re-triage) ----------------------- */

const SYNTH_START = [90, 80, 50, 60, 70]
const SYNTH_STEPS: SynthesisStepSpec[] = [
  { phase: "admit", key: 55 },
  { phase: "discharge" },
  { phase: "retriage", slot: 4, newKey: 95 },
]

/** Drive a synthesis beat to completion by always applying the next correct swap. */
function driveSynthesis(beat: SynthesisBeat): SynthesisBeat {
  let b = beat
  let guard = 0
  while (!isSynthesisSolved(b) && b.sift && guard++ < 60) {
    const sw = nextSwap(b.sift)!
    const r = applySynthesisSwap(b, sw.a, sw.b)
    expect(r.accepted).toBe(true)
    b = r.beat
  }
  return b
}

describe("er-synthesis model (admit → discharge → re-triage, one slot)", () => {
  it("opens on the admit op, sifting the new patient up", () => {
    const beat = synthesisBeatFromSteps(SYNTH_START, SYNTH_STEPS)
    expect(beat.stepIndex).toBe(0)
    expect(synthesisPhase(beat)).toBe("admit")
    expect(beat.heap).toEqual(SYNTH_START) // the committed board before the op
    expect(beat.sift!.heap).toEqual([90, 80, 50, 60, 70, 55]) // 55 dropped at the next slot
    expect(nextSwap(beat.sift!)).toEqual({ a: 5, b: 2 })
    expect(isSynthesisSolved(beat)).toBe(false)
  })

  it("advances admit → discharge → retriage, committing each op's board", () => {
    let beat = synthesisBeatFromSteps(SYNTH_START, SYNTH_STEPS)
    // admit 55 (one swap) settles, opening the discharge of the most urgent (90).
    const admit = applySynthesisSwap(beat, 5, 2)
    expect(admit.accepted).toBe(true)
    beat = admit.beat
    expect(synthesisPhase(beat)).toBe("discharge")
    expect(beat.heap).toEqual([90, 80, 55, 60, 70, 50])
    expect(beat.sift!.heap).toEqual([50, 80, 55, 60, 70]) // 90 out, last leaf fills the top
    // discharge sinks the filler (two swaps), opening the re-triage.
    const d2 = applySynthesisSwap(applySynthesisSwap(beat, 0, 1).beat, 1, 4)
    beat = d2.beat
    expect(synthesisPhase(beat)).toBe("retriage")
    expect(beat.heap).toEqual([80, 70, 55, 60, 50])
    expect(beat.sift!.heap).toEqual([80, 70, 55, 60, 95]) // slot 4 re-triaged 50 → 95
  })

  it("a wrong sub-move is rejected and leaves the synthesis untouched (no fail wall)", () => {
    const beat = synthesisBeatFromSteps(SYNTH_START, SYNTH_STEPS)
    const wrong = applySynthesisSwap(beat, 5, 0) // not the next correct swap
    expect(wrong.accepted).toBe(false)
    expect(wrong.beat).toBe(beat) // same reference, nothing advanced
    expect(applySynthesisSwap(wrong.beat, 5, 2).accepted).toBe(true) // correct still lands
  })

  it("reports solved exactly when every op is performed into a valid max-heap", () => {
    const solved = driveSynthesis(synthesisBeatFromSteps(SYNTH_START, SYNTH_STEPS))
    expect(isSynthesisSolved(solved)).toBe(true)
    expect(solved.stepIndex).toBe(SYNTH_STEPS.length)
    expect(solved.sift).toBeNull()
    expect(synthesisPhase(solved)).toBeNull()
    expect(isMaxHeap(solved.heap)).toBe(true)
    expect(solved.heap).toEqual([95, 80, 55, 60, 70])
  })

  it("synthesisFinalHeap agrees with driving the beat to the end", () => {
    expect(synthesisFinalHeap(SYNTH_START, SYNTH_STEPS)).toEqual(
      driveSynthesis(synthesisBeatFromSteps(SYNTH_START, SYNTH_STEPS)).heap,
    )
  })

  it("each curated op forces at least one real swap (no auto-skipped phase)", () => {
    let beat = synthesisBeatFromSteps(SYNTH_START, SYNTH_STEPS)
    const phases = new Set<string>()
    let guard = 0
    while (beat.sift && guard++ < 60) {
      phases.add(synthesisPhase(beat) as string)
      expect(beat.sift.path.length).toBeGreaterThanOrEqual(1)
      const sw = nextSwap(beat.sift)!
      beat = applySynthesisSwap(beat, sw.a, sw.b).beat
    }
    expect(phases).toEqual(new Set(["admit", "discharge", "retriage"]))
  })

  it("is deterministic and never mutates the start heap / steps", () => {
    const start = SYNTH_START.slice()
    const steps = SYNTH_STEPS.map((s) => ({ ...s }))
    expect(synthesisBeatFromSteps(start, steps)).toEqual(synthesisBeatFromSteps(start, steps))
    expect(start).toEqual(SYNTH_START)
  })
})

/* ----------------------- I. er-synthesis beat (reducer, graded synthesis bin) ----------------------- */

describe("er-synthesis beat (graded as one slot, reuses do-the-sift per op)", () => {
  const swap = (s: HeapsState, a: number, b: number): HeapsState =>
    run(s, { type: "rewire", from: slotId(a), to: slotId(b) })

  it("is the last beat, in the synthesis bin, performed not picked", () => {
    expect(HEAPS_PARTS[HEAPS_PARTS.length - 1]).toBe<HeapsPart>("er-synthesis")
    const s = atPart("er-synthesis")
    expect(s.question!.bin).toBe("synthesis")
    expect(s.question!.options).toHaveLength(0)
    expect(s.sift).toBeNull()
    expect(s.build).toBeNull()
    expect(s.synthesis).not.toBeNull()
    expect(synthesisPhase(s.synthesis!)).toBe("admit")
    // every other bin is already full on the happy path: the gate sits at 10 of 11.
    expect(partQuotaHeaps(s)).toEqual({ done: 10, total: 11 })
  })

  it("only credits the synthesis bin once the FULL sequence is correct (one gate slot)", () => {
    const s = atPart("er-synthesis")
    const afterAdmit = swap(s, 5, 2) // perform admit only
    expect(synthesisPhase(afterAdmit.synthesis!)).toBe("discharge")
    expect(afterAdmit.feedback).toBe("idle")
    expect(afterAdmit.synthesisCorrect).toBe(0) // not graded mid-sequence
    expect(run(afterAdmit, { type: "check" })).toBe(afterAdmit) // commits via swaps, not Check
  })

  it("a wrong sub-move nudges with no change; finishing every op grades the one slot", () => {
    const s = atPart("er-synthesis")
    const wrong = swap(s, 5, 0) // not the next correct admit swap
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.synthesis).toBe(s.synthesis) // unchanged reference
    expect(wrong.synthesisCorrect).toBe(0)

    const done = solveSynthesis(s)
    expect(isSynthesisSolved(done.synthesis!)).toBe(true)
    expect(done.feedback).toBe("correct")
    expect(done.synthesisCorrect).toBe(SYNTHESIS_QUOTA)
    expect(done.combo).toBeGreaterThan(0)
    expect(partQuotaHeaps(done)).toEqual({ done: 11, total: 11 })
  })

  it("round-trips the synthesis counter and rebuilds the working model on resume", () => {
    const after = clearBeat(atPart("er-synthesis")) // synthesis done → completes the lesson
    const progress = toProgressHeaps(after)
    expect(progress.counters.synthesis).toBe(1)
    expect(progress.completed).toBe(true)

    const resumed = resumeHeaps(
      {
        counters: { siftUp: 2, siftDown: 3, mapping: 2, contrast: 2, build: 1, synthesis: 0 },
        currentPart: "er-synthesis",
        completed: false,
      },
      SEED,
    )
    expect(currentPartHeaps(resumed)).toBe<HeapsPart>("er-synthesis")
    expect(resumed.synthesis).not.toBeNull()
    expect(isSynthesisSolved(resumed.synthesis!)).toBe(false)
    const done = solveSynthesis(resumed)
    expect(done.feedback).toBe("correct")
    expect(done.synthesisCorrect).toBe(1)
  })
})
