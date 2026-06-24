import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Hash Tables lesson engine. One idea: a hash turns a
 * key *into its location*, so you jump straight to the value instead of
 * searching, until two keys collide, which is resolved by chaining (a little
 * linked list living in a bucket). The learner runs a toy-but-real rule
 * (sum the letter values, then `mod` the bucket count) and places the key, so
 * the squash is *felt*: different sums land in the same bucket.
 *
 * Twelve beats, nine graded behind the until-correct wall, aggregated into a
 * clean 3/3/3 gate across three bins (Hash / Collision / Lookup). Reuses the
 * shared feedback machine + flame (`gradeAnswer`) and the same LessonProgress
 * shape; only the structure model, verdicts, and quotas are Hash-specific.
 * Deterministic (seeded): same state always yields the same question/feedback.
 */

export const HASH_PARTS = [
  "demo", // 1  intro free-play (Step the box, watch the key fly)
  "teach-hash", // 2  teach: key→location; sum letters · mod B; deterministic
  "hash-cat", // 3  H1 place cat → bucket 4 (drag)                    Hash      ✓
  "hash-cat-again", // 4  H2 re-locate cat → SAME bucket (determinism)     Hash      ✓
  "hash-dog", // 5  H1 place dog → bucket 1 (drag)                    Hash      ✓
  "teach-collision", // 6  teach: collision; chaining = a mini linked list
  "collide-sun", // 7  H3 sun → bucket 4 (cat→sun)                       Collision ✓
  "collide-ant", // 8  H3 ant → bucket 0 (owl→fox→ant, deeper)           Collision ✓
  "collide-pig", // 9  H3 pig → bucket 2 (bee→pig, squash)               Collision ✓
  "lookup-found", // 10 H4 find fox: free (1 jump) vs scales              Lookup    ✓
  "lookup-absent", // 11 H4 is bat here? absent in one jump (free)         Lookup    ✓
  "realworld", // 12 H5 cloakroom: hang a coat on its hook               Lookup    ✓
] as const
export type HashPart = (typeof HASH_PARTS)[number]
export const HASH_TOTAL_PARTS = HASH_PARTS.length

/** The bucket count, fixed and shown on the figure. */
export const BUCKET_COUNT = 5
/** Correct answers required per bin to clear the gate (a clean 3/3/3 = 9). */
export const BIN_QUOTA = 3

export type HashBin = "hash" | "collision" | "lookup"
/** How the learner answers a beat. */
export type HashMode = "intro" | "drag" | "tap" | "mcq"
/**
 * The figure dressing for a beat: the bare bucket array, or the cloakroom
 * real-world skin (numbered hooks, hung coats). Purely presentational; the
 * bucket math is identical for both.
 */
export type HashSkin = "abstract" | "coatcheck"

export interface HashOption {
  id: string
  label: string
}

export interface HashCost {
  word: CostWord
  count: number
  unit: string
}

export interface HashQuestion {
  kind: HashPart
  bin: HashBin | null
  mode: HashMode
  prompt: string
  key: string | null
  bucketCount: number
  sum: number
  /** The correct bucket index for `key` (a pure function of the key). */
  bucket: number
  /** The pre-placed buckets/chains the learner reasons over (given). */
  table: Record<number, string[]>
  options: HashOption[]
  /** Winning option id (mcq) or the correct bucket target id (drag/tap). */
  answer: string
  /** H4 membership: is `key` present in its bucket's chain? */
  present: boolean
  /** The figure dressing: bare buckets, or the cloakroom (coat-check) skin. */
  skin: HashSkin
  cost: HashCost | null
  /** The "scales" scan a plain list would run, shown paired against `free`. */
  scanCost: HashCost | null
  hint: string
  nudge: string
  correct: string
  why: string
}

export interface HashTablesState {
  seed: number
  rngState: number
  partIndex: number
  hashCorrect: number // 0..3
  collisionCorrect: number // 0..3
  lookupCorrect: number // 0..3
  attempts: number
  question: HashQuestion | null
  /** Bucket id a key was dropped on (drag beats): transient, not persisted. */
  placement: string | null
  /** MCQ option id or tapped bucket id (tap beats). */
  selected: string | null
  wrongCount: number
  feedback: Feedback
  revealed: boolean
  showWhy: boolean
  combo: number
  completed: boolean
}

/* ----------------------------- pure hash helpers ----------------------------- */

/** Letter value: a=1 … z=26 (lowercase keys). */
export const letterValue = (c: string): number => c.toLowerCase().charCodeAt(0) - 96
/** The sum of a key's letter values. */
export const keySum = (key: string): number =>
  [...key].reduce((s, c) => s + letterValue(c), 0)
