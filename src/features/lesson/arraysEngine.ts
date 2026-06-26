import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Arrays / Dynamic Arrays engine (the "predict, then
 * act, then see the consequence" rebuild, see
 * docs/plans/specs/2026-06-25-arrays-lesson-redesign-design.md). One idea:
 * contiguity buys instant indexing (a jump, not a scan) and charges a shift on
 * every middle insert/delete; the end is cheap, except when a full block must
 * double-and-copy.
 *
 * Nine beats: two live free-play intros (access, mutation) plus seven graded
 * beats across eight sub-skills (a jump, a value scan, an insert count, a delete
 * count, a cheapest-placement drag, a real-world shift, and a two-part growth
 * synthesis). Same idea, the five-mechanic menu: Predict-the-cost/count
 * (primary), Predict-next-state, and Classify (cheapest position).
 *
 * Deterministic + seedable: same state always yields the same question/verdict
 * (the no-AI guarantee). Reuses the shared feedback machine + flame
 * (`gradeAnswer`) and the same `LessonAction` / `LessonProgress` shapes; only the
 * structure model, verdicts, and gate are Arrays-specific.
 *
 * Resume migration: an old run's counters are mapped onto the new skill keys
 * (`a1->accessIndex`, `a3->accessScan`, `a2->insertCount`, `a2Skin->realworld`,
 * `a4->placeCheapest`, `a6Grow->grow`, `a6Cheap->growVerdict`); the removed
 * construct skill (`a5`) is dropped and the new `deleteCount` re-earns; an
 * unknown old `currentPart` restarts at the access playground; a completed run
 * stays completed so the next lesson stays unlocked.
 */

export const ARRAYS_PARTS = [
  "play-access", // 1 free play: tap to read, jump to an index (intro)
  "jump", // 2 de-cued "go to index k" - one hop (graded)
  "scan", // 3 same idea inverted: search a value by walking the row (graded)
  "play-mutate", // 4 free play: insert into a gap / delete a cell, watch the ripple (intro)
  "insert", // 5 predict the insert shift count (graded)
  "delete", // 6 predict the delete shift count (graded)
  "place-cheapest", // 7 drop one cell where it costs least (meaningful gap drag) (graded)
  "realworld", // 8 spreadsheet row insert/delete: the same shift, concrete (graded)
  "grow", // 9 capacity full -> append: double + copy, then "was it cheap?" (graded x2)
] as const
export type ArraysPart = (typeof ARRAYS_PARTS)[number]
export const ARRAYS_TOTAL_PARTS = ARRAYS_PARTS.length

/** The 8 graded sub-skills; mastery = all 8 cleared. */
export const ARRAYS_SKILLS = [
  "accessIndex",
  "accessScan",
  "insertCount",
  "deleteCount",
  "placeCheapest",
  "realworld",
  "grow",
  "growVerdict",
] as const
export type ArraysSkill = (typeof ARRAYS_SKILLS)[number]
export const ARRAYS_GATE = ARRAYS_SKILLS.length // 8

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]

export interface ArraysOption {
  id: string
  label: string
}

/**
 * The structural op a shift/skin question is about, kept as data (not parsed from
 * the prompt) so the pure frame selectors below can replay it deterministically.
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

/** How a jump/scan beat phrases its de-cued ask. */
export type ArraysAsk = "first" | "last" | "value-at-k" | "value"

