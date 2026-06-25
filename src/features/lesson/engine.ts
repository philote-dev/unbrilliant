import { SCENARIO_POOL, type Scenario } from "@/features/lesson/scenarios"

/**
 * Pure, framework-agnostic Stacks & Queues lesson engine. No React, no
 * Firebase, no animation lib. Same state always yields the same feedback
 * (the deterministic, no-AI guarantee). See CONTEXT.md.
 */

export type PartId =
  | "stack-build"
  | "stack-pop"
  | "queue-build"
  | "queue-dequeue"
  | "scenario"

export const PARTS: PartId[] = [
  "stack-build",
  "stack-pop",
  "queue-build",
  "queue-dequeue",
  "scenario",
]
export const TOTAL_PARTS = PARTS.length

export const POP_QUOTA = 3
export const DEQUEUE_QUOTA = 3
export const SCENARIO_QUOTA = 4
export const WRONG_LIMIT = 2
const BUILD_CARDS = ["A", "B", "C"]

export type Feedback = "idle" | "correct" | "nudge" | "fail"

export interface PredictionQuestion {
  kind: "pop" | "dequeue"
  cards: string[] // top → bottom
  answer: string // the card that leaves (always the top)
  topTag: "TOP" | "FRONT"
}

export interface ScenarioQuestion {
  kind: "scenario"
  scenario: Scenario
}

export type Question = PredictionQuestion | ScenarioQuestion

export interface LessonState {
  seed: number
  rngState: number
  partIndex: number
  popsCorrect: number
  dequeuesCorrect: number
  scenariosCorrect: number
  attempts: number
  built: string[]
  question: Question | null
  selected: string | null
  wrongCount: number
  feedback: Feedback
  revealed: boolean
  showWhy: boolean
  combo: number
  scenarioOrder: number[]
  scenarioPos: number
  completed: boolean
}

export type LessonAction =
  | { type: "build-step" }
  | { type: "continue" }
  | { type: "select"; letter: string }
  | { type: "check" }
  | { type: "reveal" }
  | { type: "reattempt" }
  | { type: "next" }
  // Shared, cross-lesson rewire gesture (drag/tap/keyboard "connect from → to").
  // Carries opaque source/target ids; the consuming engine decides correctness.
  | { type: "rewire"; from: string; to: string }

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
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return { result, next: a }
}

/* ------------------------------- construction ------------------------------- */

function makePrediction(
  kind: "pop" | "dequeue",
  seed: number,
): { question: PredictionQuestion; next: number } {
  const { result, next } = shuffle(["A", "B", "C"], seed)
  return {
    question: {
      kind,
      cards: result, // top → bottom
      answer: result[0], // top leaves in both structures
      topTag: kind === "pop" ? "TOP" : "FRONT",
    },
    next,
  }
}

function scenarioQuestion(order: number[], pos: number): ScenarioQuestion {
  return { kind: "scenario", scenario: SCENARIO_POOL[order[pos]] }
}

const FRESH = {
  selected: null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
}

