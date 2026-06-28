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
 * the squash is *felt*: different sums land in the same bucket. A later arc
 * makes the rule itself the lesson: a hash function is a *choice*, and a good
 * one spreads keys evenly so few collide (the hash-builder sandbox + the graded
 * design challenge grade on the resulting distribution).
 *
 * Fourteen beats, ten graded behind the until-correct wall, aggregated into a
 * 3/3/1/3 gate across four bins (Hash / Collision / Design / Lookup). Reuses the
 * shared feedback machine + flame (`gradeAnswer`) and the same LessonProgress
 * shape; only the structure model, verdicts, and quotas are Hash-specific.
 * Deterministic (seeded): same state always yields the same question/feedback.
 */

export const HASH_PARTS = [
  "demo", // 1  intro free-play: abstract sorted-scan vs hashed-jump sandbox
  "teach-hash", // 2  teach (interactive): key→location; sum letters · mod B; deterministic
  "hash-cat", // 3  H1 place cat → bucket 4 (drag)                    Hash      ✓
  "hash-cat-again", // 4  H2 locate a FRESH key (de-cued determinism)      Hash      ✓
  "hash-dog", // 5  H1 place dog → bucket 1 (drag)                    Hash      ✓
  "teach-collision", // 6  teach: collision; chaining = a mini linked list (animated)
  "collide-sun", // 7  H3 sun → bucket 4 (cat→sun)                       Collision ✓
  "collide-ant", // 8  H3 ant → bucket 0 (owl→fox→ant, deeper)           Collision ✓
  "collide-pig", // 9  H3 pig → bucket 2 (bee→pig, squash)               Collision ✓
  "hash-build-demo", // 10 free-play: pick a rule + bucket count, drop keys, watch collisions
  "hash-design", // 11 graded: design a rule + bucket count that spreads the keys  Design ✓
  "lookup-found", // 12 H4 find fox: free (1 jump) vs scales              Lookup    ✓
  "lookup-absent", // 13 H4 is bat here? absent in one jump (free)         Lookup    ✓
  "realworld", // 14 H5 warehouse: stow a package in its bin               Lookup    ✓
] as const
export type HashPart = (typeof HASH_PARTS)[number]
export const HASH_TOTAL_PARTS = HASH_PARTS.length

/** The bucket count for the curated (sum-rule) beats, fixed and shown on the figure. */
export const BUCKET_COUNT = 5
/** Correct answers required to clear a three-rep bin (Hash / Collision / Lookup). */
export const BIN_QUOTA = 3
/** Reps required to clear the design bin (one graded design challenge). */
export const DESIGN_QUOTA = 1
/** The hard mastery gate: Hash 3 + Collision 3 + Design 1 + Lookup 3 = 10. */
export const GATE_TOTAL = BIN_QUOTA * 3 + DESIGN_QUOTA

export type HashBin = "hash" | "collision" | "design" | "lookup"
/** How the learner answers a beat. */
export type HashMode = "intro" | "drag" | "tap" | "mcq" | "design"
/**
 * The figure dressing for a beat: the bare bin array, or the warehouse real-world
 * skin (Amazon-style chaotic storage: numbered bins, stowed packages, an index).
 * Purely presentational; the bin math is identical for both.
 */
export type HashSkin = "abstract" | "warehouse"

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
  /** The figure dressing: bare bins, or the warehouse (chaotic-storage) skin. */
  skin: HashSkin
  /** The make-a-hash spec (sandbox pool / design-challenge target), or null. */
  design: DesignSpec | null
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
  designCorrect: number // 0..1 (the make-a-hash design challenge)
  lookupCorrect: number // 0..3
  attempts: number
  question: HashQuestion | null
  /** Bucket id a key was dropped on (drag beats): transient, not persisted. */
  placement: string | null
  /** MCQ option id or tapped bucket id (tap beats). */
  selected: string | null
  /** The learner's chosen combine rule on the design beat (working state, not persisted). */
  designRule: CombineRule | null
  /** The learner's chosen bucket count on the design beat (working state, not persisted). */
  designBuckets: number | null
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

/* --------------------- hash-builder model (rule is a choice) --------------------- */

/**
 * The three combine rules a learner can pick in the make-a-hash arc. `sum` adds
 * every letter value (the rule taught all lesson, it uses ALL of the key); `first`
 * uses only the first letter's value; `length` uses only the key's length. The
 * point of offering all three: a good hash uses the whole key so distinct keys
 * land in distinct bins, while `first` / `length` throw away information and pile
 * keys together. Pure and deterministic.
 */
