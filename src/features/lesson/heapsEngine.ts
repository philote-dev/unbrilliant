import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Heaps lesson engine. One idea: a heap guarantees only
 * the *top* element (exactly enough to grab the best item cheaply) and it
 * secretly lives in an *array*, addressed by index arithmetic (children of slot
 * `i` are `2i+1` / `2i+2`, parent is `(i-1)/2`). Two mechanics, one idea:
 * predict the post-sift arrangement (insert sifts up; extract moves last→root
 * then sifts down, larger child first) and locate-the-position (the tree↔array
 * index map). Max-heap, fixed; distinct integer keys, so every sift path is
 * unique and no model call is ever needed.
 *
 * Sixteen beats, eleven graded behind the until-correct wall, aggregated into a
 * 2/3/2/2/1/1 gate across six bins (siftUp / siftDown / mapping / contrast /
 * build / synthesis). The siftDown bin carries the extra rep: two do-the-sift
 * extracts (siftdown-1 / siftdown-2) plus the ER extract skin (`siftup-skin`,
 * repurposed from its old passive sift-up pick into a do-the-sift discharge), so
 * its quota is 3 while siftUp / mapping / contrast keep their 2-each quota and
 * build stays 1. The synthesis bin (quota 1) is the multi-step ER problem
 * (`er-synthesis`): admit a patient (insert + sift up), discharge the most urgent
 * (extract + sift down), then re-triage one (a severity changes, then re-sift),
 * graded as ONE slot that clears only when every sub-step is correct. The gate is
 * therefore 2 + 3 + 2 + 2 + 1 + 1 = 11. The do-the-sift heaps are seeded-generated
 * for replay variety (siftup-2 / siftdown-2 deeper than siftup-1 / siftdown-1).
 * Reuses the shared feedback machine + flame (`gradeAnswer`) and the same
 * LessonProgress shape; only the heap model, verdicts, and quotas are specific.
 * Deterministic (seeded): same state always yields the same question/feedback.
 * Commits are either a `{ type: "select" }` (an arrangement-card id or a
 * `"slot-"+i` id) or, for the active sift / build beats, a `{ type: "rewire" }`
 * carrying two `"slot-"+i` ids (the swap the learner performs).
 */

export const HEAPS_PARTS = [
  "demo", // 1  intro free-play insert sandbox: insert keys, each auto-sifts up; tree + array sync; clear to rebuild
  "teach-array", // 2  teach: it secretly lives in an array, 2i+1 / 2i+2 / (i-1)/2 drawn in both
  "teach-rule", // 3  teach: the heap rule. Parent beats both children, and that's ALL (not a BST)
  "siftup-1", // 4  H1 do-the-sift insert (small, generated)                  siftUp     ✓
  "siftup-2", // 5  H1 do-the-sift insert (bigger heap, generated)            siftUp     ✓
  "watched-build", // 6  teach: watch a heap built from nothing (repeated insert + sift up), end to end
  "build-a-heap", // 7  build a valid heap yourself, sifting each inserted key  build      ✓
  "teach-extract", // 8  teach/demo: extract top. Last→root, sift DOWN, larger child first
  "siftdown-1", // 9  H2 do-the-sift extract (small, generated)               siftDown   ✓
  "siftdown-2", // 10 H2 do-the-sift extract (deeper, generated)              siftDown   ✓
  "siftup-skin", // 11 ER extract skin: discharge the most urgent (do-the-sift) siftDown   ✓
  "map-child", // 12 H3 slot i's larger child lives at which slot? (tap)      mapping    ✓
  "map-parent", // 13 H3 slot j. Who's its parent slot? (tap, reverse)       mapping    ✓
  "contrast-place", // 14a H4 where does K go in a HEAP vs a BST?             contrast   ✓
  "contrast-samedata", // 14b H4 tree node i ⇔ array cell i ("same data")     contrast   ✓
  "er-synthesis", // 15 multi-step ER: admit + discharge + re-triage           synthesis  ✓
] as const
export type HeapsPart = (typeof HEAPS_PARTS)[number]
export const HEAPS_TOTAL_PARTS = HEAPS_PARTS.length // 16

/** Correct answers required per two-rep bin (siftUp / mapping / contrast: 2 each). */
export const BIN_QUOTA = 2
/** The siftDown bin carries the extra rep: two do-the-sift extracts + the ER extract skin. */
export const SIFTDOWN_QUOTA = 3
/** Reps required to clear the build bin (one graded build for now; gallery-tunable). */
export const BUILD_QUOTA = 1
/** Reps required to clear the synthesis bin (one multi-step ER problem, graded as one slot). */
export const SYNTHESIS_QUOTA = 1
/** The hard mastery gate: siftUp 2, siftDown 3, mapping 2, contrast 2, build 1, synthesis 1. */
export const GATE_TOTAL = BIN_QUOTA * 3 + SIFTDOWN_QUOTA + BUILD_QUOTA + SYNTHESIS_QUOTA // 11

export type HeapBin = "siftUp" | "siftDown" | "mapping" | "contrast" | "build" | "synthesis"
/** How the learner answers a beat. */
export type HeapMode = "intro" | "arrangement" | "slot" | "build" | "synthesis"

/* ----------------------------- pure heap helpers ----------------------------- */

export const parentIndex = (i: number): number => (i - 1) >> 1
export const leftIndex = (i: number): number => 2 * i + 1
export const rightIndex = (i: number): number => 2 * i + 2

/** Index of the larger existing child of `i`, or -1 if `i` is a leaf. */
export function largerChildIndex(heap: number[], i: number): number {
  const l = leftIndex(i)
  const r = rightIndex(i)
  if (l >= heap.length) return -1
  if (r >= heap.length) return l
  return heap[l] > heap[r] ? l : r // distinct keys ⇒ never a tie
}

/** Index of the *smaller* existing child of `i` (powers the wrong-direction distractor). */
export function smallerChildIndex(heap: number[], i: number): number {
  const l = leftIndex(i)
  const r = rightIndex(i)
  if (l >= heap.length) return -1
  if (r >= heap.length) return l
  return heap[l] < heap[r] ? l : r
}

/** An ordered swap of two slots, in the order they fire during a sift. */
export interface SwapStep {
  a: number
  b: number
}

/** Insert: append at the next open slot, then swap up the parent chain while the child beats its parent. */
export function siftUp(
  heap: number[],
  key: number,
): { result: number[]; path: SwapStep[]; start: number[] } {
  const start = [...heap, key]
  const out = start.slice()
  const path: SwapStep[] = []
  let i = out.length - 1
  while (i > 0 && out[i] > out[parentIndex(i)]) {
    const p = parentIndex(i)
    ;[out[i], out[p]] = [out[p], out[i]]
    path.push({ a: i, b: p })
    i = p
  }
  return { result: out, path, start }
}

/** Extract-top: move the LAST element to the root, drop the last slot, then swap down the LARGER child while it beats the node. */
export function siftDownExtract(heap: number[]): {
  extracted: number
  result: number[]
  path: SwapStep[]
  start: number[]
} {
  const extracted = heap[0]
  const out = heap.slice()
  const path: SwapStep[] = []
  const last = out.pop() as number
  if (out.length) out[0] = last
  const start = out.slice()
  let i = 0
  let c = largerChildIndex(out, i)
  while (c !== -1 && out[c] > out[i]) {
    ;[out[i], out[c]] = [out[c], out[i]]
    path.push({ a: i, b: c })
    i = c
    c = largerChildIndex(out, i)
  }
  return { extracted, result: out, path, start }
}

/** The smaller-child-first twin of extract: a wrong but tempting sift-down path. */
export function siftDownSmallerChild(heap: number[]): { result: number[]; path: SwapStep[] } {
  const out = heap.slice()
  const path: SwapStep[] = []
  const last = out.pop() as number
  if (out.length) out[0] = last
  let i = 0
  let c = smallerChildIndex(out, i)
  while (c !== -1 && out[c] > out[i]) {
    ;[out[i], out[c]] = [out[c], out[i]]
    path.push({ a: i, b: c })
    i = c
    c = smallerChildIndex(out, i)
  }
  return { result: out, path }
}

/**
 * Restore the heap after the value already sitting at slot `j` changed: sift it UP
 * the parent chain while it beats its parent, otherwise sink it DOWN past its
 * larger child while a child beats it. Exactly one direction fires (a changed key
 * cannot both beat its parent and lose to a child), so the path is unique for
 * distinct keys. This is the re-triage primitive: change a severity in place, then
 * re-sift in whichever direction it needs. Pure: `heap` is read, never mutated.
 */
export function siftFrom(
  heap: number[],
  j: number,
): { result: number[]; path: SwapStep[]; start: number[] } {
  const start = heap.slice()
  const out = start.slice()
  const path: SwapStep[] = []
  if (j > 0 && out[j] > out[parentIndex(j)]) {
    let i = j
    while (i > 0 && out[i] > out[parentIndex(i)]) {
      const p = parentIndex(i)
      ;[out[i], out[p]] = [out[p], out[i]]
      path.push({ a: i, b: p })
      i = p
    }
  } else {
    let i = j
    let c = largerChildIndex(out, i)
    while (c !== -1 && out[c] > out[i]) {
      ;[out[i], out[c]] = [out[c], out[i]]
      path.push({ a: i, b: c })
      i = c
      c = largerChildIndex(out, i)
    }
  }
  return { result: out, path, start }
}

