import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Arrays lesson engine. One idea: indexed contiguous
 * storage gives instant access by index, but inserting/deleting in the middle
 * shifts everything after it, and dynamic arrays occasionally resize. Reuses the
 * shared feedback machine + flame (`gradeAnswer`) and the same LessonProgress
 * shape; only the structure model, verdicts, and quota are Arrays-specific.
 * Deterministic (seeded) — same state always yields the same question/feedback.
 */

export const ARRAYS_PARTS = ["access", "shift", "cost", "resize"] as const
export type ArraysPart = (typeof ARRAYS_PARTS)[number]
export const ARRAYS_TOTAL_PARTS = ARRAYS_PARTS.length

export const SHIFT_QUOTA = 3
export const COST_QUOTA = 3
export const RESIZE_QUOTA = 2

const LETTERS = ["A", "B", "C", "D", "E", "F"]

export interface ArraysOption {
  id: string
  label: string
}

export interface ArraysQuestion {
  kind: ArraysPart
  prompt: string
  array: string[] // the structure under consideration ([] for resize)
  highlight: number // index the op touches (-1 = none)
  options: ArraysOption[]
  answer: string // winning option id
  hint: string
  nudge: string
  correct: string
  why: string
  cost: { word: CostWord; count: number; unit: string }
}