export type CombineRule = "sum" | "first" | "length"

/** The label shown on a rule chip (house copy, no jargon). */
export const RULE_LABEL: Record<CombineRule, string> = {
  sum: "Sum the letters",
  first: "First letter only",
  length: "Length only",
}

/** The raw value a combine rule produces for a key (before the `mod`). */
export function combineValue(rule: CombineRule, key: string): number {
  if (rule === "sum") return keySum(key)
  if (rule === "length") return key.length
  return key.length > 0 ? letterValue(key[0]) : 0
}

/** The bucket a key lands in under a chosen rule + bucket count. */
export function bucketForRule(
  rule: CombineRule,
  key: string,
  bucketCount: number,
): number {
  const b = Math.max(1, bucketCount)
  return ((combineValue(rule, key) % b) + b) % b
}

/**
 * Distribute a key set into buckets under a chosen rule + bucket count, in input
 * order (a colliding key appends to the tail, exactly like `chainAfter`). A pure
 * function of (rule, bucketCount, keys): the live distribution the sandbox shows
 * and the design challenge grades on.
 */
export function distribute(
  rule: CombineRule,
  bucketCount: number,
  keys: string[],
): Record<number, string[]> {
  const table: Record<number, string[]> = {}
  for (const key of keys) {
    const b = bucketForRule(rule, key, bucketCount)
    table[b] = chainAfter(table[b] ?? [], key)
  }
  return table
}

/**
 * How many keys collide in a distribution: every key that shares a bucket with an
 * earlier one (so a perfectly spread set scores 0). Equivalent to
 * `totalKeys - occupiedBuckets`. Pure.
 */
export function collisionCount(table: Record<number, string[]>): number {
  let total = 0
  let occupied = 0
  for (const chain of Object.values(table)) {
    if (chain.length === 0) continue
    total += chain.length
    occupied += 1
  }
  return total - occupied
}

/** Does this rule + bucket count spread every key into its own bucket (no collisions)? */
export function designSpreads(
  rule: CombineRule,
  bucketCount: number,
  keys: string[],
): boolean {
  return collisionCount(distribute(rule, bucketCount, keys)) === 0
}

/** The design spec a sandbox / design beat carries (the keys + the controls). */
export interface DesignSpec {
  /** The keys in play: the sandbox pool, or the design challenge's target set. */
  keys: string[]
  /** The combine rules the learner can choose between. */
  ruleOptions: CombineRule[]
  /** The bucket counts the learner can choose between. */
  bucketOptions: number[]
  /** The starting (seeded) rule the beat opens on. */
  defaultRule: CombineRule
  /** The starting (seeded) bucket count the beat opens on. */
  defaultBuckets: number
}

/* ----------------------- placement frames (fly-to-bucket) ----------------------- */

/**
 * One frame of the signature "hash fly-to-bucket / chain append" replay. Frame 0
 * is the table before the key lands (the key is in flight to `bucket`); the final
 * frame is the table after it appends to that bucket's chain. A pure VIEW over
 * `bucketOf` + `chainAfter` (it never grades), fed to the shared `FrameSequence`
 * so the placement plays over time and snaps to the final frame under reduced
 * motion.
 */
export interface HashPlacementFrame {
  /** The table as it stands in this frame (the key is appended on the final frame). */
  table: Record<number, string[]>
  /** The key being placed (constant across the frames). */
  key: string
  /** The bucket the key hashes to (constant across the frames). */
  bucket: number
  /** True once the key has landed in its bucket (the final frame). */
  landed: boolean
}

