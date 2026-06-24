import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"

/**
 * Pure, framework-agnostic Stacks & Queues engine (the redesign — see
 * docs/lessons/stacks-queues-redesign.md). One idea: LIFO vs FIFO, who gets
 * served next. The shipped lesson let a learner ace it by "tapping the tagged
 * top card"; this version never tags the exit and tests the rule through four
 * question types across an 11-beat flow, gated on all 8 graded beats.
 *
 * Deterministic + seedable: same state always yields the same question/verdict
 * (the no-AI guarantee). Reuses the shared feedback machine + flame
 * (`gradeAnswer`) and the same `LessonAction` / `LessonProgress` shapes; only
 * the structure model, verdicts, and gate are S&Q-specific.
 */

export const SQ_PARTS = [
  "stack-demo",
  "stack-teach",
  "stack-predict",
  "stack-realworld",
  "stack-construct",
  "queue-demo",
  "queue-teach",
  "queue-predict",
  "queue-realworld",
  "queue-construct",
  "compare",
] as const
export type SQPart = (typeof SQ_PARTS)[number]
export const SQ_TOTAL_PARTS = SQ_PARTS.length

export type Discipline = "stack" | "queue"

/** The 8 graded sub-skills; mastery = all 8 solved. */
export const SQ_SKILLS = [
  "stackPredict",
  "stackRealworld",
  "stackConstruct",
  "queuePredict",
  "queueRealworld",
  "queueConstruct",
  "classify",
  "contrast",
] as const
export type SQSkill = (typeof SQ_SKILLS)[number]
export const SQ_GATE = SQ_SKILLS.length // 8

export interface Cell {
  id: string
  label: string
}
export interface Option {
  id: string
  label: string
}

interface Copy {
  prompt: string
  hint: string
  nudge: string
  correct: string
  why: string
}

export interface PredictQuestion extends Copy {
  kind: "predict"
  skill: SQSkill
  discipline: Discipline
  theme: "letters" | "undo" | "printer"
  cells: Cell[] // container order: index 0 = the exit end (top / front)
  arrival: string[] // cell ids in arrival order (drives the build-in animation)
  answer: string // the cell id that leaves
}

export interface ClassifyQuestion extends Copy {
  kind: "classify"
  skill: "classify"
  inOrder: string[]
  outOrder: string[]
  options: Option[]
  answer: string // "stack" | "queue"
}

export interface ContrastQuestion extends Copy {
  kind: "contrast"
  skill: "contrast"
  arrival: string[]
  target: string // the item the prompt asks about
  options: Option[]
  answer: string // "stack" | "queue"
}

export interface ConstructQuestion extends Copy {
  kind: "construct"
  skill: SQSkill
  discipline: Discipline
  target: Cell[] // the desired EXIT order
  correctPush: string[] // the unique correct push order (cell ids)
}

export type SQQuestion =
  | PredictQuestion
  | ClassifyQuestion
  | ContrastQuestion
  | ConstructQuestion

export interface ConstructWork {
  loose: string[] // cells not yet pushed (display order)
  pushed: string[] // cells pushed so far, in push order
}

