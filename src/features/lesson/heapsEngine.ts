import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Heaps lesson engine. One idea: a heap guarantees only
 * the *top* element — exactly enough to grab the best item cheaply — and it
 * secretly lives in an *array*, addressed by index arithmetic (children of slot
 * `i` are `2i+1` / `2i+2`, parent is `(i-1)/2`). Two mechanics, one idea:
 * predict the post-sift arrangement (insert sifts up; extract moves last→root
 * then sifts down, larger child first) and locate-the-position (the tree↔array
 * index map). Max-heap, fixed; distinct integer keys, so every sift path is
 * unique and no model call is ever needed.
 *
 * Twelve beats, eight graded behind the until-correct wall, aggregated into a
 * clean 2/2/2/2 gate across four bins (siftUp / siftDown / mapping / contrast).
 * Reuses the shared feedback machine + flame (`gradeAnswer`) and the same
 * LessonProgress shape; only the heap model, verdicts, and quotas are specific.
 * Deterministic (seeded): same state always yields the same question/feedback.
 * Tap-only — every commit is a `{ type: "select" }` (an arrangement-card id or a
 * `"slot-"+i` id); it consumes no rewire/drag surface.
 */

export const HEAPS_PARTS = [
  "demo", // 1  intro free-play: tap-insert; lands at next slot+leaf, sifts up; both panels sync
  "teach-array", // 2  teach: it secretly lives in an array — 2i+1 / 2i+2 / (i-1)/2 drawn in both
  "teach-rule", // 3  teach: the heap rule — parent beats both children, and that's ALL (not a BST)
  "siftup-1", // 4  H1 insert K → arrangement after sift-up (de-cued)        siftUp     ✓
  "siftup-skin", // 5  H1 leaderboard: a new score rises to its rank          siftUp     ✓
  "teach-extract", // 6  teach/demo: extract top — last→root, sift DOWN, larger child first
  "siftdown-1", // 7  H2 extract top → arrangement after sift-down (de-cued)  siftDown   ✓
  "siftdown-2", // 8  H2 extract top → arrangement after sift-down (deeper)   siftDown   ✓
  "map-child", // 9  H3 slot i's larger child lives at which slot? (tap)      mapping    ✓
  "map-parent", // 10 H3 slot j — who's its parent slot? (tap, reverse)       mapping    ✓
  "contrast-place", // 11a H4 where does K go in a HEAP vs a BST?             contrast   ✓
  "contrast-samedata", // 11b H4 tree node i ⇔ array cell i ("same data")     contrast   ✓
] as const
export type HeapsPart = (typeof HEAPS_PARTS)[number]
export const HEAPS_TOTAL_PARTS = HEAPS_PARTS.length // 12

/** Correct answers required per bin to clear the gate (a clean 2/2/2/2 = 8). */
export const BIN_QUOTA = 2
/** The hard mastery gate: 2 per bin × 4 bins. */
export const GATE_TOTAL = BIN_QUOTA * 4 // 8

export type HeapBin = "siftUp" | "siftDown" | "mapping" | "contrast"
/** How the learner answers a beat. */
export type HeapMode = "intro" | "arrangement" | "slot"

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

/** The smaller-child-first twin of extract — a wrong but tempting sift-down path. */
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

/* --------------------------- invariants (test guards) --------------------------- */

export const hasDistinctKeys = (h: number[]): boolean => new Set(h).size === h.length
export const isMaxHeap = (h: number[]): boolean =>
  h.every((_, i) => i === 0 || h[parentIndex(i)] > h[i])

/* ------------------------------ id helpers ------------------------------ */

/** An arrangement card's id is the heap serialized — distinct arrangements ⇒ distinct ids. */
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
  siftUpCorrect: number // 0..2
  siftDownCorrect: number // 0..2
  mappingCorrect: number // 0..2
  contrastCorrect: number // 0..2
  attempts: number
  question: HeapsQuestion | null
  /** Option id (arrangement) OR "slot-"+i (slot) — the only working field. */
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

