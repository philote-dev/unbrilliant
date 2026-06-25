import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Arrays / Dynamic Arrays engine (the redesign, see
 * docs/lessons/arrays.md). One idea: contiguity buys instant indexing (a jump,
 * not a scan) and charges a shift on every middle insert/delete; the end is
 * cheap, except when a full block must double-and-copy.
 *
 * The shipped version let a learner win by tapping a lit cell or reading a
 * pre-played row off the screen. This version is a curated set of 8 distinct,
 * de-cued problems across an Access face (A1 access, A3 access-vs-search), a
 * Mutation face (A2 shift, A2 real-world skin, A4 classify-by-position, A5
 * construct-to-target), and a Growth synthesis (A6 grow-predict + amortized
 * verdict), gated on all 8 behind the until-correct wall. Same idea, two
 * mechanics: predict-next-state (primary) + construct-to-target (the shared
 * drag/rewire infra).
 *
 * Deterministic + seedable: same state always yields the same question/verdict
 * (the no-AI guarantee). Reuses the shared feedback machine + flame
 * (`gradeAnswer`) and the same `LessonAction` / `LessonProgress` shapes; only
 * the structure model, verdicts, and gate are Arrays-specific.
 *
 * Resume migration note: an old run saved `{ shiftPredict / costCount /
 * resizePredict, currentPart: shift|cost|resize }` reads every new counter as 0
 * and an unknown `currentPart` resolves to part 0 (restart at the demo);
 * completed old runs keep `completed: true`, so the next lesson stays unlocked.
 */

export const ARRAYS_PARTS = [
  "demo", // 1 free play: tap to read, watch the address ruler (intro)
  "teach-access", // 2 name "instant access" - a jump, not a scan (teach)
  "a1-access", // 3 A1 de-cued "value at index k?" (graded)
  "a3-contrast", // 4 A3 index-jump vs value-scan (two asks, one gate) (graded)
  "shift-demo", // 5 free play: insert/delete, watch the ripple (intro)
  "teach-shift", // 6 name "the shift cascade" (contiguity forbids gaps) (teach)
  "a2-shift", // 7 A2 predict the resulting row (graded)
  "a2-skin", // 8 A2 real-world row-insert (graded)
  "a4-classify", // 9 A4 front / middle / end: cheapest? (graded)
  "a5-construct", // 10 A5 construct-to-target (append-pinned, drag) (graded)
  "a6-grow", // 11 A6 grow-predict + "was that append cheap?" (graded x2)
] as const
export type ArraysPart = (typeof ARRAYS_PARTS)[number]
export const ARRAYS_TOTAL_PARTS = ARRAYS_PARTS.length

/** The 8 graded sub-skills; mastery = all 8 cleared. */
export const ARRAYS_SKILLS = [
  "a1",
  "a3",
  "a2",
  "a2Skin",
  "a4",
  "a5",
  "a6Grow",
  "a6Cheap",
] as const
export type ArraysSkill = (typeof ARRAYS_SKILLS)[number]
export const ARRAYS_GATE = ARRAYS_SKILLS.length // 8

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]

export interface ArraysOption {
  id: string
  label: string
}

/**
 * The structural op a shift/skin question is about, kept as data (not parsed
 * from the prompt) so the pure frame selectors below can replay it
 * deterministically.
 */
export interface ArrayOp {
  kind: "insert" | "delete"
  index: number
  inserted?: string // the label dropped in (insert only)
}

/** What the grow question is over: a `size`-of-`capacity` block, full or not. */
export interface ArrayResize {
  size: number
  capacity: number
  resizes: boolean
}

/** How an A1 / A3 access beat phrases its de-cued ask. */
export type AskA1 = "value-at-k" | "last-element" | "first-element"
export type AskA3 = "index" | "value"

export interface ArraysQuestion {
  kind: ArraysPart
  prompt: string
  /** The strip contents (the row under consideration). */
  cells: string[]
  /** A1 ask variant, or the A3 sub-ask. */
  ask?: AskA1 | AskA3
  /** Index in question (A1 value-at-k, A3 index-ask). */
  k?: number
  /** Searched value (A3 value-ask); guaranteed unique in `cells`. */
  value?: string
  /** De-cued tap answer = a cell index (A1, A3). */
  answerIndex?: number
  /** A2 / A2-skin: drives the post-verdict ripple. */
  op?: ArrayOp
  /** A2 / A2-skin / A4 / A6 MCQ. */
  options?: ArraysOption[]
  /** Winning option id (MCQ beats). */
  answer?: string
  /** A4 classify-by-position parameters (front=n, middle=n-midK, end=0). */
  classify?: { n: number; midK: number }
  /** A5 construct: the desired final row, the given prefix, the unique appends. */
  target?: string[]
  partial?: string[]
  correctOps?: string[]
  /** A6 grow: drives the capacity-frame doubling. */
  resize?: ArrayResize
  /** The locked house word; the chip renders this verbatim. */
  cost: { word: CostWord; count: number; unit: string }
  hint: string
  nudge: string
  correct: string
  why: string
}