export interface ArraysQuestion {
  kind: ArraysPart
  prompt: string
  /** The strip contents (the row under consideration). */
  cells: string[]
  /** Ask variant (jump: first/last/value-at-k; scan: value). */
  ask?: ArraysAsk
  /** Index in question (jump value-at-k). */
  k?: number
  /** Searched value (scan); guaranteed unique in `cells`. */
  value?: string
  /** De-cued tap answer = a cell index (jump, scan). */
  answerIndex?: number
  /** insert / delete / realworld: drives the post-verdict ripple. */
  op?: ArrayOp
  /** insert / delete / realworld / grow MCQ. */
  options?: ArraysOption[]
  /** Winning option id (MCQ beats) or the correct gap id (place-cheapest). */
  answer?: string
  /** place-cheapest parameters (front=n, middle=n-midK, end=0). */
  classify?: { n: number; midK: number }
  /** grow: drives the capacity-frame doubling. */
  resize?: ArrayResize
  /** The locked house word; the chip renders this verbatim. */
  cost: { word: CostWord; count: number; unit: string }
  hint: string
  nudge: string
  correct: string
  why: string
}

export interface ArraysState {
  seed: number
  rngState: number
  partIndex: number
  attempts: number
  combo: number
  completed: boolean
  // the 8 graded counters (each 0 | 1)
  accessIndex: number
  accessScan: number
  insertCount: number
  deleteCount: number
  placeCheapest: number
  realworld: number
  grow: number
  growVerdict: number
  question: ArraysQuestion | null
  selected: string | null // MCQ id, stringified tapped index, or chosen gap id
  step: number // sub-step for the grow two-asker: 0 | 1
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

const plural = (n: number) => (n === 1 ? "" : "s")
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** Up to four distinct count options (the right count + plausible misses). */
function countOptions(
  moved: number,
  maxN: number,
  seed: number,
): { result: ArraysOption[]; next: number } {
  const counts = new Set<number>([moved])
  for (const d of [moved - 1, moved + 1, moved + 2, 0]) {
    if (d >= 0 && d <= maxN) counts.add(d)
  }
  const arr = [...counts].slice(0, 4).map((n) => ({ id: `n${n}`, label: `${n}` }))
  return shuffle(arr, seed)
}

/* ------------------------------ question makers ------------------------------ */

/** Demo / play beats: a read-only strip + naming copy, no graded answer. */
function makeIntro(part: ArraysPart): ArraysQuestion {
  const cells = LETTERS.slice(0, 6)
  const base = {
    cells,
    cost: { word: "free" as CostWord, count: 1, unit: "step" },
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
  if (part === "play-access") {
    return {
      ...base,
      kind: "play-access",
      prompt: "Tap any cell to read it, or jump to any position. The number under each cell is its index.",
    }
  }
  return {
    ...base,
    kind: "play-mutate",
    prompt: "Drop a cell into a gap, or remove one, and watch the rest slide over.",
  }
}

/** `jump` (beat 2): de-cued access. The answer is a cell index; the de-cue is
 * presentational (no lit cell), the answer stays a pure function of 0-indexing. */
function makeJump(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const cells = LETTERS.slice(0, 6)
  const n = cells.length
  let r = rngInt(a, 3)
  a = r.next
  const ask: ArraysAsk = r.value === 0 ? "last" : r.value === 1 ? "first" : "value-at-k"

  let answerIndex: number
  let prompt: string
  if (ask === "first") {
    answerIndex = 0
    prompt = "Jump to the first element."
  } else if (ask === "last") {
    answerIndex = n - 1
    prompt = "Jump to the last element."
  } else {
    r = rngInt(a, n - 2)
    a = r.next
    answerIndex = 2 + r.value // 2..n-1, so counting from 0 actually matters
    prompt = `Jump to index ${answerIndex}.`
  }
  const value = cells[answerIndex]
  const why =
    ask === "last"
      ? `The last index is ${n - 1}, not ${n}: ${n} cells run 0…${n - 1}.`
      : ask === "first"
        ? "The first element sits at index 0. Counting starts at zero."
        : `Index ${answerIndex} is a direct hop: you jump straight to that cell instead of searching for it.`

  return {
    question: {
      kind: "jump",
      prompt,
      cells,
      ask,
      k: ask === "value-at-k" ? answerIndex : undefined,
      answerIndex,
      value,
      cost: { word: "free", count: 1, unit: "step" },
      hint: "",
      nudge: "Counting starts at 0. Line the cell up with its ruler tick.",
      correct: `Right: ${value} at index ${answerIndex}, one jump.`,
      why,
    },
    next: a,
  }
}

/** `scan` (beat 3): search a value by walking the row from index 0. */
function makeScan(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const cells = LETTERS.slice(0, 6) // distinct values: the value-ask stays unambiguous
  const n = cells.length
  const r = rngInt(a, n - 2)
  a = r.next
  const idx = 2 + r.value // 2..n-1, so the scan visibly walks several cells
  const value = cells[idx]
  const steps = idx + 1 // a scan checks cells 0..idx
  return {
    question: {
      kind: "scan",
      prompt: `Find ${value}. Walk the row and tap where it is.`,
      cells,
      ask: "value",
      value,
      answerIndex: idx,
      cost: { word: "scales", count: steps, unit: steps === 1 ? "step" : "steps" },
      hint: "",
      nudge: "A value search walks cell by cell from index 0.",
      correct: `Right: ${value} turns up at index ${idx} after a ${steps}-cell scan.`,
      why: `With only the value you must scan from index 0 until ${value} matches: ${steps} cell${plural(steps)}. That's why a search scales while an index jump is free.`,
    },
    next: a,
  }
}

/** `insert` (beat 5): predict how many cells a mid-insert shifts (= n - k). */
function makeInsert(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 5 + r.value // 5..6
  const array = LETTERS.slice(0, len)
  r = rngInt(a, len - 1)
  a = r.next
  const index = 1 + r.value // 1..len-1 (always a real shift)
  const moved = len - index
  const op: ArrayOp = { kind: "insert", index, inserted: "X" }
  const opt = countOptions(moved, len, a)
  a = opt.next
  return {
    question: {
      kind: "insert",
      prompt: `Insert X at index ${index}. How many cells shift?`,
      cells: array,
      op,
      options: opt.result,
      answer: `n${moved}`,
      cost: { word: "scales", count: moved, unit: moved === 1 ? "cell moved" : "cells moved" },
      hint: "",
      nudge: "Only the cells from the insert point on move. Count exactly those.",
      correct: `Right: ${moved} cell${plural(moved)} shift right.`,
      why: `Everything from index ${index} on slides right by one to open the gap: ${moved} cell${plural(moved)} move.`,
    },
    next: a,
  }
}

/** `delete` (beat 6): predict how many cells a mid-delete shifts (= n - 1 - k). */
function makeDelete(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 5 + r.value // 5..6
  const array = LETTERS.slice(0, len)
  r = rngInt(a, len - 1)
  a = r.next
  const index = r.value // 0..len-2 (always a real shift)
  const moved = len - 1 - index
  const op: ArrayOp = { kind: "delete", index }
  const opt = countOptions(moved, len, a)
  a = opt.next
  return {
    question: {
      kind: "delete",
      prompt: `Delete index ${index} (${array[index]}). How many cells shift?`,
      cells: array,
      op,
      options: opt.result,
      answer: `n${moved}`,
      cost: { word: "scales", count: moved, unit: moved === 1 ? "cell moved" : "cells moved" },
      hint: "",
      nudge: "Only the cells after the gap move. Count exactly those.",
      correct: `Right: ${moved} cell${plural(moved)} shift left.`,
      why: `Everything after index ${index} slides left to close the gap: ${moved} cell${plural(moved)} move.`,
    },
    next: a,
  }
}

/** `place-cheapest` (beat 7): drop the new cell where it costs least (the end). */
function makePlaceCheapest(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  const r = rngInt(a, 2)
  a = r.next
  const n = 5 + r.value // 5..6
  return {
    question: {
      kind: "place-cheapest",
      prompt: "Add one cell so the fewest shift. Drop it where it costs least.",
      cells: LETTERS.slice(0, n),
      answer: `gap-${n}`, // the open end: zero ripple
      classify: { n, midK: 2 },
      cost: { word: "free", count: 0, unit: "cells moved" },
      hint: "",
      nudge: "A middle drop shoves everything after it. The end shoves nothing.",
      correct: "Right: the end is free - nothing comes after it, so nothing moves.",
      why: `Dropping at the front shifts all ${n} cells; the middle shifts ${n - 2}; the end shifts 0. Add at the end and nothing has to move.`,
    },
    next: a,
  }
}

/** `realworld` (beat 8): the same shift as a spreadsheet row insert/delete. */
function makeRealworld(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 5 + r.value // 5..6 rows reads as a real sheet
  const array = LETTERS.slice(0, len)
  r = rngInt(a, 2)
  a = r.next
  const insert = r.value === 0

  let index: number
  let moved: number
  let prompt: string
  let op: ArrayOp
  if (insert) {
    r = rngInt(a, len - 1)
    a = r.next
    index = 1 + r.value
    moved = len - index
    prompt = `Insert a row at position ${index}. How many rows shift down?`
    op = { kind: "insert", index, inserted: "X" }
  } else {
    r = rngInt(a, len - 1)
    a = r.next
    index = r.value // 0..len-2
    moved = len - 1 - index
    prompt = `Delete the row at position ${index}. How many rows shift up?`
    op = { kind: "delete", index }
  }
  const opt = countOptions(moved, len, a)
  a = opt.next
  return {
    question: {
      kind: "realworld",
      prompt,
      cells: array,
      op,
      options: opt.result,
      answer: `n${moved}`,
      cost: { word: "scales", count: moved, unit: moved === 1 ? "row moved" : "rows moved" },
      hint: "",
      nudge: "Only the rows past the spot move. Count exactly those.",
      correct: `Right: ${moved} row${plural(moved)} shift.`,
      why: `The rows sit in one unbroken block, so the change at position ${index} slides every row after it: ${moved} move.`,
    },
    next: a,
  }
}

/** `grow` step 0 (beat 9): grow-predict over a full block (always doubles+copies). */
function makeGrow(seed: number): { question: ArraysQuestion; next: number } {
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
      kind: "grow",
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

/** `grow` step 1 (beat 9): the amortized verdict over the same full block. */
function makeGrowVerdict(
  resize: ArrayResize,
  seed: number,
): { question: ArraysQuestion; next: number } {
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
      kind: "grow",
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

const INTRO_PARTS = new Set<ArraysPart>(["play-access", "play-mutate"])

export function isGradedPartArrays(part: ArraysPart): boolean {
  return !INTRO_PARTS.has(part)
}

function enterPart(state: ArraysState, index: number): ArraysState {
  const part = ARRAYS_PARTS[index]
  const base: ArraysState = {
    ...state,
    partIndex: index,
    step: 0,
    question: null,
    ...FRESH,
  }
  if (INTRO_PARTS.has(part)) return { ...base, question: makeIntro(part) }

  switch (part) {
    case "jump": {
      const { question, next } = makeJump(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "scan": {
      const { question, next } = makeScan(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "insert": {
      const { question, next } = makeInsert(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "delete": {
      const { question, next } = makeDelete(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "place-cheapest": {
      const { question, next } = makePlaceCheapest(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "realworld": {
      const { question, next } = makeRealworld(state.rngState)
      return { ...base, question, rngState: next }
    }
    default: {
      // grow
      const { question, next } = makeGrow(state.rngState)
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
    accessIndex: 0,
    accessScan: 0,
    insertCount: 0,
    deleteCount: 0,
    placeCheapest: 0,
    realworld: 0,
    grow: 0,
    growVerdict: 0,
    question: null,
    selected: null,
    step: 0,
    wrongCount: 0,
    feedback: "idle",
    revealed: false,
    showWhy: false,
  }
  return enterPart(init, 0)
}

/* --------------------------------- reducer --------------------------------- */

/** Which graded counter the current beat + step proves (null on intro beats). */
function beatSkill(state: ArraysState): ArraysSkill | null {
  const part = ARRAYS_PARTS[state.partIndex]
  switch (part) {
    case "jump":
      return "accessIndex"
    case "scan":
      return "accessScan"
    case "insert":
      return "insertCount"
    case "delete":
      return "deleteCount"
    case "place-cheapest":
      return "placeCheapest"
    case "realworld":
      return "realworld"
    case "grow":
      return state.step === 0 ? "grow" : "growVerdict"
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
      // place-cheapest: the chosen gap is the answer.
      if (isTerminalA(state) || part !== "place-cheapest") return state
      return { ...state, selected: action.to, feedback: "idle" }
    }

    case "select": {
      if (isTerminalA(state)) return state
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "check": {
      if (isTerminalA(state) || !state.question) return state

      let correct: boolean
      if (part === "place-cheapest") {
        if (state.selected == null) return state
        correct = state.selected === state.question.answer
      } else if (state.question.answerIndex != null && state.question.options == null) {
        // de-cued tap beats (jump, scan): the answer is a cell index
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
      return next
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      // A fresh seeded instance of the live beat / step.
      switch (part) {
        case "jump": {
          const { question, next } = makeJump(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "scan": {
          const { question, next } = makeScan(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "insert": {
          const { question, next } = makeInsert(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "delete": {
          const { question, next } = makeDelete(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "place-cheapest": {
          const { question, next } = makePlaceCheapest(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "realworld": {
          const { question, next } = makeRealworld(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        case "grow": {
          if (state.step === 1 && state.question?.resize) {
            const { question, next } = makeGrowVerdict(state.question.resize, state.rngState)
            return { ...state, ...FRESH, question, rngState: next }
          }
          const { question, next } = makeGrow(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
        default:
          return { ...state, ...FRESH }
      }
    }

    case "next": {
      if (state.feedback !== "correct") return state

      if (part === "grow" && state.step === 0 && state.question?.resize) {
        const { question, next } = makeGrowVerdict(state.question.resize, state.rngState)
        return { ...state, ...FRESH, step: 1, question, rngState: next }
      }
      if (part === "grow" && state.step === 1) {
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

/** place-cheapest: a drop target at every gap (0..n) while the beat is live. */
export function gapTargetsArrays(state: ArraysState): Set<string> {
  if (currentPartArrays(state) !== "place-cheapest" || isTerminalA(state)) return new Set()
  const n = state.question?.cells.length ?? 0
  return new Set(Array.from({ length: n + 1 }, (_, i) => `gap-${i}`))
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
      accessIndex: s.accessIndex,
      accessScan: s.accessScan,
      insertCount: s.insertCount,
      deleteCount: s.deleteCount,
      placeCheapest: s.placeCheapest,
      realworld: s.realworld,
      grow: s.grow,
      growVerdict: s.growVerdict,
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
  // Read new keys, falling back to the old run's keys (the migration map).
  const seeded: ArraysState = {
    ...base,
    accessIndex: clampUnit(c.accessIndex ?? c.a1),
    accessScan: clampUnit(c.accessScan ?? c.a3),
    insertCount: clampUnit(c.insertCount ?? c.a2),
    deleteCount: clampUnit(c.deleteCount),
    placeCheapest: clampUnit(c.placeCheapest ?? c.a4),
    realworld: clampUnit(c.realworld ?? c.a2Skin),
    grow: clampUnit(c.grow ?? c.a6Grow),
    growVerdict: clampUnit(c.growVerdict ?? c.a6Cheap),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, ARRAYS_PARTS.indexOf(progress.currentPart as ArraysPart))
  const s = enterPart(seeded, index)
  return progress.completed || isCompleteArrays(s) ? { ...s, completed: true } : s
}
