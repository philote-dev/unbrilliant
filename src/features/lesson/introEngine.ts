import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"

/**
 * Pure, framework-agnostic "Intro to Data Structures" engine. A schema-activation
 * lesson (the big picture: data is stored, sorted, and grouped) rather than one of
 * the seven backbone trade-off lessons. Same state always yields the same verdict
 * (the deterministic, no-AI guarantee): every check is a hand-authored MCQ graded
 * by equality on visible state, behind the shared feedback machine (`gradeAnswer`).
 *
 * One engine drives two reading-shape prototypes via `variant`:
 *  - "reveal" (Prototype A): an animated welcome, then each concept is taught inline
 *    ("Quick idea") and the question pops up under it; a short wrap. Interleaved.
 *  - "pages"  (Prototype B): an animated welcome, then large, centered reading pages,
 *    then the same checks as a session. Deeper reading.
 * The checks (the gate) are identical across variants; only the reading differs.
 */

export type IntroVariant = "reveal" | "pages"

export interface IntroOption {
  id: string
  label: string
  /** When set, the option renders as a tappable object picture (the why check). */
  visual?: "messy" | "neat"
}

/** An object icon shown with a check, for immersion (never a hint at the answer). */
export type CheckIcon = "wifi" | "contacts" | "photos" | "search"

/** A graded check: pick the one option that matches the scenario. */
export interface IntroCheck {
  /** Beat id AND the gate sub-skill id (unique within a variant's beats). */
  id: string
  /** An object icon for the scenario (immersion, NOT a hint at the answer). */
  icon: CheckIcon
  /** The everyday situation (its own line, so long prompts stay readable). */
  scenario: string
  /** The actual question, emphasized under the scenario. */
  ask: string
  options: IntroOption[]
  answer: string
  /** Combined scenario + ask, kept for the shared FeedbackFooter copy shape. */
  prompt: string
  hint: string
  nudge: string
  correct: string
  why: string
}

/** A welcoming hero beat (animated): the lesson's opening thesis. */
export interface WelcomeBeat {
  kind: "welcome"
  id: string
  headline: string
  sub: string
  cta: string
}

/** An icon-bulleted example row (the icon is the bullet). */
export type ExampleIcon = "package" | "book"
export interface ReadExample {
  icon: ExampleIcon
  text: string
}

/** A non-graded reading beat: a large, centered page of teaching content. */
export interface ReadBeat {
  kind: "read"
  id: string
  eyebrow: string
  title: string
  body: string[]
  /** Ordered key phrases that glow one after another as a reading guide. */
  highlights?: string[]
  /** A centered figure between the title and body (currently the phone mockup). */
  figure?: "phone"
  /** Icon-bulleted examples shown above the body (body becomes the takeaway). */
  examples?: ReadExample[]
  /** Render the three-jobs cards on this page (tap-to-reveal; Prototype B). */
  jobs?: boolean
  /** Override the advance-button label (defaults to "Continue"). */
  cta?: string
}

export type Beat = WelcomeBeat | ReadBeat | ({ kind: "check" } & IntroCheck)

/* ------------------------------ shared content ------------------------------ */

/** The three jobs, reused by the jobs figure and the job checks' options. */
export const JOBS = [
  { id: "store", word: "Store", line: "Keep something so you can get it back later." },
  { id: "sort", word: "Sort", line: "Put things in an order." },
  { id: "categorize", word: "Categorize", line: "Group like with like." },
] as const

const JOB_OPTIONS: IntroOption[] = [
  { id: "store", label: "Store (keep it to get back later)" },
  { id: "sort", label: "Sort (put it in order)" },
  { id: "categorize", label: "Categorize (group like with like)" },
]

/** The shared welcome hero, used to open both prototypes. */
const WELCOME: WelcomeBeat = {
  kind: "welcome",
  id: "welcome",
  headline: "You already do this.",
  sub: "You have spent your whole life sorting, stashing, and grouping things. Let's name what you already know.",
  cta: "Begin",
}

const CHECK_STORE: IntroCheck = {
  id: "store",
  icon: "wifi",
  scenario: "You save a Wi-Fi password so your phone reconnects on its own.",
  ask: "Which job is that?",
  options: JOB_OPTIONS,
  answer: "store",
  prompt:
    "You save a Wi-Fi password so your phone reconnects on its own. Which job is that?",
  hint: "Think about what you want to happen later: get the exact thing back.",
  nudge: "You are tucking something away to fetch it again, not ordering or grouping.",
  correct: "Right. Tucking it away to fetch later is storing.",
  why: "Storing is about keeping a thing so you can retrieve it on demand, like a saved password or a locker.",
}