/** The slot a tree↔array mapping question resolves to. */
export const mappingAnswer = (
  heap: number[],
  i: number,
  dir: "largerChild" | "parent",
): number => (dir === "parent" ? parentIndex(i) : largerChildIndex(heap, i))

/** Replay helper: the arrangement after applying the first `upto` swaps of a path. */
export function applySwaps(start: number[], path: SwapStep[], upto: number): number[] {
  const out = start.slice()
  const n = Math.max(0, Math.min(upto, path.length))
  for (let k = 0; k < n; k++) {
    const { a, b } = path[k]
    ;[out[a], out[b]] = [out[b], out[a]]
  }
  return out
}

/** The "before" frame of an extract-top replay. */
export interface ExtractIntroFrame {
  /** The pre-extract heap (a view, not mutated). */
  heap: number[]
  /** The slot whose value is leaving (always the root). */
  leavingSlot: number
  /** The slot that rises to fill the root (always the last), keeping the array gap-free. */
  fillerSlot: number
}

/**
 * The intro frame for an extract-top replay: the top (slot 0) is leaving and the
 * last item (slot n-1) is about to jump up to fill it. This makes the compact-array
 * invariant ("keep the array packed, no gaps") explicit before the sift-down. Pure.
 */
export function extractIntroFrame(heap: number[]): ExtractIntroFrame {
  return { heap: heap.slice(), leavingSlot: 0, fillerSlot: heap.length - 1 }
}

/* ----------------------- traveling-node motion frames ----------------------- */

/** One node's placement within a single animation frame: a key sitting at a slot. */
export interface NodePlacement {
  /** The key, which is also the node's stable identity across frames (distinct keys) and the UI's layoutId. */
  value: number
  /** The slot (array index / tree position) the node occupies in this frame. */
  slot: number
}

/** The extract hand-off that opens a sift-down: the old root leaves and the last leaf rises to fill it. */
export interface ExtractHandoff {
  /** The value leaving the heap entirely (the old root). */
  leaving: number
  /** The value rising to the root to keep the array packed (the old last leaf), or null if the heap empties. */
  filler: number | null
}

/** One ordered frame of a traveling-node sift: where every node sits, plus what moved to reach it. */
export interface NodeMotionFrame {
  /** The slot-indexed arrangement for this frame (slot `i` holds `heap[i]`). */
  heap: number[]
  /** Every present node mapped to its slot, keyed by value-identity (the data a layoutId travel needs). */
  placements: NodePlacement[]
  /** A two-slot swap that produced this frame (the moving pair), or null on a setup / hand-off frame. */
  movingPair: SwapStep | null
  /** The extract hand-off that produced this frame (root out, last in), or null otherwise. */
  handoff: ExtractHandoff | null
}

/** The operation to animate: an insert (sift up), or an extract (intro hand-off, then sift down). */
export type HeapMotionOp =
  | { kind: "insert"; heap: number[]; key: number }
  | { kind: "extract"; heap: number[] }

/** Map a slot-indexed arrangement to per-node placements (value-identity -> slot). */
function placementsOf(heap: number[]): NodePlacement[] {
  return heap.map((value, slot) => ({ value, slot }))
}

/**
 * Expand a heap operation into the ordered frames a traveling-node animation walks,
 * synced across the tree view and the array view. Each frame maps every node's
 * value-identity to its slot and marks what moved to reach it (a swap, or the
 * extract hand-off), so a UI can animate a node physically travelling between slots.
 * Pure VIEW over the existing `SwapStep` correct line (`siftUp` / `siftDownExtract`):
 * it never re-derives the algorithm and never feeds grading. An insert yields the
 * appended setup frame plus one frame per sift-up swap. An extract yields the
 * full-heap setup, the intro hand-off (the old root leaves and the last leaf fills
 * the root), then one frame per sift-down swap.
 */
export function nodeMotionFrames(op: HeapMotionOp): NodeMotionFrame[] {
  if (op.kind === "insert") {
    const { path, start } = siftUp(op.heap, op.key)
    const frames: NodeMotionFrame[] = []
    for (let step = 0; step <= path.length; step++) {
      const heap = applySwaps(start, path, step)
      frames.push({
        heap,
        placements: placementsOf(heap),
        movingPair: step > 0 ? path[step - 1] : null,
        handoff: null,
      })
    }
    return frames
  }

  const { extracted, path, start } = siftDownExtract(op.heap)
  const intro = extractIntroFrame(op.heap)
  const filler = op.heap.length > 1 ? op.heap[intro.fillerSlot] : null
  const frames: NodeMotionFrame[] = [
    {
      heap: op.heap.slice(),
      placements: placementsOf(op.heap),
      movingPair: null,
      handoff: null,
    },
    {
      heap: start.slice(),
      placements: placementsOf(start),
      movingPair: null,
      handoff: { leaving: extracted, filler },
    },
  ]
  for (let step = 1; step <= path.length; step++) {
    const heap = applySwaps(start, path, step)
    frames.push({
      heap,
      placements: placementsOf(heap),
      movingPair: path[step - 1],
      handoff: null,
    })
  }
  return frames
}

/* ----------------------- do-the-sift (active mechanic) ----------------------- */

/**
 * The live state of an active "do the sift" beat, where the learner performs each
 * swap instead of picking an end-state. It pairs the working arrangement with the
 * correct swap line (from `siftUp` / `siftDownExtract`) and a cursor into it. Pure:
 * `applySiftSwap` accepts only the next correct swap and returns a fresh beat; a
 * wrong proposal is rejected and the beat is returned untouched. The grading and
 * feedback wiring lives in the reducer + UI; this is just the validator.
 */
export interface SiftBeat {
  /** The current working arrangement, advanced only by accepted swaps. */
  heap: number[]
  /** The full correct swap line, fixed when the beat opens. */
  path: SwapStep[]
  /** How many correct swaps have been performed so far (0..path.length). */
  step: number
}

/** Open a do-the-sift beat for an insert: drop the key in, then the learner sifts up. */
export function siftBeatFromInsert(heap: number[], key: number): SiftBeat {
  const { path, start } = siftUp(heap, key)
  return { heap: start, path, step: 0 }
}

/** Open a do-the-sift beat for an extract: the last leaf is already in the root, then the learner sifts down. */
export function siftBeatFromExtract(heap: number[]): SiftBeat {
  const { path, start } = siftDownExtract(heap)
  return { heap: start, path, step: 0 }
}

/**
 * Open a do-the-sift beat for a re-triage: the value at slot `j` is replaced by
 * `newKey` (the new severity), then the learner re-sifts it into place (up or down,
 * whichever the change demands, via `siftFrom`). The beat opens at the changed-but-
 * not-yet-sifted arrangement, so the learner performs the restoring swaps.
 */
export function siftBeatFromReTriage(heap: number[], j: number, newKey: number): SiftBeat {
  const changed = heap.slice()
  changed[j] = newKey
  const { path, start } = siftFrom(changed, j)
  return { heap: start, path, step: 0 }
}

/** The next correct swap the learner must perform, or null once the sift is settled. */
export function nextSwap(beat: SiftBeat): SwapStep | null {
  return beat.step < beat.path.length ? beat.path[beat.step] : null
}

/** A swap is the same move regardless of the order its two slots are named. */
function sameSwap(x: SwapStep, a: number, b: number): boolean {
  return (x.a === a && x.b === b) || (x.a === b && x.b === a)
}

/** Is the proposed (a, b) the next correct swap in the line? Order does not matter. */
export function isCorrectSwap(beat: SiftBeat, a: number, b: number): boolean {
  const next = nextSwap(beat)
  return next != null && sameSwap(next, a, b)
}

/**
 * Validate a learner-proposed swap. If it equals the next correct swap, apply it and
 * advance (a fresh beat, `accepted: true`); otherwise reject it and return the SAME
 * beat unchanged (`accepted: false`). Never mutates the input.
 */
export function applySiftSwap(
  beat: SiftBeat,
  a: number,
  b: number,
): { beat: SiftBeat; accepted: boolean } {
  if (!isCorrectSwap(beat, a, b)) return { beat, accepted: false }
  const heap = beat.heap.slice()
  ;[heap[a], heap[b]] = [heap[b], heap[a]]
  return { beat: { heap, path: beat.path, step: beat.step + 1 }, accepted: true }
}

/** The beat is solved once every correct swap is done, which is exactly when the heap property holds. */
export function isSiftSolved(beat: SiftBeat): boolean {
  return beat.step >= beat.path.length
}

/* ----------------------- build-a-heap (chain inserts, active) ----------------------- */

/**
 * The live state of an active "build a heap" beat: a fixed queue of keys plus the
 * heap built so far, and the live per-insert `SiftBeat` for the key currently being
 * placed. The learner performs each sift themselves (reusing the do-the-sift
 * mechanic per insert); when one insert settles the model commits it and opens the
 * next key, auto-settling any insert that needs no swap (a key already at or below
 * its parent), so the learner always faces a real swap. It is solved once every key
 * is placed, which (because each insert follows the `siftUp` line) is exactly when
 * the result is a valid max-heap. Pure: `applyBuildSwap` returns a fresh beat.
 */
