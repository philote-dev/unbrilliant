import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"

/**
 * Pure, framework-agnostic Stacks & Queues engine (the redesign, see
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

/**
 * How a predict beat phrases the ask. The de-cue stays purely presentational:
 * the exit is still a pure function of the container order, just not labeled.
 * first-out = the exit end, last-out = the deep end, after-k = the cell that is
 * on top once the first k have left (0 < k < cells.length).
 */
export type PredictAsk =
  | { kind: "first-out" }
  | { kind: "last-out" }
  | { kind: "after-k"; k: number }

/**
 * The showpiece skin a predict beat wears. "letters" stays plain. "browser" is
 * the stack real-world (Browser Back); "printer" is the queue real-world (a print
 * queue: documents print in the order they were sent, first in first out).
 */
export type PredictTheme = "letters" | "browser" | "printer"

export interface PredictQuestion extends Copy {
  kind: "predict"
  skill: SQSkill
  discipline: Discipline
  theme: PredictTheme
  ask: PredictAsk
  cells: Cell[] // container order: index 0 = the exit end (top / front)
  arrival: string[] // cell ids in arrival order (drives the build-in animation)
  answer: string // the cell id that leaves (the pure consequence of `ask`)
}

export interface ClassifyQuestion extends Copy {
  kind: "classify"
  skill: "classify"
  inOrder: string[]
  outOrder: string[]
  options: Option[]
  answer: string // "stack" | "queue" | "neither"
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

/* ------------------------- pure verdicts (no model, ever) ------------------------- */
/**
 * Every S&Q verdict is a pure function of the visible container order or a
 * hand-authored bank. These helpers ARE those verdicts, exported so the Stage
 * figures (and the tests) compute the exact answer the engine grades on.
 */

const sameOrder = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * The cell a predict beat resolves to, by ask. first-out is the exit end,
 * last-out is the deep end, and after-k is the cell on top once the first k have
 * left (0 < k < cells.length, else a RangeError so a bad seed fails loudly).
 */
export function predictAnswer(cells: Cell[], ask: PredictAsk): string {
  switch (ask.kind) {
    case "first-out":
      return cells[0].id
    case "last-out":
      return cells[cells.length - 1].id
    case "after-k": {
      const { k } = ask
      if (!Number.isInteger(k) || k <= 0 || k >= cells.length) {
        throw new RangeError(
          `predictAnswer: after-k needs 0 < k < ${cells.length}, got ${k}`,
        )
      }
      return cells[k].id
    }
  }
}

/** The order items leave a container: a stack reverses arrival, a queue keeps it. */
export function drainOrder(arrival: string[], discipline: Discipline): string[] {
  return discipline === "stack" ? [...arrival].reverse() : [...arrival]
}

/** The 1-based step at which `target` leaves the container (0 if it never does). */
export function targetEmitStep(
  arrival: string[],
  target: string,
  discipline: Discipline,
): number {
  return drainOrder(arrival, discipline).indexOf(target) + 1
}

/**
 * Classify-by-behavior under the NO-INTERLEAVE frame (everything goes in, then
 * everything comes out): a clean reverse is a stack, the same order is a queue,
 * and anything else is neither (no single structure can produce it).
 */
export function classifyVerdict(
  inOrder: string[],
  outOrder: string[],
): "stack" | "queue" | "neither" {
  if (sameOrder(outOrder, [...inOrder].reverse())) return "stack"
  if (sameOrder(outOrder, inOrder)) return "queue"
  return "neither"
}

export interface ClassifyInstance {
  inOrder: string[]
  outOrder: string[]
}

/**
 * Hand-authored classify seeds, one per verdict: a clean reverse (stack), the
 * same order (queue), and the 3-1-2 pattern (neither: unreachable without
 * interleaving, so no single stack or queue produces it).
 */
export const CLASSIFY_BANK: ClassifyInstance[] = [
  { inOrder: ["A", "B", "C"], outOrder: ["C", "B", "A"] },
  { inOrder: ["A", "B", "C"], outOrder: ["A", "B", "C"] },
  { inOrder: ["A", "B", "C"], outOrder: ["C", "A", "B"] },
]

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
 * can swap in randomized variants without touching the engine (see the spec's
 * "seedable-now / randomized-later" decision). Cell ids are opaque; labels are
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
  theme: PredictTheme,
  arrival: string[],
  labels: Record<string, string>,
  ask: PredictAsk,
  copy: Copy,
): PredictQuestion {
  const order = containerOrder(arrival, discipline)
  const cells = order.map((id) => ({ id, label: labels[id] }))
  return {
    kind: "predict",
    skill,
    discipline,
    theme,
    ask,
    cells,
    arrival,
    answer: predictAnswer(cells, ask), // pure consequence of the ask + order
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

const LETTERS: Record<string, string> = { A: "A", B: "B", C: "C", D: "D" }

function makeGraded(
  part: SQPart,
  compareStep: number,
  rng: number,
): { question: SQQuestion; construct: ConstructWork | null; next: number } {
  let a = rng

  switch (part) {
    case "stack-predict":
      // De-cued + stepped back: two pops, then "what is on top?" (after-k, k=2).
      return {
        question: predict(
          "stackPredict",
          "stack",
          "letters",
          ["A", "B", "C", "D"],
          LETTERS,
          { kind: "after-k", k: 2 },
          {
            prompt: "Pop twice. After two pops, which card is on top?",
            hint: "Each pop lifts off the top card, so two pops clear the top two.",
            nudge: "Take the top two cards away, then read off the new top.",
            correct: "Right: D pops, then C, so B is on top.",
            why: "Pop removes the top card. D leaves first, then C, which leaves B on top.",
          },
        ),
        construct: null,
        next: a,
      }

    case "stack-realworld":
      // Browser Back skin: history is a stack; Back leaves the page on top (the
      // page you are on). Four pages so the pile reads as a real session. Labels
      // mirror browserHistory.ts PAGES (first four) for the fallback container;
      // the skin owns the real page identity. Copy stays generic (no title), so
      // the engine never couples to the skin's catalog.
      return {
        question: predict(
          "stackRealworld",
          "stack",
          "browser",
          ["p1", "p2", "p3", "p4"],
          { p1: "Search", p2: "Recipe", p3: "Map", p4: "Video" },
          { kind: "first-out" },
          {
            prompt: "You opened these pages in order, then press Back. Which page leaves the top of the history?",
            hint: "Browser history is a stack. Back returns you from the page you are on now.",
            nudge: "Which page did you open most recently?",
            correct: "Right: the page you opened most recently sits on top, so Back leaves it first.",
            why: "History is a stack. The newest page is on top, so Back leaves it before the older ones.",
          },
        ),
        construct: null,
        next: a,
      }

    case "stack-construct":
      return {
        question: construct("stackConstruct", "stack", ["A", "B", "C"], LETTERS, {
          prompt: "Push the cards so they pop out in the order shown.",
          hint: "",
          nudge: "To pop A first, A has to be pushed last, on top.",
          correct: "Right: push C, B, A and they pop out A, B, C.",
          why: "A stack reverses order. To get A out first, push it last, so push C, then B, then A.",
        }),
        construct: { loose: shuffle(["A", "B", "C"], a).result, pushed: [] },
        next: shuffle(["A", "B", "C"], a).next,
      }

    case "queue-predict":
      return {
        question: predict(
          "queuePredict",
          "queue",
          "letters",
          ["A", "B", "C"],
          LETTERS,
          { kind: "first-out" },
          {
            prompt: "Dequeue one item. Which leaves?",
            hint: "A queue lets items out the front, the end that has waited longest.",
            nudge: "Which item has been waiting the longest?",
            correct: "Right: A arrived first, so it leaves first.",
            why: "First in, first out: A joined first, so it is at the front and leaves first.",
          },
        ),
        construct: null,
        next: a,
      }

    case "queue-realworld":
      // Print-queue skin: a queue. Documents are sent to the printer in arrival
      // order and the front one (sent first) prints first. Four files so the
      // queue reads as a real line. Labels name the documents; copy stays generic
      // (FIFO), so the engine never couples to the skin's presentation.
      return {
        question: predict(
          "queueRealworld",
          "queue",
          "printer",
          ["c1", "c2", "c3", "c4"],
          { c1: "Report", c2: "Essay", c3: "Photo", c4: "Memo" },
          { kind: "first-out" },
          {
            prompt: "Documents are sent to the printer in this order. Which one prints first?",
            hint: "A print queue is a queue: first in, first out.",
            nudge: "Which document has been waiting in the queue the longest?",
            correct: "Right: the document sent first is at the front, so it prints first.",
            why: "A print queue is first in, first out. The document sent first is at the front, so it prints before the rest.",
          },
        ),
        construct: null,
        next: a,
      }

    case "queue-construct":
      return {
        question: construct("queueConstruct", "queue", ["C", "A", "B"], LETTERS, {
          prompt: "Add the items so they come out in the order shown.",
          hint: "",
          nudge: "Whatever order you add them in is the order they leave.",
          correct: "Right: a queue preserves order, so add C, A, B.",
          why: "A queue is first in, first out: order is preserved, so to get C, A, B out, add them C, A, B.",
        }),
        construct: { loose: shuffle(["A", "B", "C"], a).result, pushed: [] },
        next: shuffle(["A", "B", "C"], a).next,
      }

    case "compare":
      return compareStep === 0 ? makeClassify(a) : makeContrast(a)

    default:
      return { question: null as unknown as SQQuestion, construct: null, next: a }
  }
}

/* ------------------------------- compare makers ------------------------------- */

/** Per-verdict copy for the classify beat (the NO-INTERLEAVE frame is fixed). */
function classifyCopy(answer: "stack" | "queue" | "neither"): Copy {
  const prompt =
    "Everything goes in, then everything comes out. Which structure produced this order?"
  const hint = ""
  const nudge = "Check both: is the output the exact reverse, the exact same order, or neither?"
  if (answer === "stack") {
    return {
      prompt,
      hint,
      nudge,
      correct: "Right: the output is the exact reverse, which is last in, first out. A stack.",
      why: "Out is the reverse of in, and only a stack reverses a no-interleave batch (last in, first out).",
    }
  }
  if (answer === "queue") {
    return {
      prompt,
      hint,
      nudge,
      correct: "Right: the output keeps the input order, which is first in, first out. A queue.",
      why: "Out matches in, and a queue keeps a no-interleave batch in order (first in, first out).",
    }
  }
  return {
    prompt,
    hint,
    nudge,
    correct: "Right: that order is not a clean reverse or the same order, so it is neither.",
    why: "Everything goes in, then comes out: a stack gives the reverse, a queue the same order. This is neither, so no single structure produces it.",
  }
}

/** Classify: seed-select one bank instance, offer the three verdicts shuffled. */
function makeClassify(rng: number): {
  question: SQQuestion
  construct: null
  next: number
} {
  const pick = rngNext(rng)
  const inst = CLASSIFY_BANK[Math.floor(pick.value * CLASSIFY_BANK.length)]
  const answer = classifyVerdict(inst.inOrder, inst.outOrder)
  const sh = shuffle(
    [
      { id: "stack", label: "A stack" },
      { id: "queue", label: "A queue" },
      { id: "neither", label: "Neither" },
    ],
    pick.next,
  )
  const q: ClassifyQuestion = {
    kind: "classify",
    skill: "classify",
    inOrder: inst.inOrder,
    outOrder: inst.outOrder,
    options: sh.result,
    answer,
    ...classifyCopy(answer),
  }
  return { question: q, construct: null, next: sh.next }
}

/** Contrast: same input into both; the winner is whoever emits the target first. */
function makeContrast(rng: number): {
  question: SQQuestion
  construct: null
  next: number
} {
  const arrival = ["A", "B", "C"]
  const target = "C"
  const stackStep = targetEmitStep(arrival, target, "stack")
  const queueStep = targetEmitStep(arrival, target, "queue")
  const winner: Discipline = stackStep <= queueStep ? "stack" : "queue"
  const sh = shuffle(
    [
      { id: "stack", label: "A stack" },
      { id: "queue", label: "A queue" },
    ],
    rng,
  )
  const q: ContrastQuestion = {
    kind: "contrast",
    skill: "contrast",
    arrival,
    target,
    options: sh.result,
    answer: winner,
    prompt: `${arrival.join(", ")} go into both a stack and a queue. Which one hands you ${target} first?`,
    hint: "",
    nudge: "A stack serves the newest item; a queue serves the oldest.",
    correct: `Right: a stack serves the most recent, so it hands you ${target} first.`,
    why: `${target} arrived last. A stack is last in, first out, so it serves ${target} first; the queue serves ${arrival[0]} first.`,
  }
  return { question: q, construct: null, next: sh.next }
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

/** Construct: the legal drop target(s), i.e. the bin mouth while cells remain loose. */
export function legalTargets(state: SQState): Set<string> {
  if (state.construct && state.construct.loose.length > 0)
    return new Set(["mouth"])
  return new Set()
}

/** Construct is ready to check once every loose cell has been pushed in. */
export function constructReady(state: SQState): boolean {
  return !!state.construct && state.construct.loose.length === 0
}

/**
 * While building, the one pushed cell the learner can take back: the cell at the
 * structure's open end (top of a stack / back of a queue), which is the last id
 * in `pushed`. Null when no construct is active, the verdict is terminal, or
 * nothing is pushed. Mirrors the single accessible end a real stack/queue has.
 */
export function removablePushedCell(state: SQState): string | null {
  if (!state.construct || isTerminal(state)) return null
  const { pushed } = state.construct
  return pushed.length > 0 ? pushed[pushed.length - 1] : null
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
      // Construct edits via the shared rewire gesture: push a loose cell onto the
      // bin (to "mouth"), or take the open-end cell back to the tray (to "tray").
      // isTerminal already blocks both after a correct/fail verdict.
      if (!state.construct || isTerminal(state)) return state
      if (action.to === "mouth") {
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
      if (action.to === "tray") {
        // Only the cell at the structure's open end (the last pushed) can come
        // back: a stack/queue exposes one accessible end, so any other id no-ops.
        const { loose, pushed } = state.construct
        if (pushed.length === 0 || pushed[pushed.length - 1] !== action.from) {
          return state
        }
        return {
          ...state,
          feedback: "idle",
          construct: {
            loose: [...loose, action.from],
            pushed: pushed.slice(0, -1),
          },
        }
      }
      return state
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