const CHECK_SORT: IntroCheck = {
  id: "sort",
  icon: "contacts",
  scenario: "You line up your contacts from A to Z.",
  ask: "Which job is that?",
  options: JOB_OPTIONS,
  answer: "sort",
  prompt: "You line up your contacts from A to Z. Which job is that?",
  hint: "A to Z is a sequence. Which job arranges things in a sequence?",
  nudge: "You are arranging into one ordered line, not making groups.",
  correct: "Right. A to Z is an order, so that is sorting.",
  why: "Sorting arranges items along some order: alphabetical, biggest first, newest first.",
}

const CHECK_CATEGORIZE: IntroCheck = {
  id: "categorize",
  icon: "photos",
  scenario: "You drop your photos into Trips, Family, and Food.",
  ask: "Which job is that?",
  options: JOB_OPTIONS,
  answer: "categorize",
  prompt: "You drop your photos into Trips, Family, and Food. Which job is that?",
  hint: "You are making buckets that belong together.",
  nudge: "You are making groups, not a single ordered line.",
  correct: "Right. Like with like is categorizing.",
  why: "Categorizing groups items that belong together, like albums or folders, with no order needed inside.",
}

const CHECK_WHY: IntroCheck = {
  id: "why",
  icon: "search",
  scenario: "You need one business card, fast.",
  ask: "Which one finds it faster?",
  options: [
    { id: "book", label: "Alphabetized", visual: "neat" },
    { id: "box", label: "Loose shoebox", visual: "messy" },
  ],
  answer: "book",
  prompt: "You need one business card, fast. Which one finds it faster?",
  hint: "Which one lets you skip straight to the right card?",
  nudge: "With a loose pile you check cards one by one. The order saves that.",
  correct: "Right. The order lets you jump straight to it.",
  why: "Same cards, different effort: the organized set lets you skip straight to the card instead of checking every one.",
}

export const INTRO_CHECKS: IntroCheck[] = [
  CHECK_STORE,
  CHECK_SORT,
  CHECK_CATEGORIZE,
  CHECK_WHY,
]

/** The graded sub-skills: complete = all four answered correctly. */
export const CHECK_SKILLS: string[] = INTRO_CHECKS.map((c) => c.id)

const asCheckBeat = (c: IntroCheck): Beat => ({ kind: "check", ...c })

/* ------------------------------ Prototype A: reveal ------------------------------ */

const REVEAL_WRAP: ReadBeat = {
  kind: "read",
  id: "wrap",
  eyebrow: "That is the big picture",
  title: "Organizing is a choice",
  body: [
    "Storing, sorting, and grouping are the jobs. The catch is that there is no single best way to do them.",
    "Each lesson ahead is one shape built for one job. Picking the right shape is the whole game.",
  ],
  cta: "Finish",
}

const REVEAL_BEATS: Beat[] = [
  WELCOME,
  asCheckBeat(CHECK_STORE),
  asCheckBeat(CHECK_SORT),
  asCheckBeat(CHECK_CATEGORIZE),
  asCheckBeat(CHECK_WHY),
  REVEAL_WRAP,
]

/* ------------------------------ Prototype B: pages ------------------------------ */

const PAGE_LOOK: ReadBeat = {
  kind: "read",
  id: "page-look",
  eyebrow: "Introduction \u00b7 1 of 3",
  title: "Look at your phone",
  figure: "phone",
  body: [
    "Behind every one of these is a data structure: a deliberate way to arrange information so it is easy to use.",
  ],
  highlights: ["data structure"],
}

const PAGE_WHY: ReadBeat = {
  kind: "read",
  id: "page-why",
  eyebrow: "Introduction \u00b7 2 of 3",
  title: "Why bother organizing?",
  examples: [
    {
      icon: "package",
      text: "A shoebox of loose cards: to find one, you check them one by one.",
    },
    {
      icon: "book",
      text: "The same cards alphabetized: you flip straight to the letter.",
    },
  ],
  body: ["Same information, wildly different effort. That gap is what organizing buys you."],
  highlights: ["one by one", "straight to the letter", "different effort"],
}

const PAGE_JOBS: ReadBeat = {
  kind: "read",
  id: "page-jobs",
  eyebrow: "Introduction \u00b7 3 of 3",
  title: "Three jobs, over and over",
  body: ["Almost everything a data structure does comes down to three jobs."],
  highlights: ["three jobs"],
  jobs: true,
  cta: "Start the questions",
}

const PAGES_BEATS: Beat[] = [
  WELCOME,
  PAGE_LOOK,
  PAGE_WHY,
  PAGE_JOBS,
  asCheckBeat(CHECK_STORE),
  asCheckBeat(CHECK_SORT),
  asCheckBeat(CHECK_CATEGORIZE),
  asCheckBeat(CHECK_WHY),
]

export const INTRO_BEATS: Record<IntroVariant, Beat[]> = {
  reveal: REVEAL_BEATS,
  pages: PAGES_BEATS,
}

export function totalParts(variant: IntroVariant): number {
  return INTRO_BEATS[variant].length
}