export interface BuildBeat {
  /** The full insert sequence, fixed when the beat opens. */
  keys: number[]
  /** How many of `keys` are fully placed (inserted + sifted) so far. */
  placed: number
  /** The heap after the first `placed` keys (the committed arrangement, gap-free). */
  heap: number[]
  /** The live per-insert sift for `keys[placed]`, or null once every key is placed. */
  sift: SiftBeat | null
}

/** Open the per-insert sift for the next key, or null when the sequence is exhausted. */
function openBuildSift(heap: number[], keys: number[], placed: number): SiftBeat | null {
  return placed < keys.length ? siftBeatFromInsert(heap, keys[placed]) : null
}

/**
 * Advance the build past any insert whose sift is already settled (a key that needs
 * no swap, including the first key into an empty heap), committing each settled heap
 * and opening the next key, until it lands on an insert that needs a swap (or the
 * whole sequence is placed). This keeps every learner-facing step a real swap.
 */
function settleBuild(beat: BuildBeat): BuildBeat {
  let { placed, heap } = beat
  let sift = beat.sift
  while (sift && isSiftSolved(sift) && placed < beat.keys.length) {
    heap = sift.heap // the key has settled into the committed heap
    placed += 1
    sift = openBuildSift(heap, beat.keys, placed)
  }
  return { keys: beat.keys, placed, heap, sift }
}

/** Open a build-a-heap beat for an insert sequence (built from `startHeap`, default empty). */
export function buildBeatFromKeys(keys: number[], startHeap: number[] = []): BuildBeat {
  const heap = startHeap.slice()
  const sift = openBuildSift(heap, keys, 0)
  return settleBuild({ keys: keys.slice(), placed: 0, heap, sift })
}

/**
 * Validate a learner-proposed swap against the current insert's sift. A correct swap
 * advances that insert and, if it settles, commits it and opens the next key (a fresh
 * beat, `accepted: true`); a wrong proposal is rejected and the SAME beat is returned
 * (`accepted: false`). Never mutates the input.
 */
export function applyBuildSwap(
  beat: BuildBeat,
  a: number,
  b: number,
): { beat: BuildBeat; accepted: boolean } {
  if (!beat.sift) return { beat, accepted: false }
  const { beat: sift, accepted } = applySiftSwap(beat.sift, a, b)
  if (!accepted) return { beat, accepted: false }
  return { beat: settleBuild({ ...beat, sift }), accepted: true }
}

/** The build is solved once every key is placed AND the result is a valid max-heap. */
export function isBuildSolved(beat: BuildBeat): boolean {
  return beat.placed >= beat.keys.length && isMaxHeap(beat.heap)
}

/* ----------------------- er-synthesis (multi-step, active) ----------------------- */

/** The three ER operations the synthesis sequences over the same heap. */
export type SynthesisPhase = "admit" | "discharge" | "retriage"

/**
 * One planned step of the ER synthesis. `admit` inserts `key` and sifts it up;
 * `discharge` extracts the most urgent (the root) and sinks the filler; `retriage`
 * replaces the severity at `slot` with `newKey` and re-sifts. The fields that a
 * phase does not use stay undefined.
 */
export interface SynthesisStepSpec {
  phase: SynthesisPhase
  /** Admit only: the severity admitted. */
  key?: number
  /** Re-triage only: the slot whose severity changes. */
  slot?: number
  /** Re-triage only: the new severity at `slot`. */
  newKey?: number
}

/**
 * The live state of the active multi-step ER synthesis: a fixed plan of ER ops
 * (admit / discharge / re-triage) plus the heap committed so far and the live
 * per-step `SiftBeat` for the op currently being performed. The learner performs
 * every sift themselves (reusing the do-the-sift mechanic per op); when one op
 * settles the model commits its heap and opens the next, auto-settling any op that
 * needs no swap so the learner always faces a real swap. It is solved once every
 * step is placed, which (because each step follows the `siftUp` / `siftDownExtract`
 * / `siftFrom` line) is exactly when the final result is a valid max-heap. Pure:
 * `applySynthesisSwap` returns a fresh beat and never mutates its input. It is the
 * heap analog of the Linked Lists playlist synthesis (one graded slot, many steps).
 */
export interface SynthesisBeat {
  /** The full ordered ER plan, fixed when the beat opens. */
  steps: SynthesisStepSpec[]
  /** How many of `steps` are fully performed (inserted/extracted/re-sifted) so far. */
  stepIndex: number
  /** The heap after the first `stepIndex` steps (the committed arrangement, gap-free). */
  heap: number[]
  /** The live per-step sift for `steps[stepIndex]`, or null once every step is done. */
  sift: SiftBeat | null
}

/** Open the per-step sift for an ER op against the committed heap. */
function openSynthesisSift(heap: number[], step: SynthesisStepSpec): SiftBeat {
  if (step.phase === "admit") return siftBeatFromInsert(heap, step.key as number)
  if (step.phase === "discharge") return siftBeatFromExtract(heap)
  return siftBeatFromReTriage(heap, step.slot as number, step.newKey as number)
}

/**
 * Advance the synthesis past any step whose sift is already settled (an op that
 * needs no swap), committing each settled heap and opening the next op, until it
 * lands on one that needs a swap (or the whole plan is performed). This keeps every
 * learner-facing step a real swap.
 */
function settleSynthesis(beat: SynthesisBeat): SynthesisBeat {
  let { stepIndex, heap } = beat
  let sift = beat.sift
  while (sift && isSiftSolved(sift) && stepIndex < beat.steps.length) {
    heap = sift.heap // the op has settled into the committed heap
    stepIndex += 1
    sift = stepIndex < beat.steps.length ? openSynthesisSift(heap, beat.steps[stepIndex]) : null
  }
  return { steps: beat.steps, stepIndex, heap, sift }
}

/** Open an ER synthesis beat for a starting heap and an ER plan (admit/discharge/re-triage). */
export function synthesisBeatFromSteps(
  start: number[],
  steps: SynthesisStepSpec[],
): SynthesisBeat {
  const heap = start.slice()
  const sift = steps.length ? openSynthesisSift(heap, steps[0]) : null
  return settleSynthesis({ steps: steps.slice(), stepIndex: 0, heap, sift })
}

/**
 * Validate a learner-proposed swap against the current step's sift. A correct swap
 * advances that op and, if it settles, commits it and opens the next op (a fresh
 * beat, `accepted: true`); a wrong proposal is rejected and the SAME beat is
 * returned (`accepted: false`). Never mutates the input.
 */
export function applySynthesisSwap(
  beat: SynthesisBeat,
  a: number,
  b: number,
): { beat: SynthesisBeat; accepted: boolean } {
  if (!beat.sift) return { beat, accepted: false }
  const { beat: sift, accepted } = applySiftSwap(beat.sift, a, b)
  if (!accepted) return { beat, accepted: false }
  return { beat: settleSynthesis({ ...beat, sift }), accepted: true }
}

/** The current ER phase (the op being performed), or null once the synthesis is solved. */
export function synthesisPhase(beat: SynthesisBeat): SynthesisPhase | null {
  return beat.stepIndex < beat.steps.length ? beat.steps[beat.stepIndex].phase : null
}

/** The synthesis is solved once every step is performed AND the result is a valid max-heap. */
export function isSynthesisSolved(beat: SynthesisBeat): boolean {
  return beat.stepIndex >= beat.steps.length && isMaxHeap(beat.heap)
}

/** The final heap after applying a whole ER plan to a start heap (pure; for curating + tests). */
export function synthesisFinalHeap(start: number[], steps: SynthesisStepSpec[]): number[] {
  let heap = start.slice()
  for (const step of steps) {
    if (step.phase === "admit") heap = siftUp(heap, step.key as number).result
    else if (step.phase === "discharge") heap = siftDownExtract(heap).result
    else {
      const changed = heap.slice()
      changed[step.slot as number] = step.newKey as number
      heap = siftFrom(changed, step.slot as number).result
    }
  }
  return heap
}

/* -------------------- watched-build motion frames (teach, end to end) -------------------- */

/** One frame of a from-scratch build replay: a sift frame tagged with its insert. */
export interface BuildMotionFrame extends NodeMotionFrame {
  /** The key this frame's insert is placing. */
  key: number
  /** Which insert (0-based) in the sequence this frame belongs to. */
  insertIndex: number
}

/**
 * Expand a from-scratch build (repeated insert + sift up) into ONE chained frame
 * list a `FrameSequence` can auto-play end to end. Each key contributes its
 * `nodeMotionFrames` (the drop-in frame plus one frame per sift-up swap), tagged
 * with the key and insert index for captions; the heap accumulates across inserts,
 * so the last frame is the finished max-heap. Pure view over `nodeMotionFrames`
 * (and `siftUp` for the running heap): it never mutates the inputs.
 */
export function buildMotionFrames(keys: number[], startHeap: number[] = []): BuildMotionFrame[] {
  const frames: BuildMotionFrame[] = []
  let heap = startHeap.slice()
  keys.forEach((key, insertIndex) => {
    for (const frame of nodeMotionFrames({ kind: "insert", heap, key })) {
      frames.push({ ...frame, key, insertIndex })
    }
    heap = siftUp(heap, key).result
  })
  return frames
}