/** Expand a single placement into the [in-flight, landed] frames the replay walks. */
export function placementFrames(
  key: string,
  table: Record<number, string[]>,
  bucketCount: number = BUCKET_COUNT,
): HashPlacementFrame[] {
  const bucket = bucketOf(key, bucketCount)
  const after = { ...table, [bucket]: chainAfter(table[bucket] ?? [], key) }
  return [
    { table, key, bucket, landed: false },
    { table: after, key, bucket, landed: true },
  ]
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
  "hash-build-demo",
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
/** The graded design challenge: pick a combine rule + bucket count that spreads the keys. */
const DESIGN_PARTS: ReadonlySet<HashPart> = new Set(["hash-design"])

export const isIntroPart = (part: HashPart): boolean => INTRO_PARTS.has(part)
export const isDragPart = (part: HashPart): boolean => DRAG_PARTS.has(part)
export const isTapPart = (part: HashPart): boolean => TAP_PARTS.has(part)
export const isMcqPart = (part: HashPart): boolean => MCQ_PARTS.has(part)
/** A design beat: graded on the distribution a chosen rule + bucket count produces. */
export const isDesignPart = (part: HashPart): boolean => DESIGN_PARTS.has(part)

function binOf(part: HashPart): HashBin | null {
  if (part === "hash-cat" || part === "hash-cat-again" || part === "hash-dog") return "hash"
  if (MCQ_PARTS.has(part)) return "collision"
  if (part === "hash-design") return "design"
  if (part === "lookup-found" || part === "lookup-absent" || part === "realworld")
    return "lookup"
  return null
}

/* ------------------------------ curated beat data ------------------------------ */

interface BeatSpec {
  key: string
  table: Record<number, string[]>
}

/**
 * The worked-values fixture: the ground truth the build (and tests) grade on.
 * `hash-cat-again` is the de-cued determinism beat: it asks a FRESH key (`jay`,
 * lands in the empty bin 1) that is NOT in the seeded table, so the bin must be
 * computed from scratch rather than read off an already-placed tile. `cat` stays
 * in bin 4 only as continuity from `hash-cat` (it is never the asked key here).
 */
const BEATS: Partial<Record<HashPart, BeatSpec>> = {
  "hash-cat": { key: "cat", table: {} },
  "hash-cat-again": { key: "jay", table: { 4: ["cat"] } },
  "hash-dog": { key: "dog", table: { 4: ["cat"] } },
  "collide-sun": { key: "sun", table: { 4: ["cat"] } },
  "collide-ant": { key: "ant", table: { 0: ["owl", "fox"] } },
  "collide-pig": { key: "pig", table: { 2: ["bee"] } },
  // Lookup beats are de-cued: several bins are occupied (so the target bin is not
  // "the only non-empty one") and the chain CONTENTS are sealed until commit (so
  // the key cannot be read off at idle). Every decoy key hashes to the bin it sits
  // in, so the table stays a valid hash table.
  "lookup-found": {
    key: "fox",
    table: { 0: ["owl", "fox", "ant"], 1: ["dog"], 2: ["bee"], 4: ["cat"] },
  },
  "lookup-absent": {
    key: "bat",
    table: { 0: ["owl"], 1: ["dog"], 3: ["elk"], 4: ["cat"] },
  },
  "realworld": { key: "ivy", table: { 3: ["sam"] } },
}

/**
 * The free-play hash-builder sandbox pool (beat `hash-build-demo`): familiar keys
 * the learner drops while toggling the rule + bucket count to FEEL how the choice
 * changes the spread (sum scatters them, first/length pile them up). Ungraded.
 */
const SANDBOX_DESIGN: DesignSpec = {
  keys: ["cat", "dog", "owl", "bee", "fox", "pig"],
  ruleOptions: ["sum", "first", "length"],
  bucketOptions: [4, 5, 6, 7],
  defaultRule: "sum",
  defaultBuckets: 5,
}

/**
 * The graded design challenge (beat `hash-design`): spread four length-3 keys with
 * NO collisions. It opens on a deliberately weak choice ("first letter only", 5
 * bins), where `cat` and `cap` pile into the same bin because they share a first
 * letter. Only the `sum` rule (which uses every letter) can separate them, and
 * only at a bucket count that keeps the four sums distinct (5 or 7 of the offered
 * counts). So the learner must switch to a rule that uses the WHOLE key, the
 * concept-9 payoff: a good hash spreads keys. Curated for a deterministic verdict.
 */
const CHALLENGE_DESIGN: DesignSpec = {
  keys: ["cat", "cap", "dog", "fig"],
  ruleOptions: ["sum", "first", "length"],
  bucketOptions: [4, 5, 6, 7],
  defaultRule: "first",
  defaultBuckets: 5,
}

const chainText = (chain: string[]): string => chain.join(" → ")

/* ------------------------------ question makers ------------------------------ */

function makeIntro(kind: "demo" | "teach-hash" | "teach-collision"): HashQuestion {
  const prompt =
    kind === "demo"
      ? "Two ways to find one item among many. Try each and watch the cost."
      : kind === "teach-hash"
        ? "A hash turns a key into its location. Add the letters, then mod the bins."
        : "Two keys, one bin. That's a collision. The bin keeps both, in a little chain."
  return {
    kind,
    bin: null,
    mode: "intro",
    prompt,
    key: kind === "teach-hash" ? "cat" : null,
    bucketCount: BUCKET_COUNT,
    sum: kind === "teach-hash" ? keySum("cat") : 0,
    bucket: kind === "teach-hash" ? bucketOf("cat") : -1,
    table: kind === "teach-collision" ? { 4: ["cat", "sun"] } : {},
    options: [],
    answer: "",
    present: false,
    skin: "abstract",
    design: null,
    cost: null,
    scanCost: null,
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

/**
 * The free-play hash-builder sandbox (beat `hash-build-demo`, ungraded): the
 * question just carries the sandbox `design` spec (pool + rule/bucket options +
 * defaults); the UI owns the live drop + distribution. Concept-9 setup.
 */
function makeBuildDemo(): HashQuestion {
  return {
    kind: "hash-build-demo",
    bin: null,
    mode: "intro",
    prompt: "Your hash, your rules. Pick how to combine a key and how many bins, then drop keys in.",
    key: null,
    bucketCount: SANDBOX_DESIGN.defaultBuckets,
    sum: 0,
    bucket: -1,
    table: {},
    options: [],
    answer: "",
    present: false,
    skin: "abstract",
    design: SANDBOX_DESIGN,
    cost: null,
    scanCost: null,
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

/**
 * The graded design challenge (beat `hash-design`, the design bin): the question
 * carries the target `design` spec; the learner's chosen rule + bucket count live
 * in `state.designRule` / `state.designBuckets`, and `check` grades on whether that
 * choice spreads every key (zero collisions). `answer` records the seeded-default
 * verdict for reference; the live verdict is computed from the learner's choice.
 */
function makeDesign(): HashQuestion {
  const spec = CHALLENGE_DESIGN
  return {
    kind: "hash-design",
    bin: "design",
    mode: "design",
    prompt: "Design a hash that gives each key its own bin. Pick a rule and a bucket count with no collisions.",
    key: null,
    bucketCount: spec.defaultBuckets,
    sum: 0,
    bucket: -1,
    table: distribute(spec.defaultRule, spec.defaultBuckets, spec.keys),
    options: [],
    answer: "",
    present: false,
    skin: "abstract",
    design: spec,
    cost: null,
    scanCost: null,
    hint: "Adjust the rule and the bin count until no keys collide, then check.",
    nudge: "First letter only ignores the rest of the key, so cat and cap pile up. Use a rule that reads the whole key.",
    correct: "No collisions. Every key has its own bin.",
    why: "Summing the letters uses the whole key, so cat (24) and cap (20) split apart; with enough bins the four sums land in four different bins. A rule that throws away letters (first-letter, length) keeps colliding.",
  }
}

/** Hash-bin locate: run the index, then stow/locate the item in its bin. */
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
      ? `${key} is a brand-new key. Run the rule. Which bin does it land in?`
      : drag
        ? `Scan ${key}, then stow it in its bin.`
        : `Scan ${key}. Which bin?`,
    key,
    bucketCount: BUCKET_COUNT,
    sum: keySum(key),
    bucket,
    table,
    options: [],
    answer: bucketTargetId(bucket),
    present: false,
    skin: "abstract",
    design: null,
    cost: null,
    scanCost: null,
    hint: "",
    nudge: `Add the letter values, then take the remainder when you divide by ${BUCKET_COUNT}.`,
    correct: again
      ? `${keySum(key)} mod ${BUCKET_COUNT} = ${bucket}. Same key, same bin. ${key} always lands in bin ${bucket}.`
      : `${keySum(key)} mod ${BUCKET_COUNT} = ${bucket}, ${key} lives in bin ${bucket}.`,
    why: again
      ? `A hash is deterministic. ${key}'s letters always sum to ${keySum(key)}, and ${keySum(key)} mod ${BUCKET_COUNT} is always ${bucket}. Run it once or a hundred times, ${key} lands in bin ${bucket}, which is why a lookup can jump straight there.`
      : `${[...key].map((c) => letterValue(c)).join(" + ")} = ${keySum(key)}; ${keySum(key)} mod ${BUCKET_COUNT} = ${bucket}.`,
  }
}

/** Collision predict-next-state: where does the new code go in an occupied bin? */
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
    { id: "reject", label: `${chainText(chain)} (the new item is dropped)` },
    { id: "probe", label: `${key} jumps to the next empty bin` },
  ]
  const sh = shuffle(options, seed)

  return {
    question: {
      kind: part,
      bin: "collision",
      mode: "mcq",
      prompt: `${key} hashes to bin ${bucket}, where ${chainText(chain)} already sits. What's in bin ${bucket} now?`,
      key,
      bucketCount: BUCKET_COUNT,
      sum: keySum(key),
      bucket,
      table,
      options: sh.result,
      answer: "append",
      present: false,
      skin: "abstract",
      design: null,
      cost: null,
      scanCost: null,
      hint: "",
      nudge: "The old item stays. The new one links onto the end of the chain.",
      correct: `Right, ${key} chains onto the end after ${chainText(chain)}.`,
      why: `A collision doesn't replace or reject. The bin holds a mini linked list, so ${key} is appended after ${chainText(chain)}. (Jumping to another bin is a different scheme we're not using.)`,
    },
    next: sh.next,
  }
}

/** Lookup locate + cost: jump to the bin; found or absent, both in one jump. */
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
      ? `Where is ${key} stored? Tap its bin.`
      : `Is ${key} here? Tap the bin it would be in.`,
    key,
    bucketCount: BUCKET_COUNT,
    sum: keySum(key),
    bucket,
    table,
    options: [],
    answer: bucketTargetId(bucket),
    present: isPresent,
    skin: "abstract",
    design: null,
    cost: { word: "free", count: 1, unit: "jump to the bin" },
    scanCost: {
      word: "scales",
      count: scanLen,
      unit: scanLen === 1 ? "item scanned" : "items scanned",
    },
    hint: `Hash ${key} to choose its bin. The bins stay sealed until you commit.`,
    nudge: `Run the rule on ${key}; the remainder is the only bin to open.`,
    correct: isPresent
      ? `Found ${key} in bin ${bucket}. One jump, no scan.`
      : `${key} is not in bin ${bucket}. Absence is also one jump.`,
    why: isPresent
      ? `Hashing ${key} jumps straight to bin ${bucket}, past every other bin; you scan only its short chain, never all ${scanLen} stored items. That is the free lookup.`
      : `Hashing ${key} jumps straight to bin ${bucket}; ${key} is not in that chain, so it is absent. Absence is also one jump, not a scan of all ${scanLen} items.`,
  }
}