/* ------------------------------ part predicates ------------------------------ */

const INTRO_PARTS: ReadonlySet<HeapsPart> = new Set([
  "demo",
  "teach-array",
  "teach-rule",
  "teach-extract",
])
const ARRANGEMENT_PARTS: ReadonlySet<HeapsPart> = new Set([
  "siftup-1",
  "siftup-skin",
  "siftdown-1",
  "siftdown-2",
  "contrast-place",
])
const SLOT_PARTS: ReadonlySet<HeapsPart> = new Set([
  "map-child",
  "map-parent",
  "contrast-samedata",
])

export const isIntroPart = (part: HeapsPart): boolean => INTRO_PARTS.has(part)
export const isArrangementPart = (part: HeapsPart): boolean => ARRANGEMENT_PARTS.has(part)
export const isSlotPart = (part: HeapsPart): boolean => SLOT_PARTS.has(part)

function binOf(part: HeapsPart): HeapBin | null {
  if (part === "siftup-1" || part === "siftup-skin") return "siftUp"
  if (part === "siftdown-1" || part === "siftdown-2") return "siftDown"
  if (part === "map-child" || part === "map-parent") return "mapping"
  if (part === "contrast-place" || part === "contrast-samedata") return "contrast"
  return null
}

/* ------------------------------ curated beat data ------------------------------ */

/**
 * The worked-values fixture — the ground truth the build (and tests) grade on.
 * Every `heap` is a complete, max-heap with distinct integer keys; every sift
 * path is therefore unique.
 */
const CURATED = {
  demo: { heap: [7, 5, 6, 3, 2] },
  "teach-array": { heap: [9, 7, 6, 3, 2] },
  "teach-rule": { heap: [9, 7, 6, 3, 2] },
  "siftup-1": { heap: [7, 5, 6, 3, 2], key: 8 },
  "siftup-skin": { heap: [95, 80, 90, 60, 50], key: 100 },
  "teach-extract": { heap: [9, 7, 6, 3, 2] },
  "siftdown-1": { heap: [9, 7, 6, 3, 2] },
  "siftdown-2": { heap: [10, 9, 5, 8, 7, 4, 3] },
  "map-child": { heap: [9, 7, 6, 3, 2], slot: 0, dir: "largerChild" as const },
  "map-parent": { heap: [9, 7, 6, 3, 2], slot: 4, dir: "parent" as const },
  "contrast-place": { heap: [8, 6, 7, 4, 3], key: 9 },
  "contrast-samedata": { heap: [9, 5, 8, 3, 2, 7], slot: 2 },
} as const

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
        "Take the top out: the LAST item jumps to the root, then sinks — always trading with the bigger child.",
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
      ? "Insert a key and watch it sift up — the tree and the array move together."
      : part === "teach-array"
        ? "It secretly lives in an array: a slot's children are 2·i+1 and 2·i+2; its parent is (i−1)/2."
        : "The heap rule: each parent beats BOTH its children — and that's the only promise. It is NOT sorted, NOT a BST."
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