/** The bucket a key hashes to: `(Σ letter values) mod B`. */
export const bucketOf = (key: string, bucketCount: number = BUCKET_COUNT): number =>
  keySum(key) % bucketCount
/** A collision appends the new key to the TAIL of the bucket's chain. */
export const chainAfter = (chain: string[], key: string): string[] => [...chain, key]
/** Is `key` present in its bucket's chain? (membership on one short chain). */
export const present = (
  key: string,
  table: Record<number, string[]>,
  bucketCount: number = BUCKET_COUNT,
): boolean => (table[bucketOf(key, bucketCount)] ?? []).includes(key)

/**
 * The pure lookup trail for `key`: which bucket it hashes to, the chain that
 * lives there, and where (if anywhere) the key sits in that chain. Illustration
 * fuel for the "Trace the lookup" walk: `foundIndex` is the chain position on a
 * hit and `-1` when absent (the full chain is still returned so a trace can show
 * every node it checked). A pure selector: no state, quota, or verdict touched.
 */
export function searchTrail(
  key: string,
  table: Record<number, string[]>,
  bucketCount: number = BUCKET_COUNT,
): { bucket: number; chain: string[]; foundIndex: number } {
  const bucket = bucketOf(key, bucketCount)
  const chain = table[bucket] ?? []
  return { bucket, chain, foundIndex: chain.indexOf(key) }
}

/** The rewire/tap target id for bucket `i`. */
export const bucketTargetId = (i: number): string => `bucket-${i}`
/** The bucket index a target id refers to ("bucket-3" → 3), or -1. */
export const bucketIndexOf = (id: string): number =>
  id.startsWith("bucket-") ? Number(id.slice(7)) : -1

/* --------------------------- per-letter breakdown --------------------------- */

export interface LetterStep {
  ch: string
  value: number
  runningSum: number
}