export interface SQState {
  seed: number
  rngState: number
  partIndex: number
  question: SQQuestion | null
  construct: ConstructWork | null
  compareStep: number // 0 = classify, 1 = contrast (within the compare beat)
  selected: string | null
  wrongCount: number
  feedback: Feedback
  revealed: boolean
  showWhy: boolean
  combo: number
  attempts: number
  solved: Record<SQSkill, boolean>
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

/* ------------------------------ curated content ------------------------------ */
/**
 * The fixed curated set (8 graded questions). Authored as data so a later pass
 * can swap in randomized variants without touching the engine — see the spec's
 * "seedable-now / randomized-later" decision. Cell ids are opaque; labels are
 * what the learner reads.
 */

/** Container order from arrival order: a stack puts the newest at the exit
 * (top), a queue keeps the oldest at the exit (front). index 0 is the exit. */
function containerOrder(arrival: string[], discipline: Discipline): string[] {
  return discipline === "stack" ? [...arrival].reverse() : arrival
}

function predict(
  skill: SQSkill,
  discipline: Discipline,
  theme: PredictQuestion["theme"],
  arrival: string[],
  labels: Record<string, string>,
  copy: Copy,
): PredictQuestion {
  const order = containerOrder(arrival, discipline)
  const cells = order.map((id) => ({ id, label: labels[id] }))
  return {
    kind: "predict",
    skill,
    discipline,
    theme,
    cells,
    arrival,
    answer: cells[0].id, // the exit end leaves first
    ...copy,
  }
}

function construct(
  skill: SQSkill,
  discipline: Discipline,
  targetIds: string[],
  labels: Record<string, string>,
  copy: Copy,
): ConstructQuestion {
  const target = targetIds.map((id) => ({ id, label: labels[id] }))
  // A stack reverses (push the reverse of the desired exit order); a queue
  // preserves (push exactly the desired exit order). Either way it is unique.
  const correctPush =
    discipline === "stack" ? [...targetIds].reverse() : [...targetIds]
  return { kind: "construct", skill, discipline, target, correctPush, ...copy }
}

const LETTERS: Record<string, string> = { A: "A", B: "B", C: "C" }

function makeGraded(
  part: SQPart,
  compareStep: number,
  rng: number,
): { question: SQQuestion; construct: ConstructWork | null; next: number } {
  let a = rng

  switch (part) {
    case "stack-predict":
      return {
        question: predict("stackPredict", "stack", "letters", ["A", "B", "C"], LETTERS, {
          prompt: "Pop one card. Which comes off?",
          hint: "A stack lets cards out the same end they went in — the top.",
          nudge: "Which card landed on top most recently?",
          correct: "Right — C was pushed last, so it pops first.",
          why: "Last in, first out: C went on last, so it sits on top and pops first.",
        }),
        construct: null,
        next: a,
      }

    case "stack-realworld":
      return {
        question: predict(
          "stackRealworld",
          "stack",
          "undo",
          ["w1", "w2", "w3"],
          { w1: "the", w2: "quick", w3: "fox" },
          {
            prompt: "You typed these words, then press Undo. Which disappears?",
            hint: "Undo is a stack — it removes your most recent action first.",
            nudge: "Which word did you type most recently?",
            correct: "Right — “fox” was typed last, so Undo removes it first.",
            why: "Undo is last-in, first-out: the most recent word, “fox”, is removed first.",
          },
        ),
        construct: null,
        next: a,
      }

    case "stack-construct":
      return {
        question: construct("stackConstruct", "stack", ["A", "B", "C"], LETTERS, {
          prompt: "Push the cards so they pop out in the order shown.",
          hint: "A stack reverses: the last card you push pops first.",
          nudge: "To pop A first, A has to be pushed last — on top.",
          correct: "Right — push C, B, A and they pop out A, B, C.",
          why: "A stack reverses order. To get A out first, push it last, so push C, then B, then A.",
        }),
        construct: { loose: shuffle(["A", "B", "C"], a).result, pushed: [] },
        next: shuffle(["A", "B", "C"], a).next,
      }

    case "queue-predict":
      return {
        question: predict("queuePredict", "queue", "letters", ["A", "B", "C"], LETTERS, {
          prompt: "Dequeue one item. Which leaves?",
          hint: "A queue lets items out the front — the end that has waited longest.",
          nudge: "Which item has been waiting the longest?",
          correct: "Right — A arrived first, so it leaves first.",
          why: "First in, first out: A joined first, so it is at the front and leaves first.",
        }),
        construct: null,
        next: a,
      }

    case "queue-realworld":
      return {
        question: predict(
          "queueRealworld",
          "queue",
          "printer",
          ["j1", "j2", "j3"],
          { j1: "report", j2: "essay", j3: "photo" },
          {
            prompt: "Three files are sent to the printer in this order. Which prints first?",
            hint: "A print queue is first-in, first-out.",
            nudge: "Which file was sent first?",
            correct: "Right — the report was sent first, so it prints first.",
            why: "A printer queue is first-in, first-out: the report was sent first, so it prints first.",
          },
        ),
        construct: null,
        next: a,
      }

    case "queue-construct":
      return {
        question: construct("queueConstruct", "queue", ["C", "A", "B"], LETTERS, {
          prompt: "Add the items so they come out in the order shown.",
          hint: "A queue keeps order — items leave in the same order they arrive.",
          nudge: "Whatever order you add them in is the order they leave.",
          correct: "Right — a queue preserves order, so add C, A, B.",
          why: "A queue is first-in, first-out: order is preserved, so to get C, A, B out, add them C, A, B.",
        }),
        construct: { loose: shuffle(["A", "B", "C"], a).result, pushed: [] },
        next: shuffle(["A", "B", "C"], a).next,
      }

    case "compare": {
      if (compareStep === 0) {
        const sh = shuffle(
          [
            { id: "stack", label: "A stack" },
            { id: "queue", label: "A queue" },
          ],
          a,
        )
        a = sh.next
        const q: ClassifyQuestion = {
          kind: "classify",
          skill: "classify",
          inOrder: ["A", "B", "C"],
          outOrder: ["C", "B", "A"],
          options: sh.result,
          answer: "stack",
          prompt: "Items went in A, B, C and came out C, B, A. Which structure is this?",
          hint: "Compare the order out to the order in.",
          nudge: "The output is the exact reverse of the input.",
          correct: "Right — reversed order is last-in, first-out: a stack.",
          why: "The output is the reverse of the input. Only a stack does that — last-in, first-out.",
        }
        return { question: q, construct: null, next: a }
      }
      const sh = shuffle(
        [
          { id: "stack", label: "A stack" },
          { id: "queue", label: "A queue" },
        ],
        a,
      )
      a = sh.next
      const q: ContrastQuestion = {
        kind: "contrast",
        skill: "contrast",
        arrival: ["A", "B", "C"],
        target: "C",
        options: sh.result,
        answer: "stack",
        prompt: "A, B, C go into both a stack and a queue. Which one hands you C first?",
        hint: "C went in last. Which structure serves the most recent first?",
        nudge: "A stack serves the newest item; a queue serves the oldest.",
        correct: "Right — a stack serves the most recent, so it gives you C first.",
        why: "C arrived last. A stack is last-in, first-out, so it serves C first; the queue serves A first.",
      }
      return { question: q, construct: null, next: a }
    }

    default:
      return { question: null as unknown as SQQuestion, construct: null, next: a }
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

const NO_SOLVED: Record<SQSkill, boolean> = {
  stackPredict: false,
  stackRealworld: false,
  stackConstruct: false,
  queuePredict: false,
  queueRealworld: false,
  queueConstruct: false,
  classify: false,
  contrast: false,
}

function isGradedPart(part: SQPart): boolean {
  return part !== "stack-demo" && part !== "stack-teach" && part !== "queue-demo" && part !== "queue-teach"
}

function enterPart(state: SQState, index: number): SQState {
  const part = SQ_PARTS[index]
  const base: SQState = {
    ...state,
    partIndex: index,
    compareStep: 0,
    construct: null,
    question: null,
    ...FRESH,
  }
  if (!isGradedPart(part)) return base
  const { question, construct, next } = makeGraded(part, 0, state.rngState)
  return { ...base, question, construct, rngState: next }
}

export function createStacksQueues(seed: number = Date.now()): SQState {
  const init: SQState = {
    seed,
    rngState: seed,
    partIndex: 0,
    question: null,
    construct: null,
    compareStep: 0,
    selected: null,
    wrongCount: 0,
    feedback: "idle",
    revealed: false,
    showWhy: false,
    combo: 0,
    attempts: 0,
    solved: { ...NO_SOLVED },
    completed: false,
  }
  return enterPart(init, 0)
}

/* --------------------------------- selectors -------------------------------- */

export function currentPart(state: SQState): SQPart {
  return SQ_PARTS[state.partIndex]
}

/** The graded sub-skill this beat proves, or null on demo/teach beats. */
export function beatSkill(state: SQState): SQSkill | null {
  const part = currentPart(state)
  switch (part) {
    case "stack-predict":
      return "stackPredict"
    case "stack-realworld":
      return "stackRealworld"
    case "stack-construct":
      return "stackConstruct"
    case "queue-predict":
      return "queuePredict"
    case "queue-realworld":
      return "queueRealworld"
    case "queue-construct":
      return "queueConstruct"
    case "compare":
      return state.compareStep === 0 ? "classify" : "contrast"
    default:
      return null
  }
}

export function solvedCount(state: SQState): number {
  return SQ_SKILLS.reduce((n, s) => n + (state.solved[s] ? 1 : 0), 0)
}

export function isTerminal(state: SQState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledParts(state: SQState): number {
  return state.completed ? SQ_TOTAL_PARTS : state.partIndex
}

/** Lesson-wide progress shown on graded beats ("n / 8 correct"); null elsewhere. */
export function partQuota(state: SQState): { done: number; total: number } | null {
  return beatSkill(state) ? { done: solvedCount(state), total: SQ_GATE } : null
}

/** The id that wins the current question (cell id, or "stack"/"queue"). */
export function answerOf(question: SQQuestion): string {
  if (question.kind === "construct") return question.correctPush.join(">")
  return question.answer
}

/** Construct: the legal drop target(s) — the bin mouth while cells remain loose. */
export function legalTargets(state: SQState): Set<string> {
  if (state.construct && state.construct.loose.length > 0)
    return new Set(["mouth"])
  return new Set()
}

/** Construct is ready to check once every loose cell has been pushed in. */
export function constructReady(state: SQState): boolean {
  return !!state.construct && state.construct.loose.length === 0
}

/* --------------------------------- reducer --------------------------------- */

function gradeConstruct(work: ConstructWork, q: ConstructQuestion): boolean {
  return (
    work.pushed.length === q.correctPush.length &&
    work.pushed.every((id, i) => id === q.correctPush[i])
  )
}

export function stacksQueuesReducer(
  state: SQState,
  action: LessonAction,
): SQState {
  const part = currentPart(state)

  switch (action.type) {
    case "continue": {
      // Non-graded beats (demo / teach) step forward; graded beats use `next`.
      if (isGradedPart(part)) return state
      if (state.partIndex >= SQ_TOTAL_PARTS - 1) return state
      return enterPart(state, state.partIndex + 1)
    }

    case "rewire": {
      // A construct push: move the chosen loose cell onto the bin, in push order.
      if (!state.construct || isTerminal(state)) return state
      if (action.to !== "mouth") return state
      if (!state.construct.loose.includes(action.from)) return state
      return {
        ...state,
        feedback: "idle",
        construct: {
          loose: state.construct.loose.filter((id) => id !== action.from),
          pushed: [...state.construct.pushed, action.from],
        },
      }
    }

    case "select": {
      if (isTerminal(state)) return state
      if (state.construct) return state // construct selects via rewire, not tap
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "check": {
      if (isTerminal(state) || !state.question) return state

      let correct: boolean
      if (state.question.kind === "construct") {
        if (!constructReady(state) || !state.construct) return state
        correct = gradeConstruct(state.construct, state.question)
      } else {
        if (state.selected == null) return state
        correct = state.selected === state.question.answer
      }

      const v = gradeAnswer(state, correct)
      const skill = beatSkill(state)
      const next: SQState = {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
        solved:
          v.correct && skill
            ? { ...state.solved, [skill]: true }
            : state.solved,
      }
      // A wrong construct order resets the bin so the learner can re-push.
      if (!v.correct && state.question.kind === "construct" && state.construct) {
        next.construct = {
          loose: [...state.construct.loose, ...state.construct.pushed],
          pushed: [],
        }
      }
      return next
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      // Same curated question; refill a construct's bin for a clean attempt.
      if (state.question?.kind === "construct" && state.construct) {
        const all = [...state.construct.pushed, ...state.construct.loose]
        const sh = shuffle(all, state.rngState)
        return {
          ...state,
          ...FRESH,
          rngState: sh.next,
          construct: { loose: sh.result, pushed: [] },
        }
      }
      return { ...state, ...FRESH }
    }

    case "next": {
      if (state.feedback !== "correct") return state
      // The compare beat holds two questions (classify → contrast).
      if (part === "compare" && state.compareStep === 0) {
        const { question, next } = makeGraded("compare", 1, state.rngState)
        return { ...state, ...FRESH, compareStep: 1, question, rngState: next }
      }
      if (state.partIndex >= SQ_TOTAL_PARTS - 1) {
        return { ...state, ...FRESH, completed: true }
      }
      return enterPart(state, state.partIndex + 1)
    }

    default:
      return state
  }
}

/* ----------------------------- resume / completion ----------------------------- */

/** The mastery gate: every one of the 8 graded beats answered correctly. */
export function isComplete(state: SQState): boolean {
  return SQ_SKILLS.every((s) => state.solved[s])
}

export function hasProgress(state: SQState): boolean {
  return state.partIndex > 0 || solvedCount(state) > 0
}

export function toProgress(s: SQState): LessonProgress {
  const counters: Record<string, number> = { attempts: s.attempts }
  for (const skill of SQ_SKILLS) counters[skill] = s.solved[skill] ? 1 : 0
  return {
    counters,
    currentPart: currentPart(s),
    completed: s.completed || isComplete(s),
  }
}

export function resumeStacksQueues(
  progress: LessonProgress,
  seed: number = Date.now(),
): SQState {
  const base = createStacksQueues(seed)
  const c = progress.counters
  const solved = { ...NO_SOLVED }
  for (const skill of SQ_SKILLS) solved[skill] = (c[skill] ?? 0) > 0
  const index = Math.max(0, SQ_PARTS.indexOf(progress.currentPart as SQPart))
  const seeded: SQState = {
    ...base,
    solved,
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const s = enterPart(seeded, index)
  return progress.completed || isComplete(s) ? { ...s, completed: true } : s
}