/** Sift-up predict (insert K, sift up). Distractors: sorted/BST, stop-one-early, appended-no-sift. */
function makeSiftUpArrange(
  part: "siftup-1" | "siftup-skin" | "contrast-place",
  seed: number,
): { question: HeapsQuestion; next: number } {
  const spec = CURATED[part]
  const heap = spec.heap.slice()
  const key = spec.key
  const { result, path, start } = siftUp(heap, key)
  const sorted = start.slice().sort((a, b) => b - a) // the BST / fully-sorted foil
  const stopEarly = applySwaps(start, path, Math.max(0, path.length - 1))
  const noSift = start.slice() // appended, never sifted (wrong direction)

  const options = dedupeById([opt(result), opt(sorted), opt(stopEarly), opt(noSift)])
  const sh = shuffle(options, seed)
  const leaderboard = part === "siftup-skin"
  const contrast = part === "contrast-place"

  const prompt = contrast
    ? `Insert ${key} into this HEAP (not a BST) — which arrangement is right?`
    : leaderboard
      ? `A new score of ${key} arrives — where does it settle on the board?`
      : `Insert ${key}, then let it sift up. What's the arrangement after?`

  return {
    question: {
      ...BLANK,
      kind: part,
      bin: binOf(part),
      mode: "arrangement",
      prompt,
      heap,
      insertKey: key,
      startHeap: start,
      resultHeap: result,
      path,
      options: sh.result,
      answer: heapId(result),
      leaderboard,
      cost: { word: "barely grows", count: path.length, unit: swapWord(path.length) },
      sortCost: { word: "scales", count: result.length, unit: "items sorted" },
      hint: leaderboard
        ? "Drop the score at the next open seat, then let it climb past any score it beats."
        : "Append at the next open slot, then swap up while the new key beats its parent.",
      nudge: "It rises only while it beats its parent — and it never reshuffles the whole tree.",
      correct: contrast
        ? `A heap places by shape-then-sift, not by value: ${arrowChain(result)}.`
        : `${path.length} ${swapWord(path.length)} — it settles at ${arrowChain(result)}.`,
      why: contrast
        ? `A BST would order everything by value (the sorted card). A heap only appends at the next open slot and swaps up while it beats its parent — so ${key} lands at ${arrowChain(result)}, not in sorted order.`
        : `${key} appends at the end, then swaps up past each smaller parent — ${path.length} ${swapWord(
            path.length,
          )}, no full reshuffle: ${arrowChain(result)}.`,
    },
    next: sh.next,
  }
}

/** Sift-down predict (extract top). Distractors: smaller-child-first, stop-too-early, sorted. */
function makeSiftDownArrange(
  part: "siftdown-1" | "siftdown-2",
  seed: number,
): { question: HeapsQuestion; next: number } {
  const heap = CURATED[part].heap.slice()
  const { extracted, result, path, start } = siftDownExtract(heap)
  const smaller = siftDownSmallerChild(heap).result
  const stopEarly = applySwaps(start, path, Math.max(0, path.length - 1))
  const sorted = start.slice().sort((a, b) => b - a)

  const options = dedupeById([opt(result), opt(smaller), opt(stopEarly), opt(sorted)])
  const sh = shuffle(options, seed)

  return {
    question: {
      ...BLANK,
      kind: part,
      bin: "siftDown",
      mode: "arrangement",
      prompt: `Extract the top (${extracted}) — what's the arrangement after it sifts down?`,
      heap,
      startHeap: start,
      resultHeap: result,
      path,
      extracted,
      options: sh.result,
      answer: heapId(result),
      cost: { word: "barely grows", count: path.length, unit: swapWord(path.length) },
      sortCost: { word: "scales", count: result.length, unit: "items sorted" },
      hint: "The LAST item moves to the root, then sinks — always trade with the BIGGER child.",
      nudge: "Compare the larger child first; keep sinking only while a child beats the node.",
      correct: `${path.length} ${swapWord(path.length)} — it settles at ${arrowChain(result)}.`,
      why: `Taking the top moves the last item (${start[0]}) to the root, then it trades with the larger child while that child beats it: ${arrowChain(
        result,
      )}. Trading the smaller child would break the rule.`,
    },
    next: sh.next,
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
    hint:
      dir === "parent"
        ? "Parent of slot i is (i−1)/2, rounded down."
        : "Children of slot i are 2·i+1 and 2·i+2 — tap whichever holds the bigger key.",
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
        ? `(${slot}−1)/2 = ${answerSlot}, so slot ${slot}'s parent is slot ${answerSlot} — pure arithmetic, no pointers.`
        : `Slot ${slot}'s children are slots ${leftIndex(slot)} (${heap[leftIndex(slot)]}) and ${rightIndex(
            slot,
          )} (${heap[rightIndex(slot)]}); the larger is slot ${answerSlot}.`,
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
    hint: "The tree IS the array — a node and its cell share the same index.",
    nudge: "It isn't placed by value; the cell index matches the node's index exactly.",
    correct: `Same data, same index: the node is array cell ${slot} (${heap[slot]}).`,
    why: `The tree is just a view of the array — node ${slot} and cell ${slot} are the same ${heap[slot]}. A BST might sort by value, but a heap's array packing follows the tree position, not the value.`,
  }
}