/** Real-world skin (warehouse): stow a package in the bin its code hashes to. */
function makeRealworld(): HashQuestion {
  const { key, table } = BEATS["realworld"]!
  const bucket = bucketOf(key)
  return {
    kind: "realworld",
    bin: "lookup",
    mode: "drag",
    prompt: `Stow ${key}'s package in its bin.`,
    key,
    bucketCount: BUCKET_COUNT,
    sum: keySum(key),
    bucket,
    table,
    options: [],
    answer: bucketTargetId(bucket),
    present: false,
    skin: "warehouse",
    design: null,
    cost: { word: "free", count: 1, unit: "jump to the bin" },
    scanCost: null,
    hint: "",
    nudge: `Run the rule on ${key}; the remainder is the bin number.`,
    correct: `${keySum(key)} mod ${BUCKET_COUNT} = ${bucket}. ${key}'s package goes in bin ${bucket}, pulled in one jump.`,
    why: `Chaotic storage hashes the code to a bin, so stowing a package and finding it are both one jump, never a walk down every aisle.`,
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
  if (part === "hash-build-demo") return { question: makeBuildDemo(), next: seed }
  if (part === "hash-design") return { question: makeDesign(), next: seed }
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
  // The design beat opens on its seeded (weak) choice; every other beat clears it.
  const designRule = question.design ? question.design.defaultRule : null
  const designBuckets = question.design ? question.design.defaultBuckets : null
  return {
    ...state,
    partIndex: index,
    ...FRESH,
    question,
    designRule,
    designBuckets,
    rngState: next,
  }
}

export function createHashTables(seed: number = Date.now()): HashTablesState {
  const init: HashTablesState = {
    seed,
    rngState: seed,
    partIndex: 0,
    hashCorrect: 0,
    collisionCorrect: 0,
    designCorrect: 0,
    lookupCorrect: 0,
    attempts: 0,
    question: null,
    placement: null,
    selected: null,
    designRule: null,
    designBuckets: null,
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
  if (bin === "design") return state.designCorrect
  return state.lookupCorrect
}

/** Reps required to clear a bin: design takes one; hash / collision / lookup take three. */
const binTarget = (bin: HashBin): number => (bin === "design" ? DESIGN_QUOTA : BIN_QUOTA)

/** Per-bin "n of total" header for a graded beat (e.g. Insert 1/3, Design 0/1). */
export function partQuotaHash(
  state: HashTablesState,
): { done: number; total: number } | null {
  const bin = binOf(currentPartHash(state))
  if (!bin) return null
  return { done: binProgress(state, bin), total: binTarget(bin) }
}

/** Every bucket is a legal (keyboard-reachable, highlightable) drop target. */
export function legalBuckets(state: HashTablesState): Set<string> {
  const q = state.question
  const count = q?.bucketCount ?? BUCKET_COUNT
  return new Set(Array.from({ length: count }, (_, i) => bucketTargetId(i)))
}

/** Can the learner press Check? Drag needs a drop; tap/mcq need a pick; design needs a choice. */
export function canCheckHash(state: HashTablesState): boolean {
  const part = currentPartHash(state)
  if (isDragPart(part)) return state.placement != null
  if (isTapPart(part) || isMcqPart(part)) return state.selected != null
  if (isDesignPart(part)) return state.designRule != null && state.designBuckets != null
  return false
}

/** Resolve the current design choice into its live distribution (or null off a design beat). */
export function designDistribution(
  state: HashTablesState,
): Record<number, string[]> | null {
  const q = state.question
  if (!q?.design || state.designRule == null || state.designBuckets == null) return null
  return distribute(state.designRule, state.designBuckets, q.design.keys)
}

/** The hard mastery gate: clear all four bins (Hash 3 + Collision 3 + Design 1 + Lookup 3 = 10). */
export function isCompleteHash(state: HashTablesState): boolean {
  return (
    state.hashCorrect >= BIN_QUOTA &&
    state.collisionCorrect >= BIN_QUOTA &&
    state.designCorrect >= DESIGN_QUOTA &&
    state.lookupCorrect >= BIN_QUOTA
  )
}

export function hasProgressHash(state: HashTablesState): boolean {
  return (
    state.partIndex > 0 ||
    state.hashCorrect > 0 ||
    state.collisionCorrect > 0 ||
    state.designCorrect > 0 ||
    state.lookupCorrect > 0
  )
}

/* --------------------------------- reducer --------------------------------- */

function bumpBin(state: HashTablesState, bin: HashBin): void {
  if (bin === "hash") state.hashCorrect = Math.min(BIN_QUOTA, state.hashCorrect + 1)
  else if (bin === "collision")
    state.collisionCorrect = Math.min(BIN_QUOTA, state.collisionCorrect + 1)
  else if (bin === "design")
    state.designCorrect = Math.min(DESIGN_QUOTA, state.designCorrect + 1)
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
      // Design beats carry the two controls through `select`: a "rule:<id>" picks
      // the combine rule, a "buckets:<n>" picks the bucket count. Either resets the
      // verdict to idle so the learner can re-check the new choice.
      if (isDesignPart(part)) {
        if (action.letter.startsWith("rule:")) {
          return { ...state, designRule: action.letter.slice(5) as CombineRule, feedback: "idle" }
        }
        if (action.letter.startsWith("buckets:")) {
          const n = Number(action.letter.slice(8))
          if (!Number.isFinite(n)) return state
          return { ...state, designBuckets: n, feedback: "idle" }
        }
        return state
      }
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
      if (isDesignPart(part)) {
        if (state.designRule == null || state.designBuckets == null || !q.design) return state
        correct = designSpreads(state.designRule, state.designBuckets, q.design.keys)
      } else if (isDragPart(part)) {
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
      // A fresh instance: re-shuffle MCQ options; reset the drag/tap pick and the
      // design controls back to the seeded (weak) starting choice.
      const { question, next } = buildQuestion(part, state.rngState)
      const designRule = question.design ? question.design.defaultRule : null
      const designBuckets = question.design ? question.design.defaultBuckets : null
      return { ...state, ...FRESH, question, designRule, designBuckets, rngState: next }
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
      design: s.designCorrect,
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
    designCorrect: clampH(c.design ?? 0, DESIGN_QUOTA),
    lookupCorrect: clampH(c.lookup ?? 0, BIN_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, HASH_PARTS.indexOf(progress.currentPart as HashPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