export interface ArraysState {
  seed: number
  rngState: number
  partIndex: number
  shiftCorrect: number
  costCorrect: number
  resizeCorrect: number
  attempts: number
  question: ArraysQuestion | null
  accessed: number | null // index tapped in the access intro
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

/* ------------------------------ question makers ------------------------------ */

function makeAccess(): ArraysQuestion {
  return {
    kind: "access",
    prompt: "Reading by index is direct — tap any cell to read it.",
    array: LETTERS.slice(0, 5),
    highlight: -1,
    options: [],
    answer: "",
    hint: "",
    nudge: "",
    correct: "",
    why: "",
    cost: { word: "free", count: 1, unit: "step" },
  }
}

function makeShift(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value
  const array = LETTERS.slice(0, len)
  r = rngInt(a, 2)
  a = r.next
  const insert = r.value === 0

  let index: number
  let result: string[]
  let shifted: number
  let prompt: string
  const candidates: string[][] = []

  if (insert) {
    r = rngInt(a, len - 1)
    a = r.next
    index = 1 + r.value // 1..len-1 (always a real shift)
    result = splice(array, index, 0, "X")
    shifted = len - index
    prompt = `Insert X at index ${index}. What does the array become?`
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
    prompt = `Delete index ${index} (${array[index]}). What does the array become?`
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
    ? `Everything from index ${index} on slides right by one to make room — ${shifted} element${plural(shifted)} move.`
    : `Everything after index ${index} slides left to close the gap — ${shifted} element${plural(shifted)} move.`

  return {
    question: {
      kind: "shift",
      prompt,
      array,
      highlight: index,
      options: sh.result,
      answer,
      hint: "Only the elements past the spot move. Tap the result, then check.",
      nudge: "Watch the gap — each element after the spot shifts by exactly one.",
      correct: `Right — ${shifted} element${plural(shifted)} shift.`,
      why,
      cost: {
        word: "scales",
        count: shifted,
        unit: shifted === 1 ? "element moved" : "elements moved",
      },
    },
    next: a,
  }
}

function makeCost(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value
  const array = LETTERS.slice(0, len)
  r = rngInt(a, 2)
  a = r.next
  const insert = r.value === 0

  let index: number
  let shifted: number
  let prompt: string
  if (insert) {
    r = rngInt(a, len - 1)
    a = r.next
    index = 1 + r.value
    shifted = len - index
    prompt = `Insert X at index ${index}. How many existing elements shift?`
  } else {
    r = rngInt(a, len - 2)
    a = r.next
    index = 1 + r.value
    shifted = len - 1 - index
    prompt = `Delete index ${index}. How many elements shift to close the gap?`
  }

  const counts = new Set<number>([shifted])
  for (const d of [shifted - 1, shifted + 1, shifted + 2, 0]) {
    if (d >= 0 && d <= len) counts.add(d)
  }
  const options = [...counts]
    .slice(0, 4)
    .map((n) => ({ id: `n${n}`, label: `${n}` }))
  const sh = shuffle(options, a)
  a = sh.next

  return {
    question: {
      kind: "cost",
      prompt,
      array,
      highlight: index,
      options: sh.result,
      answer: `n${shifted}`,
      hint: "Count the elements sitting after the spot.",
      nudge: "Only elements after the index move — count exactly those.",
      correct: `Right — ${shifted} shift.`,
      why: `Each element after index ${index} moves one step, so ${shifted} shift.`,
      cost: {
        word: "scales",
        count: shifted,
        unit: shifted === 1 ? "element moved" : "elements moved",
      },
    },
    next: a,
  }
}

function makeResize(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const resizes = r.value === 0
  r = rngInt(a, 2)
  a = r.next
  const capacity = r.value === 0 ? 4 : 8

  let size: number
  if (resizes) {
    size = capacity
  } else {
    r = rngInt(a, capacity - 1)
    a = r.next
    size = 1 + r.value // 1..capacity-1
  }

  const options: ArraysOption[] = [
    { id: "yes", label: "Yes — grow the block and copy everything over" },
    { id: "no", label: "No — there's still room" },
  ]
  const sh = shuffle(options, a)
  a = sh.next

  return {
    question: {
      kind: "resize",
      prompt: `An array holds ${size} item${plural(size)} in a block sized for ${capacity}. Insert one more at the end — does it trigger a resize?`,
      array: [],
      highlight: -1,
      options: sh.result,
      answer: resizes ? "yes" : "no",
      hint: "Compare the item count to the block size.",
      nudge: "A resize happens only when the block is already full.",
      correct: resizes
        ? "Right — it's full, so it must grow."
        : "Right — there's room, so no resize.",
      why: resizes
        ? `All ${capacity} slots are used, so inserting forces a bigger block and copies all ${size} over — the occasional big reshuffle.`
        : `Only ${size} of ${capacity} slots are used, so the new item drops in with no copying.`,
      cost: resizes
        ? { word: "scales", count: size, unit: "items copied" }
        : { word: "free", count: 1, unit: "step" },
    },
    next: a,
  }
}

/* ------------------------------- construction ------------------------------- */

const FRESH = {
  selected: null,
  accessed: null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
}

function enterPart(state: ArraysState, index: number): ArraysState {
  const part = ARRAYS_PARTS[index]
  const base = { ...state, partIndex: index, ...FRESH }
  if (part === "access") return { ...base, question: makeAccess() }
  if (part === "shift") {
    const { question, next } = makeShift(state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "cost") {
    const { question, next } = makeCost(state.rngState)
    return { ...base, question, rngState: next }
  }
  const { question, next } = makeResize(state.rngState)
  return { ...base, question, rngState: next }
}

export function createArrays(seed: number = Date.now()): ArraysState {
  const init: ArraysState = {
    seed,
    rngState: seed,
    partIndex: 0,
    shiftCorrect: 0,
    costCorrect: 0,
    resizeCorrect: 0,
    attempts: 0,
    question: null,
    accessed: null,
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

/* --------------------------------- reducer --------------------------------- */

export function arraysReducer(
  state: ArraysState,
  action: LessonAction,
): ArraysState {
  const part = ARRAYS_PARTS[state.partIndex]

  switch (action.type) {
    case "continue":
      if (part !== "access") return state
      return enterPart(state, 1)

    case "select": {
      if (isTerminalA(state)) return state
      if (part === "access") return { ...state, accessed: Number(action.letter) }
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "check": {
      if (part === "access") return state
      if (!state.question || state.selected == null) return state
      if (isTerminalA(state)) return state

      const correct = state.selected === state.question.answer
      const v = gradeAnswer(state, correct)
      const next: ArraysState = {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
      }
      if (v.correct) {
        if (part === "shift") next.shiftCorrect = state.shiftCorrect + 1
        else if (part === "cost") next.costCorrect = state.costCorrect + 1
        else if (part === "resize") next.resizeCorrect = state.resizeCorrect + 1
      }
      return next
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      if (part === "shift") {
        const { question, next } = makeShift(state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      if (part === "cost") {
        const { question, next } = makeCost(state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      if (part === "resize") {
        const { question, next } = makeResize(state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      return state
    }

    case "next": {
      if (state.feedback !== "correct") return state
      if (part === "shift") {
        if (state.shiftCorrect >= SHIFT_QUOTA) return enterPart(state, 2)
        const { question, next } = makeShift(state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      if (part === "cost") {
        if (state.costCorrect >= COST_QUOTA) return enterPart(state, 3)
        const { question, next } = makeCost(state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      if (part === "resize") {
        if (state.resizeCorrect >= RESIZE_QUOTA)
          return { ...state, ...FRESH, completed: true }
        const { question, next } = makeResize(state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      return state
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

export function partQuotaArrays(
  state: ArraysState,
): { done: number; total: number } | null {
  switch (currentPartArrays(state)) {
    case "shift":
      return { done: state.shiftCorrect, total: SHIFT_QUOTA }
    case "cost":
      return { done: state.costCorrect, total: COST_QUOTA }
    case "resize":
      return { done: state.resizeCorrect, total: RESIZE_QUOTA }
    default:
      return null
  }
}

/** The hard mastery gate: 3 shift-predicts + 3 cost-counts + 2 resize-predicts. */
export function isCompleteArrays(state: ArraysState): boolean {
  return (
    state.shiftCorrect >= SHIFT_QUOTA &&
    state.costCorrect >= COST_QUOTA &&
    state.resizeCorrect >= RESIZE_QUOTA
  )
}

export function hasProgressArrays(state: ArraysState): boolean {
  return (
    state.partIndex > 0 ||
    state.shiftCorrect > 0 ||
    state.costCorrect > 0 ||
    state.resizeCorrect > 0
  )
}

/* ----------------------------- resume / progress ----------------------------- */

export function toProgressArrays(s: ArraysState): LessonProgress {
  return {
    counters: {
      shiftPredict: s.shiftCorrect,
      costCount: s.costCorrect,
      resizePredict: s.resizeCorrect,
      attempts: s.attempts,
    },
    currentPart: currentPartArrays(s),
    completed: s.completed || isCompleteArrays(s),
  }
}

function clampA(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), max)
}

export function resumeArrays(
  progress: LessonProgress,
  seed: number = Date.now(),
): ArraysState {
  const base = createArrays(seed)
  const c = progress.counters
  const seeded: ArraysState = {
    ...base,
    shiftCorrect: clampA(c.shiftPredict ?? 0, SHIFT_QUOTA),
    costCorrect: clampA(c.costCount ?? 0, COST_QUOTA),
    resizeCorrect: clampA(c.resizePredict ?? 0, RESIZE_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, ARRAYS_PARTS.indexOf(progress.currentPart as ArraysPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