/** A5 construct working state (mirrors the S&Q ConstructWork). */
export interface ConstructWork {
  loose: string[] // cells not yet appended (display order)
  placed: string[] // cells appended so far, in append order
}

export interface ArraysState {
  seed: number
  rngState: number
  partIndex: number
  attempts: number
  combo: number
  completed: boolean
  // the 8 graded counters (each 0 | 1)
  a1: number
  a3: number
  a2: number
  a2Skin: number
  a4: number
  a5: number
  a6Grow: number
  a6Cheap: number
  question: ArraysQuestion | null
  selected: string | null // MCQ id OR the stringified de-cued tapped index
  construct: ConstructWork | null // A5 working state
  step: number // sub-step for two-ask beats (a3, a6): 0 | 1
  wrongCount: number
  feedback: Feedback
  revealed: boolean
  showWhy: boolean
}

/* ----------------------------- deterministic rng ----------------------------- */

function rngNext(a: number): { value: number; next: number } {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, next: a }
}

function rngInt(a: number, maxExclusive: number): { value: number; next: number } {
  const r = rngNext(a)
  return { value: Math.floor(r.value * maxExclusive), next: r.next }
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

function splice<T>(arr: T[], start: number, deleteCount: number, ...items: T[]): T[] {
  const copy = arr.slice()
  copy.splice(start, deleteCount, ...items)
  return copy
}

const join = (a: string[]) => a.join(" · ")
const plural = (n: number) => (n === 1 ? "" : "s")
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/* ------------------------------ question makers ------------------------------ */

/** Demo / teach beats: a read-only strip + naming copy, no graded answer. */
function makeIntro(part: ArraysPart): ArraysQuestion {
  const cells = LETTERS.slice(0, 5)
  const base = {
    kind: part,
    cells,
    cost: { word: "free" as CostWord, count: 1, unit: "step" },
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
  switch (part) {
    case "demo":
      return {
        ...base,
        prompt: "Tap any cell to read it. The ruler beneath is the address.",
      }
    case "teach-access":
      return {
        ...base,
        prompt: "Instant access: arr[k] is a jump straight to the address, not a walk.",
      }
    case "shift-demo":
      return {
        ...base,
        prompt: "Insert or delete in the middle, then watch the ripple of shifts.",
      }
    default: // teach-shift
      return {
        ...base,
        prompt: "The shift cascade: contiguity forbids gaps, so the tail slides over.",
      }
  }
}

/** A1 (beat 3): de-cued access. The answer is a cell index; the de-cue is purely
 * presentational (no lit cell), the answer stays a pure function of 0-indexing. */
function makeA1(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const cells = LETTERS.slice(0, 6)
  const n = cells.length
  let r = rngInt(a, 3)
  a = r.next
  const ask: AskA1 = r.value === 0 ? "last-element" : r.value === 1 ? "first-element" : "value-at-k"

  let answerIndex: number
  let prompt: string
  if (ask === "first-element") {
    answerIndex = 0
    prompt = "Tap the first element."
  } else if (ask === "last-element") {
    answerIndex = n - 1
    prompt = "Tap the last element."
  } else {
    r = rngInt(a, n - 2)
    a = r.next
    answerIndex = 2 + r.value // 2..n-1, so counting from 0 actually matters
    prompt = `Tap the value at index ${answerIndex}.`
  }
  const value = cells[answerIndex]
  const why =
    ask === "last-element"
      ? `The last index is ${n - 1}, not ${n}: ${n} cells run 0…${n - 1}.`
      : ask === "first-element"
        ? "The first element sits at index 0. Counting starts at zero."
        : `arr[${answerIndex}] is a direct address (base + ${answerIndex} steps): one jump, no walking.`

  return {
    question: {
      kind: "a1-access",
      prompt,
      cells,
      ask,
      k: ask === "value-at-k" ? answerIndex : undefined,
      answerIndex,
      value,
      cost: { word: "free", count: 1, unit: "step" },
      hint: "",
      nudge: "Counting starts at 0. Line the cell up with its ruler tick.",
      correct: `Right: ${value} at index ${answerIndex} - one jump.`,
      why,
    },
    next: a,
  }
}

/** A3 step 0 (index-ask) over a fresh unique-value strip; the jump face. */
function makeA3Index(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const cells = LETTERS.slice(0, 6) // distinct values: the value-ask stays unambiguous
  const n = cells.length
  const r = rngInt(a, n - 2)
  a = r.next
  const k = 2 + r.value // 2..n-1
  return {
    question: {
      kind: "a3-contrast",
      prompt: `You know the index. Tap the value at index ${k}.`,
      cells,
      ask: "index",
      k,
      answerIndex: k,
      value: cells[k],
      cost: { word: "free", count: 1, unit: "step" },
      hint: "",
      nudge: "Index in hand: jump straight to ruler tick, no scanning.",
      correct: `Right: index ${k} jumps straight to ${cells[k]}.`,
      why: `With the index you address arr[${k}] directly: one hop, free no matter how long the row is.`,
    },
    next: a,
  }
}

/** A3 step 1 (value-ask) over the SAME strip; the scan face. */
function makeA3Value(cells: string[], seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const n = cells.length
  // Search for a value past the front so the scan visibly walks several cells.
  const r = rngInt(a, n - 2)
  a = r.next
  const idx = 2 + r.value // 2..n-1
  const value = cells[idx]
  const steps = idx + 1 // a scan checks cells 0..idx
  return {
    question: {
      kind: "a3-contrast",
      prompt: `Now you only know the value. Find ${value}: tap where it is.`,
      cells,
      ask: "value",
      value,
      answerIndex: idx,
      cost: { word: "scales", count: steps, unit: steps === 1 ? "step" : "steps" },
      hint: "",
      nudge: "A value search walks cell by cell from index 0.",
      correct: `Right: ${value} turns up at index ${idx} after a ${steps}-cell scan.`,
      why: `Having only the value forces a scan: walk from index 0 until ${value} matches, ${steps} cell${plural(steps)}. That's why a search scales while an index jump is free.`,
    },
    next: a,
  }
}

/** A2 (beat 7): predict the resulting row after an insert/delete (real shift). */
function makeA2(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value // 4..5
  const array = LETTERS.slice(0, len)
  r = rngInt(a, 2)
  a = r.next
  const insert = r.value === 0

  let index: number
  let result: string[]
  let shifted: number
  let prompt: string
  let op: ArrayOp
  const candidates: string[][] = []

  if (insert) {
    r = rngInt(a, len - 1)
    a = r.next
    index = 1 + r.value // 1..len-1 (always a real shift)
    result = splice(array, index, 0, "X")
    shifted = len - index
    prompt = `Insert X at index ${index}. What does the row become?`
    op = { kind: "insert", index, inserted: "X" }
    for (const j of [index - 1, index + 1, 0, len]) {
      if (j < 0 || j > len || j === index) continue
      candidates.push(splice(array, j, 0, "X"))
    }
  } else {
    r = rngInt(a, len - 2)
    a = r.next
    index = 1 + r.value // 1..len-2
    result = splice(array, index, 1)
    shifted = len - 1 - index
    prompt = `Delete index ${index} (${array[index]}). What does the row become?`
    op = { kind: "delete", index }
    for (const j of [index - 1, index + 1, 0, len - 1]) {
      if (j < 0 || j >= len || j === index) continue
      candidates.push(splice(array, j, 1))
    }
  }

  const answer = join(result)
  const options: ArraysOption[] = [{ id: answer, label: answer }]
  for (const c of candidates) {
    if (options.length >= 4) break
    const label = join(c)
    if (!options.some((o) => o.id === label)) options.push({ id: label, label })
  }
  const sh = shuffle(options, a)
  a = sh.next

  const why = insert
    ? `Everything from index ${index} on slides right by one to open a gap: ${shifted} cell${plural(shifted)} move.`
    : `Everything after index ${index} slides left to close the gap: ${shifted} cell${plural(shifted)} move.`

  return {
    question: {
      kind: "a2-shift",
      prompt,
      cells: array,
      options: sh.result,
      answer,
      op,
      cost: { word: "scales", count: shifted, unit: shifted === 1 ? "cell moved" : "cells moved" },
      hint: "",
      nudge: "Watch the gap: each cell after the spot shifts by exactly one.",
      correct: `Right: ${shifted} cell${plural(shifted)} shift.`,
      why,
    },
    next: a,
  }
}

/** A2-skin (beat 8): the same shift as a real-world row-insert; predict HOW MANY
 * rows move (the count ask, varied from A2's resulting-row ask). */
function makeA2Skin(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 5 + r.value // 5..6 rows reads as a real sheet
  const array = LETTERS.slice(0, len)
  r = rngInt(a, 2)
  a = r.next
  const insert = r.value === 0

  let index: number
  let shifted: number
  let prompt: string
  let op: ArrayOp
  if (insert) {
    r = rngInt(a, len - 1)
    a = r.next
    index = 1 + r.value
    shifted = len - index
    prompt = `Insert a row at position ${index}. How many rows shift down?`
    op = { kind: "insert", index, inserted: "X" }
  } else {
    r = rngInt(a, len - 2)
    a = r.next
    index = 1 + r.value
    shifted = len - 1 - index
    prompt = `Delete the row at position ${index}. How many rows shift up?`
    op = { kind: "delete", index }
  }

  const counts = new Set<number>([shifted])
  for (const d of [shifted - 1, shifted + 1, shifted + 2, 0]) {
    if (d >= 0 && d <= len) counts.add(d)
  }
  const options = [...counts].slice(0, 4).map((n) => ({ id: `n${n}`, label: `${n}` }))
  const sh = shuffle(options, a)
  a = sh.next

  return {
    question: {
      kind: "a2-skin",
      prompt,
      cells: array,
      options: sh.result,
      answer: `n${shifted}`,
      op,
      cost: { word: "scales", count: shifted, unit: shifted === 1 ? "row moved" : "rows moved" },
      hint: "",
      nudge: "Only the rows past the spot move. Count exactly those.",
      correct: `Right: ${shifted} row${plural(shifted)} shift.`,
      why: `Rows are stored contiguously, so inserting at ${index} slides every row below it: ${shifted} move.`,
    },
    next: a,
  }
}

/** A4 (beat 9): classify-by-position. Curated so the three costs never tie. */
function makeA4(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const r = rngInt(a, 2)
  a = r.next
  const n = 5 + r.value // 5..6
  const midK = 2 // front=n, middle=n-2, end=0 → three distinct costs (n>=5)
  const sh = shuffle(
    [
      { id: "front", label: "At the front (index 0)" },
      { id: "middle", label: "In the middle" },
      { id: "end", label: "At the end" },
    ],
    a,
  )
  a = sh.next
  return {
    question: {
      kind: "a4-classify",
      prompt: "Add one element. Which position is cheapest?",
      cells: LETTERS.slice(0, n),
      options: sh.result,
      answer: "end",
      classify: { n, midK },
      cost: { word: "free", count: 0, unit: "cells moved" },
      hint: "",
      nudge: "Count what moves: front shifts all of them, the end shifts none.",
      correct: "Right: the end is cheapest - nothing comes after it, so nothing moves.",
      why: `Front insert shifts all ${n} cells; a middle insert shifts ${n - midK}; the end shifts 0. The end is free; everything else scales with what's after it.`,
    },
    next: a,
  }
}

/** A5 (beat 10): construct-to-target. Prefix + shuffled end-appends, so the op
 * ORDER is uniquely determined by the target row (one correct answer). */
function makeA5(seed: number): {
  question: ArraysQuestion
  construct: ConstructWork
  next: number
} {
  let a = seed
  const r = rngInt(a, 2)
  a = r.next
  const n = 5 + r.value // target length 5..6
  const target = LETTERS.slice(0, n)
  const p = 2 // a true prefix of length 2; the rest are appended in order
  const partial = target.slice(0, p)
  const correctOps = target.slice(p) // unique append order
  const sh = shuffle(correctOps, a)
  a = sh.next
  return {
    question: {
      kind: "a5-construct",
      prompt: "Build the target row by appending the loose cells to the end.",
      cells: partial,
      target,
      partial,
      correctOps,
      cost: { word: "free", count: 0, unit: "shift" },
      hint: "",
      nudge: "Match the target: append whichever cell comes next in the row.",
      correct: "Right: appending to the end in order builds the row with no shifts.",
      why: "Appending lands at the open end, so nothing shifts. Build left to right and each cell drops straight in.",
    },
    construct: { loose: sh.result, placed: [] },
    next: a,
  }
}

/** A6 step 0 (beat 11): grow-predict over a full block (always doubles+copies). */
function makeA6Grow(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  // Capacity 4 (doubling to 8) keeps the backing block legible on a phone.
  const capacity = 4
  const size = capacity // seeded full so the synthesis always plays
  const sh = shuffle(
    [
      { id: "grow", label: `Grow to a block twice as big and copy all ${capacity} over` },
      { id: "inplace", label: "Drop it in the next slot, no copy" },
      { id: "growone", label: "Grow by one slot and copy one item" },
    ],
    a,
  )
  a = sh.next
  return {
    question: {
      kind: "a6-grow",
      prompt: `The block is full (${size} of ${capacity}). Append one more. What happens?`,
      cells: LETTERS.slice(0, size),
      options: sh.result,
      answer: "grow",
      resize: { size, capacity, resizes: true },
      cost: { word: "usually free", count: size, unit: "items copied" },
      hint: "",
      nudge: "There's no next slot. The block has to move somewhere bigger first.",
      correct: `Right: it doubles to ${capacity * 2} and copies all ${capacity} across.`,
      why: `A full block has no room, so it allocates one twice the size and copies every item over. Usually free, with the occasional big reshuffle.`,
    },
    next: a,
  }
}

/** A6 step 1 (beat 11): the amortized verdict over the same full block. */
function makeA6Cheap(resize: ArrayResize, seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const sh = shuffle(
    [
      { id: "expensive", label: "Expensive - it copied everything" },
      { id: "cheap", label: "Cheap - just one step" },
    ],
    a,
  )
  a = sh.next
  return {
    question: {
      kind: "a6-grow",
      prompt: "Was that particular append cheap?",
      cells: LETTERS.slice(0, resize.size),
      options: sh.result,
      answer: "expensive",
      resize,
      cost: { word: "usually free", count: resize.size, unit: "items copied" },
      hint: "",
      nudge: "This append triggered the doubling, so it copied the whole block.",
      correct: "Right: this one was expensive - it copied the whole block.",
      why: `This append hit a full block, so it copied all ${resize.size}. Most appends are free; only the ones that trigger a grow are expensive. Usually free, with the occasional big reshuffle.`,
    },
    next: a,
  }
}

/* ------------------------------- construction ------------------------------- */

const FRESH = {
  selected: null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
}

const INTRO_PARTS = new Set<ArraysPart>([
  "demo",
  "teach-access",
  "shift-demo",
  "teach-shift",
])

export function isGradedPartArrays(part: ArraysPart): boolean {
  return !INTRO_PARTS.has(part)
}

function enterPart(state: ArraysState, index: number): ArraysState {
  const part = ARRAYS_PARTS[index]
  const base: ArraysState = {
    ...state,
    partIndex: index,
    step: 0,
    construct: null,
    question: null,
    ...FRESH,
  }
  if (INTRO_PARTS.has(part)) return { ...base, question: makeIntro(part) }

  switch (part) {
    case "a1-access": {
      const { question, next } = makeA1(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "a3-contrast": {
      const { question, next } = makeA3Index(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "a2-shift": {
      const { question, next } = makeA2(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "a2-skin": {
      const { question, next } = makeA2Skin(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "a4-classify": {
      const { question, next } = makeA4(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "a5-construct": {
      const { question, construct, next } = makeA5(state.rngState)
      return { ...base, question, construct, rngState: next }
    }
    default: {
      // a6-grow
      const { question, next } = makeA6Grow(state.rngState)
      return { ...base, question, rngState: next }
    }
  }
}

export function createArrays(seed: number = Date.now()): ArraysState {
  const init: ArraysState = {
    seed,
    rngState: seed,
    partIndex: 0,
    attempts: 0,
    combo: 0,
    completed: false,
    a1: 0,
    a3: 0,
    a2: 0,
    a2Skin: 0,
    a4: 0,
    a5: 0,
    a6Grow: 0,
    a6Cheap: 0,
    question: null,
    selected: null,
    construct: null,
    step: 0,
    wrongCount: 0,
    feedback: "idle",
    revealed: false,
    showWhy: false,
  }
  return enterPart(init, 0)
}

/* --------------------------------- reducer --------------------------------- */

function gradeConstruct(work: ConstructWork, correctOps: string[]): boolean {
  return (
    work.placed.length === correctOps.length &&
    work.placed.every((id, i) => id === correctOps[i])
  )
}

/** Which graded counter the current beat + step proves (null on intro beats and
 * on A3's first ask, which only unlocks the second). */
function beatSkill(state: ArraysState): ArraysSkill | null {
  const part = ARRAYS_PARTS[state.partIndex]
  switch (part) {
    case "a1-access":
      return "a1"
    case "a3-contrast":
      return state.step === 1 ? "a3" : null // step 0 only unlocks step 1
    case "a2-shift":
      return "a2"
    case "a2-skin":
      return "a2Skin"
    case "a4-classify":
      return "a4"
    case "a5-construct":
      return "a5"
    case "a6-grow":
      return state.step === 0 ? "a6Grow" : "a6Cheap"
    default:
      return null
  }
}

export function arraysReducer(state: ArraysState, action: LessonAction): ArraysState {
  const part = ARRAYS_PARTS[state.partIndex]

  switch (action.type) {
    case "continue": {
      if (isGradedPartArrays(part)) return state // graded beats advance via `next`
      if (state.partIndex >= ARRAYS_TOTAL_PARTS - 1) return state
      return enterPart(state, state.partIndex + 1)
    }

    case "rewire": {
      // A5 append: move the chosen loose cell onto the open end, in order.
      if (!state.construct || isTerminalA(state)) return state
      if (action.to !== "end") return state
      if (!state.construct.loose.includes(action.from)) return state
      return {
        ...state,
        feedback: "idle",
        construct: {
          loose: state.construct.loose.filter((id) => id !== action.from),
          placed: [...state.construct.placed, action.from],
        },
      }
    }

    case "select": {
      if (isTerminalA(state)) return state
      if (state.construct) return state // A5 selects via rewire, not tap
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "check": {
      if (isTerminalA(state) || !state.question) return state

      let correct: boolean
      if (state.construct) {
        if (!constructReadyA(state)) return state
        correct = gradeConstruct(state.construct, state.question.correctOps ?? [])
      } else if (state.question.answerIndex != null && state.question.options == null) {
        // de-cued tap beats (A1, A3): the answer is a cell index
        if (state.selected == null) return state
        correct = Number(state.selected) === state.question.answerIndex
      } else {
        if (state.selected == null) return state
        correct = state.selected === state.question.answer
      }

      const v = gradeAnswer(state, correct)
      const skill = beatSkill(state)
      const next: ArraysState = {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
      }
      if (v.correct && skill) next[skill] = 1
      // A wrong construct order resets the bin so the learner can re-append.
      if (!v.correct && state.construct) {
        next.construct = {
          loose: [...state.construct.placed, ...state.construct.loose],
          placed: [],
        }
      }
      return next
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      // A fresh seeded instance of the live beat / step.
      switch (part) {
        case "a1-access": {
          const { question, next } = makeA1(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "a3-contrast": {
          const fresh =
            state.step === 1 && state.question
              ? makeA3Value(state.question.cells, state.rngState)
              : makeA3Index(state.rngState)
          return { ...state, ...FRESH, question: fresh.question, rngState: fresh.next }
        }
        case "a2-shift": {
          const { question, next } = makeA2(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "a2-skin": {
          const { question, next } = makeA2Skin(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "a4-classify": {
          const { question, next } = makeA4(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "a5-construct": {
          if (!state.construct) return { ...state, ...FRESH }
          const all = [...state.construct.placed, ...state.construct.loose]
          const sh = shuffle(all, state.rngState)
          return {
            ...state,
            ...FRESH,
            rngState: sh.next,
            construct: { loose: sh.result, placed: [] },
          }
        }
        case "a6-grow": {
          if (state.step === 1 && state.question?.resize) {
            const { question, next } = makeA6Cheap(state.question.resize, state.rngState)
            return { ...state, ...FRESH, question, rngState: next }
          }
          const { question, next } = makeA6Grow(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        default:
          return { ...state, ...FRESH }
      }
    }

    case "next": {
      if (state.feedback !== "correct") return state

      if (part === "a3-contrast" && state.step === 0 && state.question) {
        const { question, next } = makeA3Value(state.question.cells, state.rngState)
        return { ...state, ...FRESH, step: 1, question, rngState: next }
      }
      if (part === "a6-grow" && state.step === 0 && state.question?.resize) {
        const { question, next } = makeA6Cheap(state.question.resize, state.rngState)
        return { ...state, ...FRESH, step: 1, question, rngState: next }
      }
      if (part === "a6-grow" && state.step === 1) {
        return { ...state, ...FRESH, completed: true }
      }
      if (state.partIndex >= ARRAYS_TOTAL_PARTS - 1) {
        return { ...state, ...FRESH, completed: true }
      }
      return enterPart(state, state.partIndex + 1)
    }

    default:
      return state
  }
}

/* -------------------------------- selectors -------------------------------- */

export function currentPartArrays(state: ArraysState): ArraysPart {
  return ARRAYS_PARTS[state.partIndex]
}

export function isTerminalA(state: ArraysState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledPartsArrays(state: ArraysState): number {
  return state.completed ? ARRAYS_TOTAL_PARTS : state.partIndex
}

/** Total graded skills cleared so far (0..8). */
export function gradedCleared(state: ArraysState): number {
  return ARRAYS_SKILLS.reduce((n, s) => n + (state[s] > 0 ? 1 : 0), 0)
}

/** Lesson-wide progress shown on graded beats ("n / 8"); null on intro beats. */
export function partQuotaArrays(
  state: ArraysState,
): { done: number; total: number } | null {
  return isGradedPartArrays(currentPartArrays(state))
    ? { done: gradedCleared(state), total: ARRAYS_GATE }
    : null
}

/** The hard mastery gate: all 8 graded beats cleared. */
export function isCompleteArrays(state: ArraysState): boolean {
  return ARRAYS_SKILLS.every((s) => state[s] > 0)
}

export function hasProgressArrays(state: ArraysState): boolean {
  return state.partIndex > 0 || gradedCleared(state) > 0
}

/** A5: the legal drop target (the open end) while loose cells remain. */
export function legalTargetsArrays(state: ArraysState): Set<string> {
  if (state.construct && state.construct.loose.length > 0) return new Set(["end"])
  return new Set()
}

/** A5 is ready to check once every loose cell has been appended. */
export function constructReadyA(state: ArraysState): boolean {
  return !!state.construct && state.construct.loose.length === 0
}

/** The 1-based ordinal label for an index, for SR / copy ("1st", "2nd", …). */
export function indexOrdinal(i: number): string {
  return ordinal(i + 1)
}

/* --------------------- frame selectors (pure, view-only) -------------------- */

/**
 * One cell in a shift frame: a stable identity (so the renderer can animate the
 * same box sliding between slots), its label, the column `slot` it occupies in
 * this frame, and whether it is the cell that just moved (for the highlight).
 */
export interface ShiftFrameCell {
  id: string
  label: string
  slot: number
  moving: boolean
}

/** A single snapshot of the row mid-shift, plus a caption for the SR live region. */
export interface ShiftFrame {
  cells: ShiftFrameCell[] // sorted by slot
  caption: string
  columns: number // fixed address slots to reserve across the whole sequence
}

const bySlot = (cells: ShiftFrameCell[]): ShiftFrameCell[] =>
  [...cells].sort((a, b) => a.slot - b.slot)

const calm = (cells: ShiftFrameCell[]): ShiftFrameCell[] =>
  cells.map((c) => ({ ...c, moving: false }))

const clampIdx = (i: number, hi: number): number => Math.min(Math.max(i, 0), hi)

/**
 * Deterministic per-cell frames for a mid-insert/delete "wave of shifts". A PURE
 * view selector: no reducer, no engine state, same op always yields the same
 * frames. Consecutive frames move exactly one cell, so the renderer animates the
 * ripple; the FINAL frame is the end-state, so reduced motion snaps straight to
 * it. These reveal the resulting arrangement, so callers must only mount them
 * AFTER the verdict (never to grade, never before the answer is locked).
 */
export function shiftFrames(array: string[], op: ArrayOp): ShiftFrame[] {
  const n = array.length
  const cells: ShiftFrameCell[] = array.map((label, i) => ({
    id: `c${i}`,
    label,
    slot: i,
    moving: false,
  }))

  if (op.kind === "insert") {
    const columns = n + 1
    const i = clampIdx(op.index, n)
    const inserted = op.inserted ?? "X"
    const slot = cells.map((c) => c.slot)
    const frames: ShiftFrame[] = [
      {
        cells: calm(cells),
        caption: `Insert ${inserted} at index ${i}: first make room.`,
        columns,
      },
    ]
    // Ripple from the end so the gap opens exactly at the insert index.
    for (let k = n - 1; k >= i; k--) {
      slot[k] = k + 1
      frames.push({
        cells: bySlot(cells.map((c, idx) => ({ ...c, slot: slot[idx], moving: idx === k }))),
        caption: `${array[k]} slides right into index ${k + 1}.`,
        columns,
      })
    }
    const placed = cells.map((c, idx) => ({ ...c, slot: slot[idx], moving: false }))
    placed.push({ id: "ins", label: inserted, slot: i, moving: true })
    frames.push({
      cells: bySlot(placed),
      caption: `${inserted} drops into index ${i}.`,
      columns,
    })
    return frames
  }

  // delete: drop the cell, then ripple the tail left to close the gap.
  const columns = n
  const i = clampIdx(op.index, Math.max(0, n - 1))
  const survivors = cells.filter((c) => c.slot !== i)
  const slot: Record<string, number> = {}
  for (const c of survivors) slot[c.id] = c.slot
  const frames: ShiftFrame[] = [
    { cells: calm(cells), caption: `Delete index ${i} (${array[i]}).`, columns },
    {
      cells: bySlot(calm(survivors)),
      caption: `${array[i]} leaves a gap at index ${i}.`,
      columns,
    },
  ]
  for (let k = i + 1; k < n; k++) {
    const id = `c${k}`
    slot[id] = k - 1
    frames.push({
      cells: bySlot(survivors.map((c) => ({ ...c, slot: slot[c.id], moving: c.id === id }))),
      caption: `${array[k]} slides left into index ${k - 1}.`,
      columns,
    })
  }
  return frames
}

/** A single snapshot of the dynamic-array block mid-resize. */
export interface ResizeFrame {
  capacity: number // slots in the block right now (doubles on the resize)
  filled: number // how many slots currently hold an item
  copying: number | null // slot being copied this frame (for the highlight)
  phase: "full" | "allocate" | "copy" | "place" | "settled"
  caption: string
}

/**
 * Deterministic frames for the doubling visualization: when the block is full,
 * allocate a block twice the size, copy every item over (the "occasional big
 * reshuffle"), then drop the new item. When there is room, the item just lands.
 * PURE and view-only; the verdict is graded elsewhere.
 */
export function resizeFrames(r: ArrayResize): ResizeFrame[] {
  const { size, capacity, resizes } = r
  if (!resizes) {
    return [
      {
        capacity,
        filled: size,
        copying: null,
        phase: "settled",
        caption: `${size} of ${capacity} slots are used.`,
      },
      {
        capacity,
        filled: size + 1,
        copying: null,
        phase: "place",
        caption: "Room to spare: the new item drops straight in.",
      },
    ]
  }

  const grown = capacity * 2
  const frames: ResizeFrame[] = [
    {
      capacity,
      filled: capacity,
      copying: null,
      phase: "full",
      caption: `All ${capacity} slots are full.`,
    },
    {
      capacity: grown,
      filled: 0,
      copying: null,
      phase: "allocate",
      caption: `Allocate a bigger block, double the size (${grown} slots).`,
    },
  ]
  for (let k = 0; k < size; k++) {
    frames.push({
      capacity: grown,
      filled: k + 1,
      copying: k,
      phase: "copy",
      caption: `Copy item ${k + 1} of ${size} into the new block.`,
    })
  }
  frames.push({
    capacity: grown,
    filled: size + 1,
    copying: null,
    phase: "place",
    caption: "Now the new item drops in. Usually free, with the occasional big reshuffle.",
  })
  return frames
}

/* ----------------------------- resume / progress ----------------------------- */

export function toProgressArrays(s: ArraysState): LessonProgress {
  return {
    counters: {
      a1: s.a1,
      a3: s.a3,
      a2: s.a2,
      a2Skin: s.a2Skin,
      a4: s.a4,
      a5: s.a5,
      a6Grow: s.a6Grow,
      a6Cheap: s.a6Cheap,
      attempts: s.attempts,
    },
    currentPart: currentPartArrays(s),
    completed: s.completed || isCompleteArrays(s),
  }
}

function clampUnit(n: number | undefined): number {
  if (!Number.isFinite(n)) return 0
  return (n ?? 0) > 0 ? 1 : 0
}

export function resumeArrays(
  progress: LessonProgress,
  seed: number = Date.now(),
): ArraysState {
  const base = createArrays(seed)
  const c = progress.counters
  const seeded: ArraysState = {
    ...base,
    a1: clampUnit(c.a1),
    a3: clampUnit(c.a3),
    a2: clampUnit(c.a2),
    a2Skin: clampUnit(c.a2Skin),
    a4: clampUnit(c.a4),
    a5: clampUnit(c.a5),
    a6Grow: clampUnit(c.a6Grow),
    a6Cheap: clampUnit(c.a6Cheap),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, ARRAYS_PARTS.indexOf(progress.currentPart as ArraysPart))
  const s = enterPart(seeded, index)
  return progress.completed || isCompleteArrays(s) ? { ...s, completed: true } : s
}