/* --------------------------------- state ---------------------------------- */

export interface IntroState {
  variant: IntroVariant
  seed: number
  partIndex: number
  selected: string | null
  wrongCount: number
  feedback: Feedback
  revealed: boolean
  showWhy: boolean
  combo: number
  attempts: number
  solved: Record<string, boolean>
  completed: boolean
}

const FRESH = {
  selected: null as string | null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
}

function noSolved(): Record<string, boolean> {
  const s: Record<string, boolean> = {}
  for (const id of CHECK_SKILLS) s[id] = false
  return s
}

export function createIntro(
  variant: IntroVariant,
  seed: number = Date.now(),
): IntroState {
  return {
    variant,
    seed,
    partIndex: 0,
    combo: 0,
    attempts: 0,
    solved: noSolved(),
    completed: false,
    ...FRESH,
  }
}

/* -------------------------------- selectors -------------------------------- */

export function currentBeat(state: IntroState): Beat {
  const beats = INTRO_BEATS[state.variant]
  return beats[Math.min(state.partIndex, beats.length - 1)]
}

export function isCheckBeat(beat: Beat): beat is { kind: "check" } & IntroCheck {
  return beat.kind === "check"
}

function isLast(state: IntroState): boolean {
  return state.partIndex >= INTRO_BEATS[state.variant].length - 1
}

/** A verdict is terminal once correct or failed: the question locks. */
export function isTerminal(state: IntroState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function solvedCount(state: IntroState): number {
  return CHECK_SKILLS.reduce((n, id) => n + (state.solved[id] ? 1 : 0), 0)
}

export function filledParts(state: IntroState): number {
  return state.completed ? totalParts(state.variant) : state.partIndex
}

/** Lesson-wide progress shown on check beats ("n / 4 correct"); null elsewhere. */
export function partQuota(
  state: IntroState,
): { done: number; total: number } | null {
  return isCheckBeat(currentBeat(state))
    ? { done: solvedCount(state), total: CHECK_SKILLS.length }
    : null
}

/** The id that wins the current check, or null on a reading/welcome beat. */
export function currentAnswer(state: IntroState): string | null {
  const beat = currentBeat(state)
  return isCheckBeat(beat) ? beat.answer : null
}

/* --------------------------------- reducer --------------------------------- */

export function introReducer(state: IntroState, action: LessonAction): IntroState {
  const beat = currentBeat(state)

  switch (action.type) {
    case "continue": {
      // Welcome + reading beats advance with Continue; checks advance via `next`.
      if (beat.kind === "check") return state
      if (isLast(state)) return { ...state, completed: true, ...FRESH }
      return { ...state, partIndex: state.partIndex + 1, ...FRESH }
    }

    case "select": {
      if (!isCheckBeat(beat) || isTerminal(state)) return state
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "check": {
      if (!isCheckBeat(beat) || isTerminal(state) || state.selected == null) {
        return state
      }
      const correct = state.selected === beat.answer
      const v = gradeAnswer(state, correct)
      return {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
        solved: v.correct ? { ...state.solved, [beat.id]: true } : state.solved,
      }
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt":
      return { ...state, ...FRESH }

    case "next": {
      if (state.feedback !== "correct") return state
      if (isLast(state)) return { ...state, completed: true, ...FRESH }
      return { ...state, partIndex: state.partIndex + 1, ...FRESH }
    }

    default:
      return state
  }
}

/* ----------------------------- resume / progress ---------------------------- */

/** The hard mastery gate: every one of the checks answered correctly. */
export function isComplete(state: IntroState): boolean {
  return CHECK_SKILLS.every((id) => state.solved[id])
}

export function hasProgress(state: IntroState): boolean {
  return state.partIndex > 0 || solvedCount(state) > 0
}

export function toProgress(state: IntroState): LessonProgress {
  const counters: Record<string, number> = { attempts: state.attempts }
  for (const id of CHECK_SKILLS) counters[id] = state.solved[id] ? 1 : 0
  return {
    counters,
    currentPart: currentBeat(state).id,
    completed: state.completed || isComplete(state),
  }
}

export function resumeIntro(
  variant: IntroVariant,
  progress: LessonProgress,
  seed: number = Date.now(),
): IntroState {
  const beats = INTRO_BEATS[variant]
  const solved = noSolved()
  for (const id of CHECK_SKILLS) solved[id] = (progress.counters[id] ?? 0) > 0
  const found = beats.findIndex((b) => b.id === progress.currentPart)
  const partIndex = found >= 0 ? found : 0
  const completed =
    progress.completed || CHECK_SKILLS.every((id) => solved[id])
  return {
    ...createIntro(variant, seed),
    solved,
    partIndex,
    attempts: Math.max(0, Math.trunc(progress.counters.attempts ?? 0)),
    completed,
  }
}