/* --------------------------- invariants (test guards) --------------------------- */

export const hasDistinctKeys = (h: number[]): boolean => new Set(h).size === h.length
export const isMaxHeap = (h: number[]): boolean =>
  h.every((_, i) => i === 0 || h[parentIndex(i)] > h[i])

/* ------------------------------ id helpers ------------------------------ */

/** An arrangement card's id is the heap serialized: distinct arrangements ⇒ distinct ids. */
export const heapId = (h: number[]): string => h.join(",")
/** The select id for a tapped slot, and its inverse. */
export const slotId = (i: number): string => `slot-${i}`
export const slotIndexOf = (id: string): number =>
  id.startsWith("slot-") ? Number(id.slice(5)) : -1

/* --------------------------------- shapes --------------------------------- */

export interface HeapOption {
  id: string
  heap: number[]
}

export interface HeapCost {
  word: CostWord
  count: number
  unit: string
}

export interface HeapsQuestion {
  kind: HeapsPart
  bin: HeapBin | null
  mode: HeapMode
  prompt: string
  /** The GIVEN heap the learner reasons over (distinct keys, valid max-heap). */
  heap: number[]
  insertKey: number | null
  /** The full insert sequence for build beats (watched-build + build-a-heap); null otherwise. */
  buildKeys: number[] | null
  /** The ordered ER plan for the synthesis beat (admit/discharge/re-triage); null otherwise. */
  synthesisSteps: SynthesisStepSpec[] | null
  /** Frame 0 for the why-replay (appended for sift-up, moved-to-root for sift-down). */
  startHeap: number[]
  /** The correct final arrangement (== heap for non-sift beats). */
  resultHeap: number[]
  /** Ordered swaps for the why-replay stepper ([] for non-sift beats). */
  path: SwapStep[]
  extracted: number | null
  /** Slot the question is about (maps): highlighted + family connectors drawn in both panels. */
  subjectSlot: number | null
  /** A tree-only highlight (the "same data" beat highlights a node; the learner finds its cell). */
  treeSlot: number | null
  slotIndex: number | null
  dir: "largerChild" | "parent" | null
  /** Arrangement cards (H1/H2/H4-place); [] for slot beats. */
  options: HeapOption[]
  /** Winning option id (arrangement), or `"slot-"+index` (slot beats). */
  answer: string
  /** Correct slot index for slot beats (DEV hook + reveal); null for arrangement beats. */
  correctSlot: number | null
  leaderboard: boolean
  cost: HeapCost | null
  /** The "scales" full-sort shown paired against the sift / peek. */
  sortCost: HeapCost | null
  hint: string
  nudge: string
  correct: string
  why: string
}

export interface HeapsState {
  seed: number
  rngState: number
  partIndex: number
  siftUpCorrect: number // 0..2 (two do-the-sift inserts)
  siftDownCorrect: number // 0..3 (two do-the-sift extracts + the ER extract skin)
  mappingCorrect: number // 0..2
  contrastCorrect: number // 0..2
  buildCorrect: number // 0..1 (the build bin)
  synthesisCorrect: number // 0..1 (the multi-step ER synthesis bin)
  attempts: number
  question: HeapsQuestion | null
  /**
   * The live do-the-sift beat for the active sift parts (the learner performs the
   * swaps). Null on every other beat. Working state only: it is rebuilt by
   * `enterPart`/`resume` from the curated question, never persisted.
   */
  sift: SiftBeat | null
  /**
   * The live build-a-heap beat (a key queue + the heap so far + the current insert's
   * sift). Null on every other beat. Working state only, rebuilt by `enterPart`/
   * `resume` from the curated question exactly like `sift`, never persisted.
   */
  build: BuildBeat | null
  /**
   * The live multi-step ER synthesis beat (the ER op plan + the heap so far + the
   * current op's sift). Null on every other beat. Working state only, rebuilt by
   * `enterPart`/`resume` from the curated question exactly like `sift` / `build`,
   * never persisted.
   */
  synthesis: SynthesisBeat | null
  /** Option id (arrangement) OR "slot-"+i (slot): the only working field. */
  selected: string | null
  wrongCount: number
  feedback: Feedback
  revealed: boolean
  showWhy: boolean
  combo: number
  completed: boolean
}

/* ----------------------------- deterministic rng ----------------------------- */

function rngNext(a: number): { value: number; next: number } {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, next: a }
}