function enterPart(state: LessonState, index: number): LessonState {
  const part = PARTS[index]
  const base = { ...state, partIndex: index, built: [], ...FRESH }

  if (part === "stack-pop") {
    const { question, next } = makePrediction("pop", state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "queue-dequeue") {
    const { question, next } = makePrediction("dequeue", state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "scenario") {
    return {
      ...base,
      question: scenarioQuestion(state.scenarioOrder, state.scenarioPos),
    }
  }
  // build parts
  return { ...base, question: null }
}

export function createLesson(seed: number = Date.now()): LessonState {
  const { result, next } = shuffle([0, 1, 2, 3, 4, 5, 6, 7], seed)
  return {
    seed,
    rngState: next,
    partIndex: 0,
    popsCorrect: 0,
    dequeuesCorrect: 0,
    scenariosCorrect: 0,
    attempts: 0,
    built: [],
    question: null,
    selected: null,
    wrongCount: 0,
    feedback: "idle",
    revealed: false,
    showWhy: false,
    combo: 0,
    scenarioOrder: result.slice(0, SCENARIO_QUOTA),
    scenarioPos: 0,
    completed: false,
  }
}

/* --------------------------------- reducer --------------------------------- */

export function lessonReducer(
  state: LessonState,
  action: LessonAction,
): LessonState {
  const part = PARTS[state.partIndex]

  switch (action.type) {
    case "build-step": {
      if (state.built.length >= BUILD_CARDS.length) return state
      return { ...state, built: [...state.built, BUILD_CARDS[state.built.length]] }
    }

    case "continue": {
      if (state.partIndex >= TOTAL_PARTS - 1) return state
      return enterPart(state, state.partIndex + 1)
    }

    case "select": {
      if (isTerminal(state)) return state
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "check": {
      if (!state.question || state.selected == null) return state
      if (isTerminal(state)) return state

      const correct = state.selected === answerOf(state.question)
      const v = gradeAnswer(state, correct)
      const next: LessonState = {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
      }
      if (v.correct) {
        if (part === "stack-pop") next.popsCorrect = state.popsCorrect + 1
        else if (part === "queue-dequeue")
          next.dequeuesCorrect = state.dequeuesCorrect + 1
        else if (part === "scenario")
          next.scenariosCorrect = state.scenariosCorrect + 1
      }
      return next
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      // fresh instance. New arrangement for predictions; same scenario to retry
      if (part === "stack-pop") {
        const { question, next } = makePrediction("pop", state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      if (part === "queue-dequeue") {
        const { question, next } = makePrediction("dequeue", state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      return { ...state, ...FRESH }
    }

    case "next": {
      if (state.feedback !== "correct") return state

      if (part === "stack-pop") {
        if (state.popsCorrect >= POP_QUOTA) return enterPart(state, 2)
        const { question, next } = makePrediction("pop", state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      if (part === "queue-dequeue") {
        if (state.dequeuesCorrect >= DEQUEUE_QUOTA) return enterPart(state, 4)
        const { question, next } = makePrediction("dequeue", state.rngState)
        return { ...state, ...FRESH, question, rngState: next }
      }
      if (part === "scenario") {
        if (state.scenariosCorrect >= SCENARIO_QUOTA) {
          return { ...state, completed: true, ...FRESH }
        }
        const pos = state.scenarioPos + 1
        return {
          ...state,
          ...FRESH,
          scenarioPos: pos,
          question: scenarioQuestion(state.scenarioOrder, pos),
        }
      }
      return state
    }

    default:
      return state
  }
}

/* -------------------------------- selectors -------------------------------- */

export function currentPart(state: LessonState): PartId {
  return PARTS[state.partIndex]
}

export function filledParts(state: LessonState): number {
  return state.completed ? TOTAL_PARTS : state.partIndex
}

export function nextBuildCard(state: LessonState): string | null {
  if (state.built.length >= BUILD_CARDS.length) return null
  return BUILD_CARDS[state.built.length]
}

export function partQuota(state: LessonState): { done: number; total: number } | null {
  switch (currentPart(state)) {
    case "stack-pop":
      return { done: state.popsCorrect, total: POP_QUOTA }
    case "queue-dequeue":
      return { done: state.dequeuesCorrect, total: DEQUEUE_QUOTA }
    case "scenario":
      return { done: state.scenariosCorrect, total: SCENARIO_QUOTA }
    default:
      return null
  }
}

/** The id that wins the current question: the top/front card, or the scenario's answer. */
export function answerOf(question: Question): string {
  return question.kind === "scenario" ? question.scenario.answer : question.answer
}

/** A verdict is terminal once correct or failed: the question locks. */
export function isTerminal(state: LessonState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

/* ------------------------- shared feedback machine ------------------------- */

export interface Verdict {
  feedback: Feedback
  wrongCount: number
  combo: number
  revealed: boolean
  correct: boolean
}

/**
 * The shared verdict transition for a checked answer, reused by every lesson so
 * the feedback machine + flame behave identically everywhere: a correct answer
 * reveals the correction and climbs the combo; a first wrong is a nudge (same
 * instance retained, fire kept); a second wrong is a full fail that reveals and
 * breaks the combo. Only "which counter to bump on correct" is lesson-specific.
 */
export function gradeAnswer(
  state: { combo: number; wrongCount: number; revealed: boolean },
  correct: boolean,
): Verdict {
  if (correct) {
    return {
      feedback: "correct",
      wrongCount: state.wrongCount,
      combo: state.combo + 1,
      revealed: true,
      correct: true,
    }
  }
  const wrongCount = state.wrongCount + 1
  if (wrongCount >= WRONG_LIMIT) {
    return { feedback: "fail", wrongCount, combo: 0, revealed: true, correct: false }
  }
  return {
    feedback: "nudge",
    wrongCount,
    combo: state.combo,
    revealed: state.revealed,
    correct: false,
  }
}

export interface QuestionCopy {
  prompt: string
  hint: string
  nudge: string
  correct: string
  why: string
}

export function questionCopy(question: Question): QuestionCopy {
  switch (question.kind) {
    case "pop": {
      const top = question.cards[0]
      return {
        prompt: "If we pop, which card is removed?",
        hint: "Tap the card you think pops, then check.",
        nudge: "Check which card went in last.",
        correct: `Last in, first out, so ${top} pops.`,
        why: `${top} was added last, so it sits on top and pops first.`,
      }
    }
    case "dequeue": {
      const front = question.cards[0]
      return {
        prompt: "If we dequeue, which item leaves?",
        hint: "Tap the item you think leaves, then check.",
        nudge: "Which item has been waiting the longest?",
        correct: `First in, first out, so ${front} leaves.`,
        why: `${front} was added first, so it's at the front and leaves first.`,
      }
    }
    case "scenario": {
      const s = question.scenario
      return {
        prompt: s.prompt,
        hint: "Pick who goes first, then check.",
        nudge:
          s.policy === "stack"
            ? "Think about what arrived most recently."
            : "Think about who has been waiting longest.",
        correct: s.reveal,
        why: s.reveal,
      }
    }
  }
}

/* ----------------------------- resume / completion ----------------------------- */

/** The hard mastery gate (see CONTEXT.md): 3 pops + 3 dequeues + 4 scenarios. */
export function isComplete(state: LessonState): boolean {
  return (
    state.popsCorrect >= POP_QUOTA &&
    state.dequeuesCorrect >= DEQUEUE_QUOTA &&
    state.scenariosCorrect >= SCENARIO_QUOTA
  )
}

/**
 * The persisted slice needed to resume a run on the same part. Per-lesson
 * correct-counts live in a lesson-shaped `counters` map (S&Q keys:
 * `pops` / `dequeues` / `scenarios`) so a second lesson can persist through the
 * same boundary without its own fixed fields.
 */
export interface ResumeProgress {
  counters: Record<string, number>
  // A lesson-shaped part id (S&Q PartId, Arrays part, ...). Kept as `string` so
  // the durable shape is lesson-agnostic across the shared persistence boundary.
  currentPart: string
}

/**
 * The full durable progress slice (the resume slice plus completion). This is
 * the shape the persistence boundary reads/writes; the engine owns it so the
 * sign-in `reconcile` decision can stay pure and dependency-free.
 */
export interface LessonProgress extends ResumeProgress {
  completed: boolean
}

/**
 * Rebuild a lesson at a persisted part with persisted correct-counts. Resume is
 * "same part", not "same instance". Predictions/scenarios get a fresh draw. The
 * combo/flame is transient by design and starts cold on resume.
 */
export function resumeLesson(
  progress: ResumeProgress,
  seed: number = Date.now(),
): LessonState {
  const base = createLesson(seed)
  const c = progress.counters
  const popsCorrect = clamp(c.pops ?? 0, POP_QUOTA)
  const dequeuesCorrect = clamp(c.dequeues ?? 0, DEQUEUE_QUOTA)
  const scenariosCorrect = clamp(c.scenarios ?? 0, SCENARIO_QUOTA)
  const index = Math.max(0, PARTS.indexOf(progress.currentPart as PartId))
  const seeded: LessonState = {
    ...base,
    popsCorrect,
    dequeuesCorrect,
    scenariosCorrect,
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
    scenarioPos: Math.min(scenariosCorrect, SCENARIO_QUOTA - 1),
  }
  return enterPart(seeded, index)
}

function clamp(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), max)
}

/* ------------------------------- reconcile -------------------------------- */

/** Squash a run down to its durable progress slice. */
export function toProgress(s: LessonState): LessonProgress {
  return {
    counters: {
      pops: s.popsCorrect,
      dequeues: s.dequeuesCorrect,
      scenarios: s.scenariosCorrect,
      attempts: s.attempts,
    },
    currentPart: currentPart(s),
    completed: s.completed || isComplete(s),
  }
}

/** Has this run earned anything worth carrying up to a new account? */
export function hasProgress(s: LessonState): boolean {
  return (
    s.partIndex > 0 ||
    s.popsCorrect > 0 ||
    s.dequeuesCorrect > 0 ||
    s.scenariosCorrect > 0
  )
}

/** The decision taken when a learner becomes signed-in (generic over lesson). */
export type ReconcilePlan<S = LessonState> =
  | { kind: "resume"; state: S }
  | { kind: "carry-up"; progress: LessonProgress }
  | { kind: "noop" }

/**
 * Pure sign-in reconciliation: compare the local in-memory run against the
 * server's saved progress and decide what to do. No React, no Firebase. The
 * effect just performs the I/O the plan implies.
 */
export function reconcile(
  local: LessonState,
  server: LessonProgress | null,
  seed?: number,
): ReconcilePlan {
  if (server) {
    // Returning account → server wins (resume on the same part). No merge.
    const state = resumeLesson(server, seed)
    return {
      kind: "resume",
      state: server.completed ? { ...state, completed: true } : state,
    }
  }
  if (hasProgress(local)) return { kind: "carry-up", progress: toProgress(local) }
  return { kind: "noop" }
}