/** The letter-by-letter compute trail (for the runnable box + SR announcement). */
export function letterSteps(key: string): LetterStep[] {
  let running = 0
  return [...key].map((ch) => {
    running += letterValue(ch)
    return { ch, value: letterValue(ch), runningSum: running }
  })
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

const INTRO_PARTS: ReadonlySet<HashPart> = new Set([
  "demo",
  "teach-hash",
  "teach-collision",
])
const DRAG_PARTS: ReadonlySet<HashPart> = new Set(["hash-cat", "hash-dog", "realworld"])
const TAP_PARTS: ReadonlySet<HashPart> = new Set([
  "hash-cat-again",
  "lookup-found",
  "lookup-absent",
])
const MCQ_PARTS: ReadonlySet<HashPart> = new Set([
  "collide-sun",
  "collide-ant",
  "collide-pig",
])

export const isIntroPart = (part: HashPart): boolean => INTRO_PARTS.has(part)
export const isDragPart = (part: HashPart): boolean => DRAG_PARTS.has(part)
export const isTapPart = (part: HashPart): boolean => TAP_PARTS.has(part)
export const isMcqPart = (part: HashPart): boolean => MCQ_PARTS.has(part)

function binOf(part: HashPart): HashBin | null {
  if (part === "hash-cat" || part === "hash-cat-again" || part === "hash-dog") return "hash"
  if (MCQ_PARTS.has(part)) return "collision"
  if (part === "lookup-found" || part === "lookup-absent" || part === "realworld")
    return "lookup"
  return null
}

/* ------------------------------ curated beat data ------------------------------ */

interface BeatSpec {
  key: string
  table: Record<number, string[]>
}

/** The worked-values fixture: the ground truth the build (and tests) grade on. */
const BEATS: Partial<Record<HashPart, BeatSpec>> = {
  "hash-cat": { key: "cat", table: {} },
  "hash-cat-again": { key: "cat", table: { 4: ["cat"] } },
  "hash-dog": { key: "dog", table: { 4: ["cat"] } },
  "collide-sun": { key: "sun", table: { 4: ["cat"] } },
  "collide-ant": { key: "ant", table: { 0: ["owl", "fox"] } },
  "collide-pig": { key: "pig", table: { 2: ["bee"] } },
  "lookup-found": { key: "fox", table: { 0: ["owl", "fox", "ant"] } },
  "lookup-absent": { key: "bat", table: { 3: ["elk"] } },
  "realworld": { key: "ivy", table: { 3: ["sam"] } },
}

const chainText = (chain: string[]): string => chain.join(" → ")

/* ------------------------------ question makers ------------------------------ */

function makeIntro(kind: "demo" | "teach-hash" | "teach-collision"): HashQuestion {
  const prompt =
    kind === "demo"
      ? "Run the box on a key and watch it fly to its bucket."
      : kind === "teach-hash"
        ? "A hash turns a key into a location: add the letters, then mod the buckets."
        : "Two keys, one bucket. That's a collision. A bucket chains them in a little list."
  return {
    kind,
    bin: null,
    mode: "intro",
    prompt,
    key: kind === "demo" ? "cat" : null,
    bucketCount: BUCKET_COUNT,
    sum: kind === "demo" ? keySum("cat") : 0,
    bucket: kind === "demo" ? bucketOf("cat") : -1,
    table: kind === "teach-collision" ? { 4: ["cat", "sun"] } : {},
    options: [],
    answer: "",
    present: false,
    skin: "abstract",
    cost: null,
    scanCost: null,
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

/** Hash-bin locate: run the rule, then place/locate the key in its bucket. */
function makeHash(part: "hash-cat" | "hash-cat-again" | "hash-dog"): HashQuestion {
  const { key, table } = BEATS[part]!
  const bucket = bucketOf(key)
  const drag = isDragPart(part)
  const again = part === "hash-cat-again"
  return {
    kind: part,
    bin: "hash",
    mode: drag ? "drag" : "tap",
    prompt: again
      ? `Hash ${key} again. Which bucket does it land in?`
      : drag
        ? `Run the hash on ${key}, then drop it in its bucket.`
        : `Run the hash on ${key}. Which bucket?`,
    key,
    bucketCount: BUCKET_COUNT,
    sum: keySum(key),
    bucket,
    table,
    options: [],
    answer: bucketTargetId(bucket),
    present: false,
    skin: "abstract",
    cost: null,
    scanCost: null,
    hint: again
      ? "Same key, same letters, same sum, so the same bucket."
      : `Add the letters of ${key}, then take the remainder mod ${BUCKET_COUNT}.`,
    nudge: `Re-add the letter values, then take the remainder when you divide by ${BUCKET_COUNT}.`,
    correct: again
      ? `Same key → same bucket. ${key} always lands in bucket ${bucket}.`
      : `${keySum(key)} mod ${BUCKET_COUNT} = ${bucket}, ${key} lives in bucket ${bucket}.`,
    why: again
      ? `A hash is deterministic: ${key}'s letters always sum to ${keySum(key)}, and ${keySum(key)} mod ${BUCKET_COUNT} is always ${bucket}. That's why a lookup can jump straight there.`
      : `${[...key].map((c) => letterValue(c)).join(" + ")} = ${keySum(key)}; ${keySum(key)} mod ${BUCKET_COUNT} = ${bucket}.`,
  }
}

/** Collision predict-next-state: where does the new key go in an occupied bucket? */
function makeCollision(
  part: "collide-sun" | "collide-ant" | "collide-pig",
  seed: number,
): { question: HashQuestion; next: number } {
  const { key, table } = BEATS[part]!
  const bucket = bucketOf(key)
  const chain = table[bucket] ?? []
  const appended = chainAfter(chain, key)

  const options: HashOption[] = [
    { id: "append", label: chainText(appended) },
    { id: "overwrite", label: `${key} (replaces ${chainText(chain)})` },
    { id: "reject", label: `${chainText(chain)} (the new key is dropped)` },
    { id: "probe", label: `${key} jumps to the next empty bucket` },
  ]
  const sh = shuffle(options, seed)

  return {
    question: {
      kind: part,
      bin: "collision",
      mode: "mcq",
      prompt: `${key} hashes to bucket ${bucket}, where ${chainText(chain)} already sits. What's in bucket ${bucket} now?`,
      key,
      bucketCount: BUCKET_COUNT,
      sum: keySum(key),
      bucket,
      table,
      options: sh.result,
      answer: "append",
      present: false,
      skin: "abstract",
      cost: null,
      scanCost: null,
      hint: "A bucket doesn't overwrite. It keeps both, in a little chain.",
      nudge: "The old key stays. The new one links onto the end of the chain.",
      correct: `Right, ${key} chains onto the end: ${chainText(appended)}.`,
      why: `A collision doesn't replace or reject. The bucket holds a mini linked list, so ${key} is appended: ${chainText(appended)}. (Jumping to another bucket is a different scheme we're not using.)`,
    },
    next: sh.next,
  }
}

/** Lookup locate + cost: jump to the bucket; found or absent, both in one jump. */
function makeLookup(part: "lookup-found" | "lookup-absent"): HashQuestion {
  const { key, table } = BEATS[part]!
  const bucket = bucketOf(key)
  const chain = table[bucket] ?? []
  const isPresent = chain.includes(key)
  const scanLen = Object.values(table).reduce((n, c) => n + c.length, 0)
  return {
    kind: part,
    bin: "lookup",
    mode: "tap",
    prompt: isPresent
      ? `Where is ${key} stored? Tap its bucket.`
      : `Is ${key} here? Tap the bucket it would be in.`,
    key,
    bucketCount: BUCKET_COUNT,
    sum: keySum(key),
    bucket,
    table,
    options: [],
    answer: bucketTargetId(bucket),
    present: isPresent,
    skin: "abstract",
    cost: { word: "free", count: 1, unit: "jump to the bucket" },
    scanCost: {
      word: "scales",
      count: scanLen,
      unit: scanLen === 1 ? "item scanned" : "items scanned",
    },
    hint: `Hash ${key} first. That's the bucket to check.`,
    nudge: `Run the rule on ${key}; the remainder is the only bucket to look in.`,
    correct: isPresent
      ? `Found ${key} in bucket ${bucket}. One jump, no scan.`
      : `${key} isn't in bucket ${bucket}. Absent in one jump, no scan.`,
    why: isPresent
      ? `Hashing ${key} jumps straight to bucket ${bucket}; you check only its short chain. Free, never the whole table.`
      : `Hashing ${key} jumps to bucket ${bucket}; ${key} isn't in that chain, so it's absent. Known in one jump, not a scan of everything.`,
  }
}

/** Real-world skin (cloakroom): hang a coat on the hook the name hashes to. */
function makeRealworld(): HashQuestion {
  const { key, table } = BEATS["realworld"]!
  const bucket = bucketOf(key)
  return {
    kind: "realworld",
    bin: "lookup",
    mode: "drag",
    prompt: `Hang ${key}'s coat on its hook.`,
    key,
    bucketCount: BUCKET_COUNT,
    sum: keySum(key),
    bucket,
    table,
    options: [],
    answer: bucketTargetId(bucket),
    present: false,
    skin: "coatcheck",
    cost: { word: "free", count: 1, unit: "jump to the hook" },
    scanCost: null,
    hint: `A cloakroom routes a coat the same way: sum the letters of ${key}, then mod ${BUCKET_COUNT}.`,
    nudge: `Run the rule on ${key}; the remainder is the hook number.`,
    correct: `${keySum(key)} mod ${BUCKET_COUNT} = ${bucket}: ${key}'s coat hangs on hook ${bucket}, fetched in one jump.`,
    why: `A cloakroom hashes the name to a hook, so checking a coat in and fetching it are both one jump, never a walk down the whole rail.`,
  }
}

/* ------------------------------- construction ------------------------------- */

const FRESH = {
  placement: null,
  selected: null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
}

function buildQuestion(part: HashPart, seed: number): { question: HashQuestion; next: number } {
  if (part === "demo" || part === "teach-hash" || part === "teach-collision") {
    return { question: makeIntro(part), next: seed }
  }
  if (part === "hash-cat" || part === "hash-cat-again" || part === "hash-dog") {
    return { question: makeHash(part), next: seed }
  }
  if (part === "collide-sun" || part === "collide-ant" || part === "collide-pig") {
    return makeCollision(part, seed)
  }
  if (part === "lookup-found" || part === "lookup-absent") {
    return { question: makeLookup(part), next: seed }
  }
  return { question: makeRealworld(), next: seed }
}

function enterPart(state: HashTablesState, index: number): HashTablesState {
  const part = HASH_PARTS[index]
  const { question, next } = buildQuestion(part, state.rngState)
  return { ...state, partIndex: index, ...FRESH, question, rngState: next }
}

export function createHashTables(seed: number = Date.now()): HashTablesState {
  const init: HashTablesState = {
    seed,
    rngState: seed,
    partIndex: 0,
    hashCorrect: 0,
    collisionCorrect: 0,
    lookupCorrect: 0,
    attempts: 0,
    question: null,
    placement: null,
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

export function currentPartHash(state: HashTablesState): HashPart {
  return HASH_PARTS[state.partIndex]
}

/** A verdict is terminal once correct or failed: the question locks. */
export function isTerminalHash(state: HashTablesState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledPartsHash(state: HashTablesState): number {
  return state.completed ? HASH_TOTAL_PARTS : state.partIndex
}

function binProgress(state: HashTablesState, bin: HashBin): number {
  if (bin === "hash") return state.hashCorrect
  if (bin === "collision") return state.collisionCorrect
  return state.lookupCorrect
}

/** "n of 9" header for a graded beat (cumulative across the three bins). */
export function partQuotaHash(
  state: HashTablesState,
): { done: number; total: number } | null {
  const bin = binOf(currentPartHash(state))
  if (!bin) return null
  return { done: binProgress(state, bin), total: BIN_QUOTA }
}

/** Every bucket is a legal (keyboard-reachable, highlightable) drop target. */
export function legalBuckets(state: HashTablesState): Set<string> {
  const q = state.question
  const count = q?.bucketCount ?? BUCKET_COUNT
  return new Set(Array.from({ length: count }, (_, i) => bucketTargetId(i)))
}

/** Can the learner press Check? Drag beats need a drop; tap/mcq need a pick. */
export function canCheckHash(state: HashTablesState): boolean {
  const part = currentPartHash(state)
  if (isDragPart(part)) return state.placement != null
  if (isTapPart(part) || isMcqPart(part)) return state.selected != null
  return false
}

/** The hard mastery gate: clear all three bins (3 + 3 + 3 = 9). */
export function isCompleteHash(state: HashTablesState): boolean {
  return (
    state.hashCorrect >= BIN_QUOTA &&
    state.collisionCorrect >= BIN_QUOTA &&
    state.lookupCorrect >= BIN_QUOTA
  )
}

export function hasProgressHash(state: HashTablesState): boolean {
  return (
    state.partIndex > 0 ||
    state.hashCorrect > 0 ||
    state.collisionCorrect > 0 ||
    state.lookupCorrect > 0
  )
}

/* --------------------------------- reducer --------------------------------- */

function bumpBin(state: HashTablesState, bin: HashBin): void {
  if (bin === "hash") state.hashCorrect = Math.min(BIN_QUOTA, state.hashCorrect + 1)
  else if (bin === "collision")
    state.collisionCorrect = Math.min(BIN_QUOTA, state.collisionCorrect + 1)
  else state.lookupCorrect = Math.min(BIN_QUOTA, state.lookupCorrect + 1)
}

export function hashTablesReducer(
  state: HashTablesState,
  action: LessonAction,
): HashTablesState {
  const part = currentPartHash(state)

  switch (action.type) {
    case "continue": {
      if (!isIntroPart(part)) return state
      if (state.partIndex >= HASH_TOTAL_PARTS - 1) return state
      return enterPart(state, state.partIndex + 1)
    }

    case "select": {
      if (isTerminalHash(state)) return state
      if (!isTapPart(part) && !isMcqPart(part)) return state
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "rewire": {
      if (!isDragPart(part) || isTerminalHash(state)) return state
      // Record the drop; the engine grades on Check. Every bucket is legal to
      // drop on (highlight only). Landing on the wrong one is the learner's pick.
      return { ...state, placement: action.to, feedback: "idle" }
    }

    case "check": {
      if (!state.question || isTerminalHash(state)) return state
      const q = state.question
      const bin = binOf(part)
      if (!bin) return state

      let correct: boolean
      if (isDragPart(part)) {
        if (state.placement == null) return state
        correct = state.placement === q.answer
      } else {
        if (state.selected == null) return state
        correct = state.selected === q.answer
      }

      const v = gradeAnswer(state, correct)
      const next: HashTablesState = {
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
      // A fresh instance: re-shuffle MCQ options; reset the drag/tap pick.
      const { question, next } = buildQuestion(part, state.rngState)
      return { ...state, ...FRESH, question, rngState: next }
    }

    case "next": {
      if (state.feedback !== "correct") return state
      if (state.partIndex >= HASH_TOTAL_PARTS - 1) {
        return { ...state, ...FRESH, completed: true }
      }
      return enterPart(state, state.partIndex + 1)
    }

    default:
      return state
  }
}

/* ----------------------------- resume / progress ----------------------------- */

export function toProgressHash(s: HashTablesState): LessonProgress {
  return {
    counters: {
      hash: s.hashCorrect,
      collision: s.collisionCorrect,
      lookup: s.lookupCorrect,
      attempts: s.attempts,
    },
    currentPart: currentPartHash(s),
    completed: s.completed || isCompleteHash(s),
  }
}

function clampH(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), max)
}

export function resumeHashTables(
  progress: LessonProgress,
  seed: number = Date.now(),
): HashTablesState {
  const base = createHashTables(seed)
  const c = progress.counters
  const seeded: HashTablesState = {
    ...base,
    hashCorrect: clampH(c.hash ?? 0, BIN_QUOTA),
    collisionCorrect: clampH(c.collision ?? 0, BIN_QUOTA),
    lookupCorrect: clampH(c.lookup ?? 0, BIN_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, HASH_PARTS.indexOf(progress.currentPart as HashPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