function shuffle<T>(arr: T[], seed: number): { result: T[]; next: number } {
  const result = arr.slice()
  let a = seed
  for (let i = result.length - 1; i > 0; i--) {
    const r = rngNext(a)
    a = r.next
    const j = Math.floor(r.value * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return { result, next: a }
}

/* ----------------------- generated valid heaps (variety) ----------------------- */

/** Tuning for the seeded heap generator: an inclusive node-count range and value range. */
export interface HeapGenConfig {
  /** Inclusive [min, max] node count. Kept small so the dual view stays phone-legible. */
  size: [number, number]
  /** Inclusive [min, max] for the distinct integer keys (two digits read cleanly on a phone). */
  value: [number, number]
  /**
   * Minimum swaps the forced operation must take (default 1). The first rep of a
   * skill uses 1 (a gentle single swap); the second rep raises it so a bigger heap
   * actually travels a couple of levels instead of feeling baby.
   */
  minSwaps?: number
}

/** The tuned default: four to six nodes, two-digit keys, sized to read well on a phone. */
export const DEFAULT_HEAP_GEN: HeapGenConfig = { size: [4, 6], value: [10, 99] }

/**
 * Per-beat tuning for the do-the-sift reps. The "-1" beats are small and force a
 * single swap (the gentle first rep); the "-2" beats are strictly bigger (a wider,
 * non-overlapping node range) and force at least two swaps, so the heap reads as a
 * real, non-trivial sift instead of feeling baby. The "-2" beats top out at a heap
 * that draws as seven nodes on screen (insert appends one node; extract drops one),
 * the three-row layout already proven legible on a phone, so the figure never clips.
 * Node count varies per seed on the "-1" beats and is pinned on the "-2" beats, but
 * the keys and the sift path always vary, so a second run is never identical.
 * Two-digit keys throughout.
 */
export const SIFTUP1_GEN: HeapGenConfig = { size: [4, 5], value: [10, 99], minSwaps: 1 }
export const SIFTUP2_GEN: HeapGenConfig = { size: [6, 6], value: [10, 99], minSwaps: 2 }
export const SIFTDOWN1_GEN: HeapGenConfig = { size: [5, 6], value: [10, 99], minSwaps: 1 }
export const SIFTDOWN2_GEN: HeapGenConfig = { size: [7, 7], value: [10, 99], minSwaps: 2 }

/** A generated insert instance: a valid max-heap and a key whose insertion forces a real sift-up. */
export interface GeneratedInsert {
  heap: number[]
  key: number
}

/** A generated extract instance: a valid max-heap whose extract forces a real sift-down. */
export interface GeneratedExtract {
  heap: number[]
}

/** Pick `count` distinct integers from [lo, hi] in a seeded order (a shuffled slice of the range). */
function pickValues(
  count: number,
  lo: number,
  hi: number,
  seed: number,
): { values: number[]; next: number } {
  const pool: number[] = []
  for (let v = lo; v <= hi; v++) pool.push(v)
  const { result, next } = shuffle(pool, seed)
  return { values: result.slice(0, count), next }
}

/** Build a valid max-heap by inserting the given distinct values one at a time (reuses `siftUp`). */
function buildHeap(values: number[]): number[] {
  let heap: number[] = []
  for (const v of values) heap = siftUp(heap, v).result
  return heap
}

/** Pick a size in the inclusive config range from one rng step. */
function sizeFromConfig(config: HeapGenConfig, seed: number): { n: number; next: number } {
  const [smin, smax] = config.size
  const r = rngNext(seed)
  return { n: smin + Math.floor(r.value * (smax - smin + 1)), next: r.next }
}

/**
 * A seeded, deterministic max-heap plus an insert key guaranteed to force a sift-up
 * of at least `config.minSwaps` swaps (default 1): the key beats that many ancestors
 * of its landing slot. Same seed always yields the same instance, and every instance
 * is a valid max-heap with distinct keys. The fallback (essentially never reached for
 * sane configs) makes the key the overall maximum on a tall-enough heap, which climbs
 * to the root, so the swap-count invariant holds for every seed. The curated fixtures
 * stay usable where a fixed shape is required.
 */
export function generateInsertHeap(
  seed: number,
  config: HeapGenConfig = DEFAULT_HEAP_GEN,
): GeneratedInsert {
  const [lo, hi] = config.value
  const minSwaps = Math.max(1, config.minSwaps ?? 1)
  let a = seed
  for (let attempt = 0; attempt < 48; attempt++) {
    const sized = sizeFromConfig(config, a)
    a = sized.next
    const picked = pickValues(sized.n, lo, hi, a)
    a = picked.next
    const heap = buildHeap(picked.values)
    const used = new Set(heap)
    // Eligible keys are unused values whose insertion climbs at least minSwaps levels.
    const eligible: number[] = []
    for (let v = lo; v <= hi; v++) {
      if (used.has(v)) continue
      if (siftUp(heap, v).path.length >= minSwaps) eligible.push(v)
    }
    if (eligible.length === 0) continue
    const rk = rngNext(a)
    a = rk.next
    const key = eligible[Math.floor(rk.value * eligible.length)]
    return { heap, key }
  }
  // Fallback: the overall maximum dropped onto a descending-sorted heap climbs to
  // the root (path length = depth of the landing slot), guaranteeing minSwaps.
  const sized = sizeFromConfig(config, a)
  const n = Math.max(minSwaps + 1, sized.n)
  const picked = pickValues(n + 1, lo, hi, sized.next)
  const key = Math.max(...picked.values)
  return { heap: buildHeap(picked.values.filter((v) => v !== key)), key }
}

/**
 * A seeded, deterministic max-heap whose extract is guaranteed to force a sift-down
 * of at least `config.minSwaps` swaps (default 1): the last leaf, lifted to the root,
 * sinks that many levels. Same seed always yields the same instance. The fallback
 * builds a sorted-descending heap, whose lifted smallest leaf sinks to a leaf (its
 * depth grows with the size), so the swap-count invariant holds for every seed and
 * sane config.
 */
export function generateExtractHeap(
  seed: number,
  config: HeapGenConfig = DEFAULT_HEAP_GEN,
): GeneratedExtract {
  const [lo, hi] = config.value
  const minSwaps = Math.max(1, config.minSwaps ?? 1)
  let a = seed
  for (let attempt = 0; attempt < 48; attempt++) {
    const sized = sizeFromConfig(config, a)
    a = sized.next
    const picked = pickValues(sized.n, lo, hi, a)
    a = picked.next
    const heap = buildHeap(picked.values)
    if (siftDownExtract(heap).path.length >= minSwaps) return { heap }
  }
  const sized = sizeFromConfig(config, a)
  const n = Math.max(minSwaps + 3, sized.n)
  const picked = pickValues(n, lo, hi, sized.next)
  return { heap: picked.values.slice().sort((x, y) => y - x) }
}

/* ------------------------------ part predicates ------------------------------ */

const INTRO_PARTS: ReadonlySet<HeapsPart> = new Set([
  "demo",
  "teach-array",
  "teach-rule",
  "watched-build",
  "teach-extract",
])
/** The active "build a heap" beat: the learner inserts a sequence and sifts each key. */
const BUILD_PARTS: ReadonlySet<HeapsPart> = new Set(["build-a-heap"])
/**
 * The active "do the sift" beats: the learner performs each swap (insert sifts up,
 * extract sinks the new root). The ER extract skin (`siftup-skin`) is now a
 * do-the-sift discharge too (extract + sift down), so it sits in the siftDown bin
 * and renders on the ER board; only its figure differs from the plain reps.
 */
const SIFT_PARTS: ReadonlySet<HeapsPart> = new Set([
  "siftup-1",
  "siftup-2",
  "siftdown-1",
  "siftdown-2",
  "siftup-skin",
])
const ARRANGEMENT_PARTS: ReadonlySet<HeapsPart> = new Set(["contrast-place"])
const SLOT_PARTS: ReadonlySet<HeapsPart> = new Set([
  "map-child",
  "map-parent",
  "contrast-samedata",
])
/** The multi-step ER synthesis (admit + discharge + re-triage), graded as one slot. */
const SYNTHESIS_PARTS: ReadonlySet<HeapsPart> = new Set(["er-synthesis"])

export const isIntroPart = (part: HeapsPart): boolean => INTRO_PARTS.has(part)
export const isArrangementPart = (part: HeapsPart): boolean => ARRANGEMENT_PARTS.has(part)
export const isSlotPart = (part: HeapsPart): boolean => SLOT_PARTS.has(part)
/** A do-the-sift beat: the verdict is performed (swaps), not picked. */
export const isSiftPart = (part: HeapsPart): boolean => SIFT_PARTS.has(part)
/** A build-a-heap beat: the learner builds a heap by sifting each inserted key. */
export const isBuildPart = (part: HeapsPart): boolean => BUILD_PARTS.has(part)
/** A multi-step ER synthesis beat: the learner performs a sequence of ER ops. */
export const isSynthesisPart = (part: HeapsPart): boolean => SYNTHESIS_PARTS.has(part)

/** Open the do-the-sift beat for a sift question (insert sifts up, extract sinks). */
function siftBeatFor(q: HeapsQuestion): SiftBeat | null {
  if (q.insertKey != null) return siftBeatFromInsert(q.heap, q.insertKey)
  if (q.extracted != null) return siftBeatFromExtract(q.heap)
  return null
}

/** Open the build-a-heap working model for a build question (its key sequence). */
function buildBeatFor(q: HeapsQuestion): BuildBeat | null {
  return q.buildKeys != null ? buildBeatFromKeys(q.buildKeys) : null
}

/** Open the ER synthesis working model for a synthesis question (its start heap + plan). */
function synthesisBeatFor(q: HeapsQuestion): SynthesisBeat | null {
  return q.synthesisSteps != null ? synthesisBeatFromSteps(q.heap, q.synthesisSteps) : null
}

function binOf(part: HeapsPart): HeapBin | null {
  if (part === "siftup-1" || part === "siftup-2") return "siftUp"
  if (part === "build-a-heap") return "build"
  if (part === "siftdown-1" || part === "siftdown-2" || part === "siftup-skin") return "siftDown"
  if (part === "map-child" || part === "map-parent") return "mapping"
  if (part === "contrast-place" || part === "contrast-samedata") return "contrast"
  if (part === "er-synthesis") return "synthesis"
  return null
}

/* ------------------------------ curated beat data ------------------------------ */

/**
 * The worked-values fixture. The ground truth the build (and tests) grade on.
 * Every `heap` is a complete, max-heap with distinct integer keys; every sift
 * path is therefore unique.
 */
const CURATED = {
  demo: { heap: [7, 5, 6, 3, 2] },
  "teach-array": { heap: [9, 7, 6, 3, 2] },
  "teach-rule": { heap: [9, 7, 6, 3, 2] },
  // ER extract skin (repurposed): discharging the top (90) sinks the filler (40)
  // two levels for a non-trivial do-the-sift down on the ER board.
  "siftup-skin": { heap: [90, 70, 50, 60, 40] },
  // Watch-it-built (teach): a five-key build that drops, climbs, and once sits still.
  "watched-build": { keys: [12, 30, 24, 41, 35] },
  // Build-it-yourself (graded): a six-key sequence with a mix of one- and two-level
  // sifts and one already-in-place insert, ~5 learner swaps (gallery-tunable).
  "build-a-heap": { keys: [18, 27, 24, 40, 33, 36] },
  // Realistic severities so the ER monitor never shows a "severity 9" patient;
  // extracting 90 sinks the filler (30) two levels for an illustrative demo.
  "teach-extract": { heap: [90, 80, 70, 40, 30] },
  "map-child": { heap: [9, 7, 6, 3, 2], slot: 0, dir: "largerChild" as const },
  "map-parent": { heap: [9, 7, 6, 3, 2], slot: 4, dir: "parent" as const },
  "contrast-place": { heap: [8, 6, 7, 4, 3], key: 9 },
  "contrast-samedata": { heap: [9, 5, 8, 3, 2, 7], slot: 2 },
} as const

/**
 * The curated multi-step ER synthesis: a five-patient board, then three ER ops over
 * it as one graded slot. Admit severity 55 (sift up, 1 swap) -> [90,80,55,60,70,50];
 * discharge the most urgent 90 (sift down, 2 swaps) -> [80,70,55,60,50]; re-triage
 * slot 4 to 95 (the patient deteriorates; sift up, 2 swaps) -> [95,80,55,60,70].
 * Each op forces a real swap and the final board is a valid max-heap. The board
 * peaks at six patients (after admit) so it stays phone-legible. Gallery-tunable.
 */
const ER_SYNTHESIS: { start: number[]; steps: SynthesisStepSpec[] } = {
  start: [90, 80, 50, 60, 70],
  steps: [
    { phase: "admit", key: 55 },
    { phase: "discharge" },
    { phase: "retriage", slot: 4, newKey: 95 },
  ],
}

/**
 * The do-the-sift reps draw a fresh valid heap per lesson seed (the replay-variety
 * pilot) instead of a fixed fixture, so a second run is not identical. The "-2"
 * beats are strictly bigger and force a deeper sift than the "-1" beats. Curated
 * shapes are kept only where a fixed shape is pedagogically required (the ER skin,
 * the heap-vs-BST contrast, the mapping slots).
 */
const SIFT_GEN: Record<
  "siftup-1" | "siftup-2" | "siftdown-1" | "siftdown-2",
  HeapGenConfig
> = {
  "siftup-1": SIFTUP1_GEN,
  "siftup-2": SIFTUP2_GEN,
  "siftdown-1": SIFTDOWN1_GEN,
  "siftdown-2": SIFTDOWN2_GEN,
}

const opt = (h: number[]): HeapOption => ({ id: heapId(h), heap: h })

function dedupeById(opts: HeapOption[]): HeapOption[] {
  const seen = new Set<string>()
  const out: HeapOption[] = []
  for (const o of opts) {
    if (!seen.has(o.id)) {
      seen.add(o.id)
      out.push(o)
    }
  }
  return out
}

const swapWord = (n: number): string => (n === 1 ? "swap to sift" : "swaps to sift")
const arrowChain = (h: number[]): string => h.join(" · ")

/* ------------------------------ question makers ------------------------------ */

const BLANK = {
  insertKey: null,
  buildKeys: null,
  synthesisSteps: null,
  extracted: null,
  subjectSlot: null,
  treeSlot: null,
  slotIndex: null,
  dir: null,
  correctSlot: null,
  leaderboard: false,
  cost: null,
  sortCost: null,
} as const

function makeIntro(part: "demo" | "teach-array" | "teach-rule" | "teach-extract"): HeapsQuestion {
  const heap = CURATED[part].heap.slice()
  if (part === "teach-extract") {
    const { extracted, result, path, start } = siftDownExtract(heap)
    return {
      ...BLANK,
      kind: part,
      bin: null,
      mode: "intro",
      prompt:
      "Discharge the most urgent patient. The last one on the board moves up to the top spot, then sinks past anyone more urgent.",
      heap,
      startHeap: start,
      resultHeap: result,
      path,
      extracted,
      options: [],
      answer: "",
      cost: { word: "free", count: 1, unit: "jump to the top" },
      sortCost: { word: "scales", count: heap.length, unit: "items sorted" },
      hint: "",
      nudge: "",
      correct: "",
      why: "",
    }
  }
  const prompt =
    part === "demo"
      ? "Insert a key and watch it sift up. The tree and the array move together."
      : part === "teach-array"
        ? "The tree is just a picture. The real heap is one flat row."
        : "It looks sorted, but it barely orders anything."
  return {
    ...BLANK,
    kind: part,
    bin: null,
    mode: "intro",
    prompt,
    heap,
    startHeap: heap,
    resultHeap: heap,
    path: [],
    options: [],
    answer: "",
    subjectSlot: part === "teach-array" ? 1 : null,
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

/**
 * Sift-up do-the-sift (insert K, perform the swaps up). The heap + key are seeded-
 * generated for replay variety (siftup-2 bigger / deeper than siftup-1), so a second
 * run is not identical; the beat carries no arrangement cards (it is performed, not
 * picked). The rng advances one step so a reattempt yields a fresh instance.
 */
function makeSiftUpDo(
  part: "siftup-1" | "siftup-2",
  seed: number,
): { question: HeapsQuestion; next: number } {
  const { heap, key } = generateInsertHeap(seed, SIFT_GEN[part])
  const next = rngNext(seed).next
  const { result, path, start } = siftUp(heap, key)

  return {
    question: {
      ...BLANK,
      kind: part,
      bin: "siftUp",
      mode: "arrangement",
      prompt: `Insert ${key}, then sift it up. Tap the new node, then its parent, to swap.`,
      heap,
      insertKey: key,
      startHeap: start,
      resultHeap: result,
      path,
      options: [],
      answer: heapId(result),
      cost: { word: "barely grows", count: path.length, unit: swapWord(path.length) },
      sortCost: { word: "scales", count: result.length, unit: "items sorted" },
      hint: "",
      nudge: "It rises only while it beats its parent, and it never reshuffles the whole tree.",
      correct: `${path.length} ${swapWord(path.length)}, it settles at ${arrowChain(result)}.`,
      why: `${key} appends at the end, then swaps up past each smaller parent, ${path.length} ${swapWord(
        path.length,
      )}, no full reshuffle: ${arrowChain(result)}.`,
    },
    next,
  }
}

/** Heap-vs-BST placement (contrast, pick a card). Distractors: sorted/BST, stop-one-early, appended-no-sift. */
function makeContrastPlace(seed: number): { question: HeapsQuestion; next: number } {
  const spec = CURATED["contrast-place"]
  const heap = spec.heap.slice()
  const key = spec.key
  const { result, path, start } = siftUp(heap, key)
  const sorted = start.slice().sort((a, b) => b - a) // the BST / fully-sorted foil
  const stopEarly = applySwaps(start, path, Math.max(0, path.length - 1))
  const noSift = start.slice() // appended, never sifted (wrong direction)

  const options = dedupeById([opt(result), opt(sorted), opt(stopEarly), opt(noSift)])
  const sh = shuffle(options, seed)

  return {
    question: {
      ...BLANK,
      kind: "contrast-place",
      bin: "contrast",
      mode: "arrangement",
      prompt: `Insert ${key} into this HEAP (not a BST). Which arrangement is right?`,
      heap,
      insertKey: key,
      startHeap: start,
      resultHeap: result,
      path,
      options: sh.result,
      answer: heapId(result),
      cost: { word: "barely grows", count: path.length, unit: swapWord(path.length) },
      sortCost: { word: "scales", count: result.length, unit: "items sorted" },
      hint: "",
      nudge: "It rises only while it beats its parent, and it never reshuffles the whole tree.",
      correct: `A heap places by shape-then-sift, not by value. ${arrowChain(result)}.`,
      why: `A BST would order everything by value (the sorted card). A heap only appends at the next open slot and swaps up while it beats its parent, so ${key} lands at ${arrowChain(result)}, not in sorted order.`,
    },
    next: sh.next,
  }
}

/**
 * The ER extract skin (repurposed `siftup-skin`): discharge the most urgent patient
 * (extract the top, then sink the new top past the more urgent child) as a do-the-
 * sift on the ER board. A curated, fixed ER board, performed (swaps) not picked, so
 * it grades the extract / sift-down skill in the siftDown bin. The `leaderboard`
 * flag keeps it on the full-screen ER monitor skin.
 */
function makeERExtract(): HeapsQuestion {
  const heap = CURATED["siftup-skin"].heap.slice()
  const { extracted, result, path, start } = siftDownExtract(heap)
  return {
    ...BLANK,
    kind: "siftup-skin",
    bin: "siftDown",
    mode: "arrangement",
    prompt: `Discharge the most urgent patient (severity ${extracted}). Sink the new top by tapping it, then its more urgent child, to swap.`,
    heap,
    startHeap: start,
    resultHeap: result,
    path,
    extracted,
    options: [],
    answer: heapId(result),
    leaderboard: true,
    cost: { word: "barely grows", count: path.length, unit: swapWord(path.length) },
    sortCost: { word: "scales", count: result.length, unit: "items sorted" },
    hint: "",
    nudge: "Promote the more urgent child; keep sinking only while a child outranks the patient on top.",
    correct: `${path.length} ${swapWord(path.length)}, the board settles at ${arrowChain(result)}.`,
    why: `Discharging the top moves the last patient (${start[0]}) to the top, then they trade down with the more urgent child while that child outranks them. ${arrowChain(result)}.`,
  }
}

/**
 * The multi-step ER synthesis (graded as ONE slot, the new `synthesis` bin): run a
 * sequence of ER ops on one board, performing every sift. The working model lives in
 * `state.synthesis`; the question carries the start board plus the ER plan (`steps`),
 * and `resultHeap` is the final valid board for the reveal.
 */
function makeSynthesis(): HeapsQuestion {
  const start = ER_SYNTHESIS.start.slice()
  const steps = ER_SYNTHESIS.steps.map((s) => ({ ...s }))
  const result = synthesisFinalHeap(start, steps)
  return {
    ...BLANK,
    kind: "er-synthesis",
    bin: "synthesis",
    mode: "synthesis",
    prompt: "Run the ER board by admitting the new patient, discharging the most urgent, then re-triaging.",
    heap: start,
    synthesisSteps: steps,
    startHeap: start,
    resultHeap: result,
    path: [],
    options: [],
    answer: heapId(result),
    cost: { word: "barely grows", count: steps.length, unit: "ER ops" },
    sortCost: { word: "scales", count: result.length, unit: "items sorted" },
    hint: "",
    nudge: "One op at a time. Admit sifts up, discharge sinks the new top, re-triage re-sifts the changed patient.",
    correct: `The board holds through every op. ${arrowChain(result)}.`,
    why: `Admit, discharge, and re-triage each touch only one path. Insert sifts up, extract sinks the new top past the more urgent child, and a changed severity re-sifts up or down. The board stays valid throughout, settling at ${arrowChain(result)}.`,
  }
}

/**
 * Sift-down do-the-sift (extract top, perform the swaps down). The heap is seeded-
 * generated for replay variety (siftdown-2 bigger / deeper than siftdown-1), and the
 * beat is performed, not picked. The rng advances one step so a reattempt yields a
 * fresh instance.
 */
function makeSiftDownDo(
  part: "siftdown-1" | "siftdown-2",
  seed: number,
): { question: HeapsQuestion; next: number } {
  const { heap } = generateExtractHeap(seed, SIFT_GEN[part])
  const next = rngNext(seed).next
  const { extracted, result, path, start } = siftDownExtract(heap)

  return {
    question: {
      ...BLANK,
      kind: part,
      bin: "siftDown",
      mode: "arrangement",
      prompt: `Extract the top (${extracted}). Sink the new root by tapping it, then its larger child, to swap.`,
      heap,
      startHeap: start,
      resultHeap: result,
      path,
      extracted,
      options: [],
      answer: heapId(result),
      cost: { word: "barely grows", count: path.length, unit: swapWord(path.length) },
      sortCost: { word: "scales", count: result.length, unit: "items sorted" },
      hint: "",
      nudge: "Compare the larger child first; keep sinking only while a child beats the node.",
      correct: `${path.length} ${swapWord(path.length)}, it settles at ${arrowChain(result)}.`,
      why: `Taking the top moves the last item (${start[0]}) to the root, then it trades with the larger child while that child beats it: ${arrowChain(
        result,
      )}. Trading the smaller child would break the rule.`,
    },
    next,
  }
}

/** Index-map locate (tap a slot): larger child of `i`, or parent of `j`. */
function makeMapping(part: "map-child" | "map-parent"): HeapsQuestion {
  const spec = CURATED[part]
  const heap = spec.heap.slice()
  const slot = spec.slot
  const dir = spec.dir
  const answerSlot = mappingAnswer(heap, slot, dir)
  const childPrompt = `Slot ${slot} holds ${heap[slot]}. Tap the slot of its LARGER child.`
  const parentPrompt = `Slot ${slot} holds ${heap[slot]}. Tap the slot of its PARENT.`
  return {
    ...BLANK,
    kind: part,
    bin: "mapping",
    mode: "slot",
    prompt: dir === "parent" ? parentPrompt : childPrompt,
    heap,
    startHeap: heap,
    resultHeap: heap,
    path: [],
    subjectSlot: slot,
    slotIndex: slot,
    dir,
    options: [],
    answer: slotId(answerSlot),
    correctSlot: answerSlot,
    hint: "",
    nudge:
      dir === "parent"
        ? "Take (i−1), then halve it and round down."
        : "Compute both child slots, then compare their keys.",
    correct:
      dir === "parent"
        ? `Parent of slot ${slot} is slot ${answerSlot} (${heap[answerSlot]}).`
        : `The larger child of slot ${slot} is slot ${answerSlot} (${heap[answerSlot]}).`,
    why:
      dir === "parent"
        ? `(${slot}−1)/2 = ${answerSlot}, so slot ${slot}'s parent is slot ${answerSlot}. Pure arithmetic, no pointers.`
        : `Slot ${slot}'s children are slots ${leftIndex(slot)} (${heap[leftIndex(slot)]}) and ${rightIndex(
            slot,
          )} (${heap[rightIndex(slot)]}); the larger is slot ${answerSlot}.`,
  }
}

/** Watch-it-built (teach): a from-scratch build of a heap, animated end to end. */
function makeWatchedBuild(): HeapsQuestion {
  const keys = CURATED["watched-build"].keys.slice()
  const result = buildHeap(keys)
  return {
    ...BLANK,
    kind: "watched-build",
    bin: null,
    mode: "intro",
    prompt: "Watch a heap built from nothing. Each key drops in, then climbs while it beats its parent.",
    heap: result,
    buildKeys: keys,
    startHeap: [],
    resultHeap: result,
    path: [],
    options: [],
    answer: "",
    cost: { word: "barely grows", count: keys.length, unit: "keys inserted" },
    sortCost: { word: "scales", count: result.length, unit: "items sorted" },
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

/** Build-it-yourself (graded): insert a sequence, sifting each key up, into a valid heap. */
function makeBuild(): HeapsQuestion {
  const keys = CURATED["build-a-heap"].keys.slice()
  const result = buildHeap(keys)
  return {
    ...BLANK,
    kind: "build-a-heap",
    bin: "build",
    mode: "build",
    prompt: "Build the heap. Drop in each key, then sift it up until the heap rule holds.",
    heap: [],
    buildKeys: keys,
    startHeap: [],
    resultHeap: result,
    path: [],
    options: [],
    answer: heapId(result),
    hint: "",
    nudge: "A new key rises only while it beats its parent. Tap the climbing key, then its parent, to swap.",
    correct: `You built it. ${arrowChain(result)}. Each key sifted up, never a full reshuffle.`,
    why: `Building inserts one key at a time and sifts each up while it beats its parent. The result is a valid heap, ${arrowChain(
      result,
    )}, without ever sorting the whole row.`,
  }
}

/** Same-data locate (tap a slot): a highlighted TREE node ⇔ the array CELL at the same index. */
function makeSameData(): HeapsQuestion {
  const spec = CURATED["contrast-samedata"]
  const heap = spec.heap.slice()
  const slot = spec.slot
  return {
    ...BLANK,
    kind: "contrast-samedata",
    bin: "contrast",
    mode: "slot",
    prompt: `This tree node holds ${heap[slot]}. Tap the array cell that stores the SAME data.`,
    heap,
    startHeap: heap,
    resultHeap: heap,
    path: [],
    treeSlot: slot,
    slotIndex: slot,
    options: [],
    answer: slotId(slot),
    correctSlot: slot,
    hint: "",
    nudge: "It isn't placed by value; the cell index matches the node's index exactly.",
    correct: `Same data, same index. The node is array cell ${slot} (${heap[slot]}).`,
    why: `The tree is just a view of the array. Node ${slot} and cell ${slot} are the same ${heap[slot]}. A BST might sort by value, but a heap's array packing follows the tree position, not the value.`,
  }
}

/* ------------------------------- construction ------------------------------- */

function buildQuestion(part: HeapsPart, seed: number): { question: HeapsQuestion; next: number } {
  if (part === "demo" || part === "teach-array" || part === "teach-rule" || part === "teach-extract") {
    return { question: makeIntro(part), next: seed }
  }
  if (part === "watched-build") return { question: makeWatchedBuild(), next: seed }
  if (part === "build-a-heap") return { question: makeBuild(), next: seed }
  if (part === "er-synthesis") return { question: makeSynthesis(), next: seed }
  if (part === "siftup-1" || part === "siftup-2") {
    return makeSiftUpDo(part, seed)
  }
  if (part === "siftup-skin") return { question: makeERExtract(), next: seed }
  if (part === "contrast-place") return makeContrastPlace(seed)
  if (part === "siftdown-1" || part === "siftdown-2") {
    return makeSiftDownDo(part, seed)
  }
  if (part === "map-child" || part === "map-parent") {
    return { question: makeMapping(part), next: seed }
  }
  return { question: makeSameData(), next: seed }
}

const FRESH = {
  selected: null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
}

function enterPart(state: HeapsState, index: number): HeapsState {
  const part = HEAPS_PARTS[index]
  const { question, next } = buildQuestion(part, state.rngState)
  const sift = isSiftPart(part) ? siftBeatFor(question) : null
  const build = isBuildPart(part) ? buildBeatFor(question) : null
  const synthesis = isSynthesisPart(part) ? synthesisBeatFor(question) : null
  return { ...state, partIndex: index, ...FRESH, question, sift, build, synthesis, rngState: next }
}

export function createHeaps(seed: number = Date.now()): HeapsState {
  const init: HeapsState = {
    seed,
    rngState: seed,
    partIndex: 0,
    siftUpCorrect: 0,
    siftDownCorrect: 0,
    mappingCorrect: 0,
    contrastCorrect: 0,
    buildCorrect: 0,
    synthesisCorrect: 0,
    attempts: 0,
    question: null,
    sift: null,
    build: null,
    synthesis: null,
    selected: null,
    wrongCount: 0,
    feedback: "idle",
    revealed: false,
    showWhy: false,
    combo: 0,
    completed: false,
  }
  return enterPart(init, 0)
}

/* -------------------------------- selectors -------------------------------- */

export function currentPartHeaps(state: HeapsState): HeapsPart {
  return HEAPS_PARTS[state.partIndex]
}

/** A verdict is terminal once correct or failed: the question locks. */
export function isTerminalHeaps(state: HeapsState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledPartsHeaps(state: HeapsState): number {
  return state.completed ? HEAPS_TOTAL_PARTS : state.partIndex
}

function binProgress(state: HeapsState, bin: HeapBin): number {
  if (bin === "siftUp") return state.siftUpCorrect
  if (bin === "siftDown") return state.siftDownCorrect
  if (bin === "mapping") return state.mappingCorrect
  if (bin === "build") return state.buildCorrect
  if (bin === "synthesis") return state.synthesisCorrect
  return state.contrastCorrect
}

/** Reps required to clear a bin: build/synthesis take one, siftDown three, the rest two each. */
const binTarget = (bin: HeapBin): number =>
  bin === "build"
    ? BUILD_QUOTA
    : bin === "synthesis"
      ? SYNTHESIS_QUOTA
      : bin === "siftDown"
        ? SIFTDOWN_QUOTA
        : BIN_QUOTA

/** The cumulative "n of 11" header for a graded beat (sum of the six capped counters). */
export function partQuotaHeaps(state: HeapsState): { done: number; total: number } | null {
  const bin = binOf(currentPartHeaps(state))
  if (!bin) return null
  const done =
    Math.min(BIN_QUOTA, state.siftUpCorrect) +
    Math.min(SIFTDOWN_QUOTA, state.siftDownCorrect) +
    Math.min(BIN_QUOTA, state.mappingCorrect) +
    Math.min(BIN_QUOTA, state.contrastCorrect) +
    Math.min(BUILD_QUOTA, state.buildCorrect) +
    Math.min(SYNTHESIS_QUOTA, state.synthesisCorrect)
  return { done, total: GATE_TOTAL }
}

/** Progress within the current bin (e.g. "Sift up · 1 / 2"), or null on intro/teach. */
export function binQuotaHeaps(state: HeapsState): { bin: HeapBin; done: number; total: number } | null {
  const bin = binOf(currentPartHeaps(state))
  if (!bin) return null
  return { bin, done: binProgress(state, bin), total: binTarget(bin) }
}

/** The hard mastery gate: clear all six bins (2 + 3 + 2 + 2 + 1 + 1 = 11). */
export function isCompleteHeaps(state: HeapsState): boolean {
  return (
    state.siftUpCorrect >= BIN_QUOTA &&
    state.siftDownCorrect >= SIFTDOWN_QUOTA &&
    state.mappingCorrect >= BIN_QUOTA &&
    state.contrastCorrect >= BIN_QUOTA &&
    state.buildCorrect >= BUILD_QUOTA &&
    state.synthesisCorrect >= SYNTHESIS_QUOTA
  )
}

export function hasProgressHeaps(state: HeapsState): boolean {
  return (
    state.partIndex > 0 ||
    state.siftUpCorrect > 0 ||
    state.siftDownCorrect > 0 ||
    state.mappingCorrect > 0 ||
    state.contrastCorrect > 0 ||
    state.buildCorrect > 0 ||
    state.synthesisCorrect > 0
  )
}

/* --------------------------------- reducer --------------------------------- */

function bumpBin(state: HeapsState, bin: HeapBin): void {
  if (bin === "siftUp") state.siftUpCorrect = Math.min(BIN_QUOTA, state.siftUpCorrect + 1)
  else if (bin === "siftDown")
    state.siftDownCorrect = Math.min(SIFTDOWN_QUOTA, state.siftDownCorrect + 1)
  else if (bin === "mapping")
    state.mappingCorrect = Math.min(BIN_QUOTA, state.mappingCorrect + 1)
  else if (bin === "build") state.buildCorrect = Math.min(BUILD_QUOTA, state.buildCorrect + 1)
  else if (bin === "synthesis")
    state.synthesisCorrect = Math.min(SYNTHESIS_QUOTA, state.synthesisCorrect + 1)
  else state.contrastCorrect = Math.min(BIN_QUOTA, state.contrastCorrect + 1)
}

export function heapsReducer(state: HeapsState, action: LessonAction): HeapsState {
  const part = currentPartHeaps(state)

  switch (action.type) {
    case "continue": {
      if (!isIntroPart(part)) return state
      if (state.partIndex >= HEAPS_TOTAL_PARTS - 1) return state
      return enterPart(state, state.partIndex + 1)
    }

    case "select": {
      if (isTerminalHeaps(state)) return state
      if (isSiftPart(part) || isBuildPart(part) || isSynthesisPart(part)) {
        // First tap holds a node; tapping the held node again releases it.
        const held = state.selected === action.letter ? null : action.letter
        return { ...state, selected: held, feedback: "idle" }
      }
      if (!isArrangementPart(part) && !isSlotPart(part)) return state
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    // A do-the-sift / build swap: the learner proposes trading two slots. The shared
    // rewire gesture carries the two slot ids; the engine validates the move against
    // the correct sift line and only advances on the next correct swap.
    case "rewire": {
      if (isTerminalHeaps(state)) return state
      const a = slotIndexOf(action.from)
      const b = slotIndexOf(action.to)
      if (a < 0 || b < 0) return state

      // build-a-heap: each accepted swap advances the current insert (and the model
      // auto-settles any zero-swap inserts); placing the whole sequence grades it.
      if (isBuildPart(part)) {
        if (!state.build) return state
        const { beat, accepted } = applyBuildSwap(state.build, a, b)
        if (!accepted) {
          // A wrong sub-move is a brief nudge: the build does not advance and the
          // combo/wrong-count are untouched (no fail wall on build-a-heap).
          return { ...state, feedback: "nudge", attempts: state.attempts + 1 }
        }
        if (!isBuildSolved(beat)) {
          return {
            ...state,
            build: beat,
            selected: null,
            feedback: "idle",
            attempts: state.attempts + 1,
          }
        }
        // The whole heap is built: grade correct (combo climbs) and bump the build bin.
        const v = gradeAnswer(state, true)
        const next: HeapsState = {
          ...state,
          build: beat,
          selected: null,
          feedback: v.feedback,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        bumpBin(next, "build")
        return next
      }

      // er-synthesis: each accepted swap advances the current ER op (and the model
      // auto-settles any zero-swap op); performing the whole plan grades it as one slot.
      if (isSynthesisPart(part)) {
        if (!state.synthesis) return state
        const { beat, accepted } = applySynthesisSwap(state.synthesis, a, b)
        if (!accepted) {
          // A wrong sub-move is a brief nudge: the synthesis does not advance and the
          // combo/wrong-count are untouched (no fail wall on the synthesis).
          return { ...state, feedback: "nudge", attempts: state.attempts + 1 }
        }
        if (!isSynthesisSolved(beat)) {
          return {
            ...state,
            synthesis: beat,
            selected: null,
            feedback: "idle",
            attempts: state.attempts + 1,
          }
        }
        // Every ER op is performed: grade correct (combo climbs) and bump the synthesis bin.
        const v = gradeAnswer(state, true)
        const next: HeapsState = {
          ...state,
          synthesis: beat,
          selected: null,
          feedback: v.feedback,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        bumpBin(next, "synthesis")
        return next
      }

      if (!isSiftPart(part) || !state.sift) return state
      const bin = binOf(part)
      if (!bin) return state
      const { beat, accepted } = applySiftSwap(state.sift, a, b)
      if (!accepted) {
        // A wrong move is a brief nudge: the puzzle does not advance and the
        // combo/wrong-count are untouched (no fail wall on do-the-sift).
        return { ...state, feedback: "nudge", attempts: state.attempts + 1 }
      }
      if (!isSiftSolved(beat)) {
        return {
          ...state,
          sift: beat,
          selected: null,
          feedback: "idle",
          attempts: state.attempts + 1,
        }
      }
      // The settled heap clears the beat: grade correct (combo climbs) and bump
      // the same bin the arrangement-select beat used.
      const v = gradeAnswer(state, true)
      const next: HeapsState = {
        ...state,
        sift: beat,
        selected: null,
        feedback: v.feedback,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
      }
      bumpBin(next, bin)
      return next
    }

    case "check": {
      if (!state.question || isTerminalHeaps(state)) return state
      // do-the-sift, build-a-heap, and the ER synthesis commit via swaps, never Check.
      if (isSiftPart(part) || isBuildPart(part) || isSynthesisPart(part)) return state
      const bin = binOf(part)
      if (!bin || state.selected == null) return state

      const correct = state.selected === state.question.answer
      const v = gradeAnswer(state, correct)
      const next: HeapsState = {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
      }
      if (v.correct) bumpBin(next, bin)
      return next
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      // A fresh instance: re-shuffle arrangement options; reset the pick / sift / build / synthesis.
      const { question, next } = buildQuestion(part, state.rngState)
      const sift = isSiftPart(part) ? siftBeatFor(question) : null
      const build = isBuildPart(part) ? buildBeatFor(question) : null
      const synthesis = isSynthesisPart(part) ? synthesisBeatFor(question) : null
      return { ...state, ...FRESH, question, sift, build, synthesis, rngState: next }
    }

    case "next": {
      if (state.feedback !== "correct") return state
      if (state.partIndex >= HEAPS_TOTAL_PARTS - 1) {
        return { ...state, ...FRESH, completed: true }
      }
      return enterPart(state, state.partIndex + 1)
    }

    default:
      return state
  }
}

/* ----------------------------- resume / progress ----------------------------- */

export function toProgressHeaps(s: HeapsState): LessonProgress {
  return {
    counters: {
      siftUp: s.siftUpCorrect,
      siftDown: s.siftDownCorrect,
      mapping: s.mappingCorrect,
      contrast: s.contrastCorrect,
      build: s.buildCorrect,
      synthesis: s.synthesisCorrect,
      attempts: s.attempts,
    },
    currentPart: currentPartHeaps(s),
    completed: s.completed || isCompleteHeaps(s),
  }
}

function clampH(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), max)
}

export function resumeHeaps(progress: LessonProgress, seed: number = Date.now()): HeapsState {
  const base = createHeaps(seed)
  const c = progress.counters
  const seeded: HeapsState = {
    ...base,
    siftUpCorrect: clampH(c.siftUp ?? 0, BIN_QUOTA),
    siftDownCorrect: clampH(c.siftDown ?? 0, SIFTDOWN_QUOTA),
    mappingCorrect: clampH(c.mapping ?? 0, BIN_QUOTA),
    contrastCorrect: clampH(c.contrast ?? 0, BIN_QUOTA),
    buildCorrect: clampH(c.build ?? 0, BUILD_QUOTA),
    synthesisCorrect: clampH(c.synthesis ?? 0, SYNTHESIS_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, HEAPS_PARTS.indexOf(progress.currentPart as HeapsPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