/* ------------------------------- construction ------------------------------- */

function buildQuestion(part: HeapsPart, seed: number): { question: HeapsQuestion; next: number } {
  if (part === "demo" || part === "teach-array" || part === "teach-rule" || part === "teach-extract") {
    return { question: makeIntro(part), next: seed }
  }
  if (part === "siftup-1" || part === "siftup-skin" || part === "contrast-place") {
    return makeSiftUpArrange(part, seed)
  }
  if (part === "siftdown-1" || part === "siftdown-2") {
    return makeSiftDownArrange(part, seed)
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
  return { ...state, partIndex: index, ...FRESH, question, rngState: next }
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
    attempts: 0,
    question: null,
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

/** A verdict is terminal once correct or failed — the question locks. */
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
  return state.contrastCorrect
}

/** The cumulative "n of 8" header for a graded beat (sum of the four capped counters). */
export function partQuotaHeaps(state: HeapsState): { done: number; total: number } | null {
  const bin = binOf(currentPartHeaps(state))
  if (!bin) return null
  const done =
    Math.min(BIN_QUOTA, state.siftUpCorrect) +
    Math.min(BIN_QUOTA, state.siftDownCorrect) +
    Math.min(BIN_QUOTA, state.mappingCorrect) +
    Math.min(BIN_QUOTA, state.contrastCorrect)
  return { done, total: GATE_TOTAL }
}

/** Progress within the current bin (e.g. "Sift up · 1 / 2"), or null on intro/teach. */
export function binQuotaHeaps(state: HeapsState): { bin: HeapBin; done: number; total: number } | null {
  const bin = binOf(currentPartHeaps(state))
  if (!bin) return null
  return { bin, done: binProgress(state, bin), total: BIN_QUOTA }
}

/** The hard mastery gate: clear all four bins (2 + 2 + 2 + 2 = 8). */
export function isCompleteHeaps(state: HeapsState): boolean {
  return (
    state.siftUpCorrect >= BIN_QUOTA &&
    state.siftDownCorrect >= BIN_QUOTA &&
    state.mappingCorrect >= BIN_QUOTA &&
    state.contrastCorrect >= BIN_QUOTA
  )
}

export function hasProgressHeaps(state: HeapsState): boolean {
  return (
    state.partIndex > 0 ||
    state.siftUpCorrect > 0 ||
    state.siftDownCorrect > 0 ||
    state.mappingCorrect > 0 ||
    state.contrastCorrect > 0
  )
}

/* --------------------------------- reducer --------------------------------- */

function bumpBin(state: HeapsState, bin: HeapBin): void {
  if (bin === "siftUp") state.siftUpCorrect = Math.min(BIN_QUOTA, state.siftUpCorrect + 1)
  else if (bin === "siftDown")
    state.siftDownCorrect = Math.min(BIN_QUOTA, state.siftDownCorrect + 1)
  else if (bin === "mapping")
    state.mappingCorrect = Math.min(BIN_QUOTA, state.mappingCorrect + 1)
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
      if (!isArrangementPart(part) && !isSlotPart(part)) return state
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "check": {
      if (!state.question || isTerminalHeaps(state)) return state
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
      // A fresh instance: re-shuffle arrangement options; reset the pick.
      const { question, next } = buildQuestion(part, state.rngState)
      return { ...state, ...FRESH, question, rngState: next }
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
    siftDownCorrect: clampH(c.siftDown ?? 0, BIN_QUOTA),
    mappingCorrect: clampH(c.mapping ?? 0, BIN_QUOTA),
    contrastCorrect: clampH(c.contrast ?? 0, BIN_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, HEAPS_PARTS.indexOf(progress.currentPart as HeapsPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
