import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Linked Lists lesson engine. One idea: a list is held
 * together by **pointers, not position**. Reaching the k-th node is a forced walk
 * from the head (no jump); but splicing a node in is two pointer writes whose
 * ORDER matters: save the rest of the list first (`new.next = prev.next`) THEN
 * repoint (`prev.next = new`). Do it backwards and the tail is orphaned:
 * unreachable from the head, gone for good.
 *
 * Insert/delete are graded by **reachability**, not final adjacency: a write
 * that drops nodes out of the head-reachable set makes them un-grabbable and
 * un-targetable (the figure floats them away), so the unsafe order can't be
 * finished. The playlist synthesis and the doubly splice grade by "perform the
 * scripted writes in order" (a wrong move only nudges, never strands the board),
 * the heaps do-the-sift pattern. Deterministic (seeded): same state, same
 * question/verdict.
 *
 * Twelve beats, nine graded (gate = 9): node-demo, teach, traverse (forced walk),
 * rewire-insert, rewire-delete, predict (animated orphaning), playlist synthesis
 * (insert -> delete -> reorder, one slot), contrast-insert + contrast-reach
 * (two-step pick -> why-MCQ), doubly-demo, doubly-splice (4 ordered writes),
 * doubly-walk (backward walk from the tail).
 */

export const LL_PARTS = [
  "node-demo",
  "teach",
  "traverse",
  "rewire-insert",
  "rewire-delete",
  "predict",
  "playlist",
  "contrast-insert",
  "contrast-reach",
  "doubly-demo",
  "doubly-splice",
  "doubly-walk",
] as const
export type LLPart = (typeof LL_PARTS)[number]
export const LL_TOTAL_PARTS = LL_PARTS.length

const LETTERS = ["A", "B", "C", "D", "E", "F", "G"]
/** The node spliced in by an insert (a fixed label keeps keys stable). */
export const NEW_NODE = "X"
/** The null terminator a tail pointer aims at. */
export const NIL = "∅"

/** A pointer source id for a node's forward (`next`) pointer ("p:A", "p:X"). */
export const pointerId = (node: string) => `p:${node}`
/** The node a `next` pointer source belongs to ("p:A" -> "A"). */
export const sourceNode = (id: string) =>
  id.startsWith("p:") ? id.slice(2) : id.startsWith("next:") || id.startsWith("prev:") ? id.slice(5) : id

/** A doubly node's forward (`next`) and backward (`prev`) pointer source ids. */
export const nextPtr = (node: string) => `next:${node}`
export const prevPtr = (node: string) => `prev:${node}`
/** Which direction a doubly pointer source points ("next:A" -> "next"). */
export const ptrDir = (id: string): "next" | "prev" | "fwd" =>
  id.startsWith("next:") ? "next" : id.startsWith("prev:") ? "prev" : "fwd"

export interface LLOption {
  id: string
  label: string
}

/** One pointer re-aim: a pointer source aimed at a target node id. */
export interface RewirePair {
  from: string // pointer source id ("p:A", "p:X", "next:A", "prev:B")
  to: string // target node id ("A", "X", "∅")
}

/** One labelled write in an ordered script (the doubly splice chips show these). */
export interface DoublyWrite extends RewirePair {
  label: string // e.g. "X.next → B"
}

/** One phase of the playlist synthesis (insert -> delete -> reorder). */
export type PlaylistPhase = "insert" | "delete" | "reorder"
export interface PlaylistStep {
  phase: PlaylistPhase
  prompt: string
  nudge: string
  correct: string
  /** [start, end) indices into the flat write script for this phase. */
  writeStart: number
  writeEnd: number
  /** The loose / new track this phase splices (insert: X; reorder: the moved track). */
  newNode: string | null
  /** The track the loose node is queued after (display + splice anchor). */
  prev: string | null
  /** The track this phase removes (delete) or moves (reorder); null otherwise. */
  cur: string | null
}

export interface LLQuestion {
  kind: LLPart
  prompt: string
  nodes: string[] // the chain, head-first (e.g. [A,B,C,D])
  head: string // nodes[0]
  // traverse / doubly-walk:
  targetIndex: number // hops from the head to the asked node (-1 if n/a)
  backward: boolean // doubly-walk: the forced walk runs from the tail via prev
  options: LLOption[]
  answer: string
  // rewire-insert / rewire-delete:
  newNode: string | null // "X" - starts loose, spliced in
  prev: string | null // the node X is inserted after (or the bypass anchor)
  at: string | null // prev's old next - the node X must end up pointing to
  initialNext: Record<string, string> // the chain's pointer map at the start
  correctNext: Record<string, string> // the unique correct full pointer map
  rewires: RewirePair[] // PINNED correct order (save-first for insert)
  // playlist synthesis (multi-step):
  playlistSteps: PlaylistStep[]
  flatWrites: RewirePair[] // the whole ordered write script across the three phases
  // doubly-splice:
  doublyWrites: DoublyWrite[] // the 4 ordered writes (save-first, both directions)
  // contrast two-step (pick -> why-MCQ):
  pickOptions: LLOption[]
  pickAnswer: string
  whyOptions: LLOption[]
  whyAnswer: string
  // contrast cost reveal (post-commit only, never on the question screen):
  array?: string[]
  arrayCost?: { word: CostWord; count: number; unit: string }
  listCost?: { word: CostWord; count: number; unit: string }
  cost: { word: CostWord; count: number; unit: string }
  hint: string
  nudge: string
  correct: string
  why: string
}

export interface LinkedListsState {
  seed: number
  rngState: number
  partIndex: number
  // the nine graded counters (0 | 1 each)
  traverseCleared: number
  insertCleared: number
  deleteCleared: number
  predictCleared: number
  playlistCleared: number // graded multi-step synthesis (was the plain insert skin)
  contrastInsertCleared: number
  contrastReachCleared: number
  doublySpliceCleared: number // NEW
  doublyWalkCleared: number // NEW
  attempts: number
  question: LLQuestion | null
  workingNext: Record<string, string> // live, learner-mutated pointer map (rewire + synthesis)
  writes: RewirePair[] // ordered log of this attempt's accepted writes (replay + Check-ready)
  selected: string | null // MCQ choice / forced-walk position / contrast pick or why
  // contrast two-step:
  contrastPhase: "pick" | "why"
  pick: string | null // the structure the learner picked (low-stakes)
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

const plural = (n: number) => (n === 1 ? "" : "s")
function ordinal(n: number): string {
  if (n === 1) return "1st"
  if (n === 2) return "2nd"
  if (n === 3) return "3rd"
  return `${n}th`
}

/* --------------------------------- chain helpers --------------------------------- */

/** The original next-pointer map of a chain: each node aims at its successor, the last at ∅. */
function chainNext(nodes: string[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (let i = 0; i < nodes.length; i++) {
    m[pointerId(nodes[i])] = nodes[i + 1] ?? NIL
  }
  return m
}

/**
 * The set of node ids reachable by walking `next` from the head, stopping at ∅,
 * a dangling/undefined aim, or a cycle. This is the whole grading model: a node
 * not in this set has been orphaned (the list lost it).
 */
export function reachableFrom(
  head: string,
  next: Record<string, string>,
  max = 16,
): Set<string> {
  const seen = new Set<string>()
  let cur: string | undefined = head
  while (cur && cur !== NIL && !seen.has(cur) && seen.size < max) {
    seen.add(cur)
    cur = next[pointerId(cur)]
  }
  return seen
}

/** A rewire is correct iff every pointer in the correct map is aimed exactly so. */
function isRewireCorrect(
  working: Record<string, string>,
  correct: Record<string, string>,
): boolean {
  return Object.keys(correct).every((k) => working[k] === correct[k])
}

/* ------------------------------ question makers ------------------------------ */

const EMPTY_Q = {
  targetIndex: -1,
  backward: false,
  options: [] as LLOption[],
  answer: "",
  newNode: null,
  prev: null,
  at: null,
  rewires: [] as RewirePair[],
  correctNext: {} as Record<string, string>,
  playlistSteps: [] as PlaylistStep[],
  flatWrites: [] as RewirePair[],
  doublyWrites: [] as DoublyWrite[],
  pickOptions: [] as LLOption[],
  pickAnswer: "",
  whyOptions: [] as LLOption[],
  whyAnswer: "",
}

/** A small read-only chain for the intro (beat 1) and teach (beat 2) screens. */
function makeIntro(kind: "node-demo" | "teach"): LLQuestion {
  const nodes = LETTERS.slice(0, 4)
  return {
    kind,
    prompt:
      kind === "node-demo"
        ? "Drag a node anywhere - the list doesn't change."
        : "Pointers are the structure - and the head is sacred.",
    nodes,
    head: nodes[0],
    initialNext: chainNext(nodes),
    ...EMPTY_Q,
    cost: { word: "free", count: 0, unit: "" },
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

/**
 * Traverse-to-find (graded), now a **forced walk**: the learner walks from the
 * head one hop at a time (only the next hop is tappable, see `walkFrontierLL`),
 * so the "walk, don't jump" cost is performed, not read off. Answer is the target
 * node; the learner commits with Check once they believe they've arrived (they can
 * overshoot, so the hop count is a real judgment). Two prompt shapes.
 */
function makeWalk(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value // 4..5
  const nodes = LETTERS.slice(0, len)
  const head = nodes[0]
  r = rngInt(a, len - 2)
  a = r.next
  const targetIndex = 2 + r.value // 2..len-1 (always a real walk)
  r = rngInt(a, 2)
  a = r.next
  const askValue = r.value === 0

  const answer = nodes[targetIndex]
  const prompt = askValue
    ? `Walk to the ${ordinal(targetIndex + 1)} node.`
    : `Walk to the node ${targetIndex} hop${plural(targetIndex)} from the head.`
  const correct = askValue
    ? `That's the ${ordinal(targetIndex + 1)} node, ${targetIndex} link${plural(targetIndex)} from the head.`
    : `${answer} sits ${targetIndex} hop${plural(targetIndex)} from the head, one per link.`
  const why = askValue
    ? `From the head you follow each next pointer ${targetIndex} time${plural(targetIndex)} - there's no jump - landing on ${answer}.`
    : `Reaching ${answer} means following ${targetIndex} next pointer${plural(targetIndex)} from the head; a list has no index math.`

  return {
    question: {
      kind: "traverse",
      prompt,
      nodes,
      head,
      initialNext: chainNext(nodes),
      ...EMPTY_Q,
      targetIndex,
      answer,
      cost: { word: "scales", count: targetIndex, unit: targetIndex === 1 ? "hop" : "hops" },
      hint: "",
      nudge: "Walk one hop at a time from the head, then commit when you've arrived.",
      correct,
      why,
    },
    next: a,
  }
}

/**
 * Insert X after an interior node. Seeded chain (len 4-5), insert index
 * i in 1..len-1, so X always splices between two real nodes. The pinned correct
 * order is SAVE-FIRST: `X -> node[i]` (save the tail) THEN `node[i-1] -> X`.
 */
function makeInsert(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value // 4..5
  const nodes = LETTERS.slice(0, len)
  r = rngInt(a, len - 1)
  a = r.next
  const index = 1 + r.value // 1..len-1

  const head = nodes[0]
  const prev = nodes[index - 1]
  const at = nodes[index]
  const initialNext = chainNext(nodes)
  const correctNext: Record<string, string> = {
    ...initialNext,
    [pointerId(NEW_NODE)]: at,
    [pointerId(prev)]: NEW_NODE,
  }
  const rewires: RewirePair[] = [
    { from: pointerId(NEW_NODE), to: at },
    { from: pointerId(prev), to: NEW_NODE },
  ]

  return {
    question: {
      kind: "rewire-insert",
      prompt: `Insert ${NEW_NODE} after ${prev}.`,
      nodes,
      head,
      ...EMPTY_Q,
      newNode: NEW_NODE,
      prev,
      at,
      initialNext,
      correctNext,
      rewires,
      cost: { word: "free", count: 2, unit: "pointers rewired" },
      hint: "",
      nudge: "Re-aim a pointer - don't slide nodes. Two writes splice X in.",
      correct: "Two writes splice X in - nothing else moved.",
      why: `Aim ${NEW_NODE} -> ${at} first so the tail is saved, then ${prev} -> ${NEW_NODE}. Repoint ${prev} first and ${at}'s run of the list is orphaned - unreachable from the head.`,
    },
    next: a,
  }
}

/**
 * Delete an interior node by bypassing it: one repoint, `prev.next = after`. The
 * removed node simply falls out of the head-reachable set. Seeded chain (len 4-5),
 * cur in 1..len-2 so it has both a prev and a successor.
 */
function makeDelete(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value // 4..5
  const nodes = LETTERS.slice(0, len)
  r = rngInt(a, len - 2)
  a = r.next
  const index = 1 + r.value // 1..len-2 (an interior node with a successor)

  const head = nodes[0]
  const prev = nodes[index - 1]
  const cur = nodes[index]
  const after = nodes[index + 1]
  const initialNext = chainNext(nodes)
  const correctNext: Record<string, string> = { ...initialNext, [pointerId(prev)]: after }
  const rewires: RewirePair[] = [{ from: pointerId(prev), to: after }]

  return {
    question: {
      kind: "rewire-delete",
      prompt: `Remove ${cur}.`,
      nodes,
      head,
      ...EMPTY_Q,
      prev,
      at: after,
      initialNext,
      correctNext,
      rewires,
      cost: { word: "free", count: 1, unit: "pointer rewired" },
      hint: "",
      nudge: "Re-aim one pointer to bypass the node - don't slide anything.",
      correct: `One write and ${cur} is bypassed - it's gone.`,
      why: `Re-aim ${prev} -> ${after}. ${cur} is no longer reachable from the head, so it's removed - a single pointer write.`,
    },
    next: a,
  }
}

/**
 * Predict-the-break (graded): a pure MCQ on the consequence of the UNSAFE insert
 * order. The reveal animates the orphaning (see `predictBreakFrames`): repoint
 * `prev -> X` before saving `X -> cur` and the tail detaches.
 */
function makePredict(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value // 4..5
  const nodes = LETTERS.slice(0, len)
  r = rngInt(a, len - 1)
  a = r.next
  const index = 1 + r.value // 1..len-1
  const prev = nodes[index - 1]
  const cur = nodes[index]

  const sh = shuffle(
    [
      { id: "fine", label: "It works - the order doesn't matter" },
      { id: "lost", label: `Everything after ${prev} is lost` },
      { id: "loop", label: "The list loops back on itself forever" },
    ],
    a,
  )
  a = sh.next

  return {
    question: {
      kind: "predict",
      prompt: `You point ${prev} -> ${NEW_NODE} before saving ${NEW_NODE} -> ${cur}. What happens?`,
      nodes,
      head: nodes[0],
      initialNext: chainNext(nodes),
      ...EMPTY_Q,
      newNode: NEW_NODE,
      prev,
      at: cur,
      options: sh.result,
      answer: "lost",
      cost: { word: "scales", count: 0, unit: "" },
      hint: "",
      nudge: `After you repoint ${prev}, what still points at ${cur}?`,
      correct: `Right - nothing points at ${cur} anymore, so the tail is orphaned.`,
      why: `Repointing ${prev} first overwrites the only link to ${cur}'s run before ${NEW_NODE} saved it - the rest of the list is unreachable from the head. Save first, then repoint.`,
    },
    next: a,
  }
}

/**
 * The playlist synthesis (graded, one slot): a multi-step task on the Spotify
 * skin that ties both pointer skills together. Three phases over one evolving
 * queue: insert a track (save-first, 2 writes) -> delete a track (bypass, 1 write)
 * -> reorder a track (unlink + relink save-first, 3 writes). Performed write by
 * write in order; a wrong move only nudges (the script never strands the queue),
 * so it is NOT a duplicate of the rewire-insert / rewire-delete instances.
 */
function makePlaylistSynthesis(): LLQuestion {
  // Stable display universe; X is the new track, queued after A.
  const nodes = LETTERS.slice(0, 5) // A,B,C,D,E
  const [A, B, , D, E] = nodes
  const C = nodes[2]
  const head = A
  const X = NEW_NODE

  // Phase 1 - insert X after A (A's old next is B): save X -> B, then A -> X.
  // Phase 2 - delete C (now B -> C): bypass B -> D.
  // Phase 3 - reorder D to after X: unlink B -> E, then save D -> B, then X -> D.
  const flatWrites: RewirePair[] = [
    { from: pointerId(X), to: B }, // 0 insert save
    { from: pointerId(A), to: X }, // 1 insert splice
    { from: pointerId(B), to: D }, // 2 delete bypass
    { from: pointerId(B), to: E }, // 3 reorder unlink
    { from: pointerId(D), to: B }, // 4 reorder save
    { from: pointerId(X), to: D }, // 5 reorder splice
  ]
  const playlistSteps: PlaylistStep[] = [
    {
      phase: "insert",
      prompt: `Queue the new track after ${A}.`,
      nudge: `Save the rest onto the new track first (${X} -> ${B}), then point ${A} at ${X}.`,
      correct: "Queued. Two writes, and the rest of the playlist plays on.",
      writeStart: 0,
      writeEnd: 2,
      newNode: X,
      prev: A,
      cur: null,
    },
    {
      phase: "delete",
      prompt: `Now drop ${C} from the queue.`,
      nudge: `Re-aim ${B} past ${C} to the next track. One write removes it.`,
      correct: `${C} bypassed - one write and it's out of the queue.`,
      writeStart: 2,
      writeEnd: 3,
      newNode: null,
      prev: B,
      cur: C,
    },
    {
      phase: "reorder",
      prompt: `Move ${D} up to play right after ${X}.`,
      nudge: `Unlink ${D} first (${B} -> ${E}), then splice it back in save-first: ${D} -> ${B}, then ${X} -> ${D}.`,
      correct: `${D} re-queued - unlink, then relink in the safe order.`,
      writeStart: 3,
      writeEnd: 6,
      newNode: D,
      prev: X,
      cur: D,
    },
  ]

  return {
    kind: "playlist",
    prompt: "Run the playlist: queue a track, drop one, then reorder one.",
    nodes,
    head,
    initialNext: chainNext(nodes),
    ...EMPTY_Q,
    newNode: X,
    prev: A,
    at: B,
    playlistSteps,
    flatWrites,
    cost: { word: "free", count: flatWrites.length, unit: "pointer writes" },
    hint: "",
    nudge: "One operation at a time - the queue tells you which.",
    correct: "Insert, delete, reorder: every edit is a handful of pointer writes.",
    why: "A playlist is a linked list. Queuing saves-then-splices, dropping bypasses, and reordering is unlink + relink. None of it shifts the whole list - it just re-aims pointers.",
  }
}

/* ------------------------------ contrast two-step ------------------------------ */

/**
 * The why-MCQ framing pools (author 2-3 each, picked by seed). The PICK step is
 * de-cued (neutral structure labels, no cost), so the real graded check is this
 * reason MCQ; the cost numbers only surface in the post-commit feedback.
 */
const INSERT_WHY_FRAMINGS: { whyOptions: LLOption[]; whyAnswer: string }[] = [
  {
    whyAnswer: "splice",
    whyOptions: [
      { id: "splice", label: "It can splice in place by re-aiming a couple of pointers." },
      { id: "order", label: "It keeps everything sorted, so inserting is automatic." },
      { id: "memory", label: "It stores its items packed tightly together." },
    ],
  },
  {
    whyAnswer: "ripple",
    whyOptions: [
      { id: "ripple", label: "An array has to shove every later item over to open a gap." },
      { id: "search", label: "An array has to search from the start to find the spot." },
      { id: "copy", label: "An array has to copy itself into a bigger block first." },
    ],
  },
  {
    whyAnswer: "both",
    whyOptions: [
      { id: "both", label: "The list re-aims a pointer or two; the array slides the rest of the row." },
      { id: "tie", label: "Both walk to the middle first, so they tie." },
      { id: "near", label: "The array wins because its cells sit side by side." },
    ],
  },
]

const REACH_WHY_FRAMINGS: { whyOptions: LLOption[]; whyAnswer: string }[] = [
  {
    whyAnswer: "jump",
    whyOptions: [
      { id: "jump", label: "An array can land on any index directly, no walking." },
      { id: "shortcut", label: "An array keeps a shortcut pointer to its last item." },
      { id: "sorted", label: "An array is sorted, so the end is easy to find." },
    ],
  },
  {
    whyAnswer: "nomath",
    whyOptions: [
      { id: "nomath", label: "A list has no index math, so it walks link by link from the head." },
      { id: "shift", label: "A list has to shift its cells to reach the end." },
      { id: "copy", label: "A list has to copy the chain before it can read it." },
    ],
  },
  {
    whyAnswer: "contrast",
    whyOptions: [
      { id: "contrast", label: "The array reads any index at once; the list follows every link to get there." },
      { id: "tie", label: "Both land on the item directly, so they tie." },
      { id: "tail", label: "The list wins because it always knows where its tail is." },
    ],
  },
]

/** A two-step contrast: a de-cued pick (List / Array / Same), then a graded why-MCQ. */
function makeContrast(
  kind: "contrast-insert" | "contrast-reach",
  seed: number,
): { question: LLQuestion; next: number } {
  const isInsert = kind === "contrast-insert"
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 5 + r.value // 5..6
  const items = LETTERS.slice(0, len)
  const k = isInsert ? Math.floor(len / 2) : len - 1
  const arrayShift = len - k

  // De-cued pick: structure names only, never the cost or the strategy.
  const pickSh = shuffle(
    [
      { id: "list", label: "List" },
      { id: "array", label: "Array" },
      { id: "same", label: "Same" },
    ],
    a,
  )
  a = pickSh.next
  const pickAnswer = isInsert ? "list" : "array"

  // The graded why-MCQ: pick a framing by seed, shuffle its options.
  const pool = isInsert ? INSERT_WHY_FRAMINGS : REACH_WHY_FRAMINGS
  r = rngInt(a, pool.length)
  a = r.next
  const framing = pool[r.value]
  const whySh = shuffle(framing.whyOptions, a)
  a = whySh.next

  const arrayCost = isInsert
    ? { word: "scales" as CostWord, count: arrayShift, unit: "cells shifted" }
    : { word: "free" as CostWord, count: 1, unit: "jump" }
  const listCost = isInsert
    ? { word: "free" as CostWord, count: 2, unit: "pointers rewired" }
    : { word: "scales" as CostWord, count: k, unit: "hops" }

  return {
    question: {
      kind,
      prompt: isInsert
        ? "Insert a value in the middle. Which does less work?"
        : "Reach the last item. Which does less work?",
      nodes: items,
      head: items[0],
      initialNext: chainNext(items),
      ...EMPTY_Q,
      targetIndex: isInsert ? Math.floor(items.length / 2) : k,
      options: whySh.result, // the graded options live in `options` too for the shared MCQ path
      answer: framing.whyAnswer,
      pickOptions: pickSh.result,
      pickAnswer,
      whyOptions: whySh.result,
      whyAnswer: framing.whyAnswer,
      array: items,
      arrayCost,
      listCost,
      cost: isInsert ? listCost : arrayCost,
      hint: "",
      nudge: isInsert
        ? "Think about what each structure must touch to open a gap in the middle."
        : "Think about whether a list can land on an index without walking.",
      correct: isInsert
        ? `The list rewires 2 pointers; the array shifts ${arrayShift} cells.`
        : `The array jumps to the index; the list walks ${k} hops.`,
      why: isInsert
        ? `A list splices anywhere with 2 writes. An array slides ${arrayShift} cells to open a gap.`
        : `An array reads any index in one jump. A list walks ${k} hops from the head - no index math.`,
    },
    next: a,
  }
}

/* --------------------------------- doubly --------------------------------- */

/**
 * Doubly-demo (free play, ungraded): a both-ways sandbox. Every node now carries
 * a back-pointer too, so you can walk either direction. Ungraded; it leads into
 * the two graded doubly problems.
 */
function makeDoublyDemo(): LLQuestion {
  const nodes = LETTERS.slice(0, 4)
  return {
    kind: "doubly-demo",
    prompt: "Now every node points both ways.",
    nodes,
    head: nodes[0],
    initialNext: chainNext(nodes),
    ...EMPTY_Q,
    cost: { word: "free", count: 0, unit: "" },
    hint: "",
    nudge: "",
    correct: "",
    why: "",
  }
}

/**
 * Doubly-splice (graded): insert X between A and B with FOUR ordered writes. The
 * save-first order sets the newcomer's two pointers first, then redirects the
 * neighbours: X.next, X.prev, A.next, B.prev. Performed by tapping the writes in
 * order (engine-validated); a wrong order only nudges.
 */
function makeDoublySplice(): LLQuestion {
  const nodes = LETTERS.slice(0, 4) // A,B,C,D
  const [A, B] = nodes
  const X = NEW_NODE
  const doublyWrites: DoublyWrite[] = [
    { from: nextPtr(X), to: B, label: `${X}.next → ${B}` },
    { from: prevPtr(X), to: A, label: `${X}.prev → ${A}` },
    { from: nextPtr(A), to: X, label: `${A}.next → ${X}` },
    { from: prevPtr(B), to: X, label: `${B}.prev → ${X}` },
  ]
  return {
    kind: "doubly-splice",
    prompt: `Splice ${X} between ${A} and ${B} - both ways.`,
    nodes,
    head: A,
    initialNext: chainNext(nodes),
    ...EMPTY_Q,
    newNode: X,
    prev: A,
    at: B,
    doublyWrites,
    cost: { word: "free", count: 4, unit: "pointer writes" },
    hint: "",
    nudge: "Set the newcomer's own two pointers first, then redirect each neighbour.",
    correct: "Four writes, and the list stays linked both directions.",
    why: `Save-first still rules: aim ${X}'s own next and prev first (${X}.next -> ${B}, ${X}.prev -> ${A}), then redirect the neighbours (${A}.next -> ${X}, ${B}.prev -> ${X}). Redirect a neighbour too early and you lose the node you still need.`,
  }
}

/**
 * Doubly-walk (graded): a backward forced walk from the tail. With a back-pointer
 * you can start at the end and walk toward the head; only the previous node is
 * tappable (see `walkFrontierLL`), so the walk is performed, not jumped.
 */
function makeDoublyWalk(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  const len = 5
  const nodes = LETTERS.slice(0, len) // A..E
  const tailIndex = len - 1
  const r = rngInt(a, len - 3)
  a = r.next
  const targetIndex = 1 + r.value // 1..len-3 -> a 2..3 hop backward walk
  const answer = nodes[targetIndex]
  const backHops = tailIndex - targetIndex

  return {
    question: {
      kind: "doubly-walk",
      prompt: `Start at the tail. Walk back to ${answer}.`,
      nodes,
      head: nodes[0],
      initialNext: chainNext(nodes),
      ...EMPTY_Q,
      targetIndex,
      backward: true,
      answer,
      cost: { word: "scales", count: backHops, unit: backHops === 1 ? "hop" : "hops" },
      hint: "",
      nudge: "Follow the back-pointer one hop at a time from the tail, then commit.",
      correct: `${answer} is ${backHops} hop${plural(backHops)} back from the tail - the prev pointer walks it.`,
      why: `A back-pointer lets you start at the tail and follow prev toward the head. ${answer} sits ${backHops} hop${plural(backHops)} from the tail - still a walk, just the other way.`,
    },
    next: a,
  }
}

/* -------------------------- pure replay frame selectors -------------------------- */

/** One precomputed frame of a rewire replay (drives a read-only NodeGraph). */
export interface RewireFrame {
  workingNext: Record<string, string>
  orphaned: string[]
  caption: string
}

function orphanedFor(nodes: string[], head: string, next: Record<string, string>): string[] {
  const reach = reachableFrom(head, next)
  return nodes.filter((n) => !reach.has(n))
}

/** The save-first insert, frame by frame: intact -> save X -> splice prev. */
export function insertWriteFrames(q: LLQuestion): RewireFrame[] {
  const prev = q.prev as string
  const at = q.at as string
  const base = chainNext(q.nodes)
  const saved = { ...base, [pointerId(NEW_NODE)]: at }
  const spliced = { ...saved, [pointerId(prev)]: NEW_NODE }
  return [
    { workingNext: base, orphaned: [], caption: `${prev} still points at ${at}; ${NEW_NODE} is loose.` },
    { workingNext: saved, orphaned: [], caption: `Save the rest first: ${NEW_NODE} -> ${at}.` },
    { workingNext: spliced, orphaned: [], caption: `Then splice: ${prev} -> ${NEW_NODE}. Two writes.` },
  ]
}

/** The bypass delete, frame by frame: intact -> bypass (the node falls out). */
export function deleteWriteFrames(q: LLQuestion): RewireFrame[] {
  const prev = q.prev as string
  const after = q.at as string
  const base = chainNext(q.nodes)
  const bypassed = { ...base, [pointerId(prev)]: after }
  return [
    { workingNext: base, orphaned: [], caption: "The chain, intact." },
    {
      workingNext: bypassed,
      orphaned: orphanedFor(q.nodes, q.head, bypassed),
      caption: `Bypass it: ${prev} -> ${after}. It falls out of the list.`,
    },
  ]
}

/** The unsafe order, frame by frame: intact -> repoint prev first (the tail detaches). */
export function predictBreakFrames(q: LLQuestion): RewireFrame[] {
  const prev = q.prev as string
  const cur = q.at as string
  const base = chainNext(q.nodes)
  const broken = { ...base, [pointerId(prev)]: NEW_NODE, [pointerId(NEW_NODE)]: NIL }
  return [
    { workingNext: base, orphaned: [], caption: "The chain, intact." },
    {
      workingNext: broken,
      orphaned: orphanedFor(q.nodes, q.head, broken),
      caption: `${prev} -> ${NEW_NODE} first. Nothing points at ${cur} anymore - the tail is lost.`,
    },
  ]
}

/* ------------------------------- construction ------------------------------- */

const FRESH = {
  selected: null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
  contrastPhase: "pick" as const,
  pick: null,
}

function enterPart(state: LinkedListsState, index: number): LinkedListsState {
  const part = LL_PARTS[index]
  const base = {
    ...state,
    partIndex: index,
    ...FRESH,
    writes: [] as RewirePair[],
    workingNext: {} as Record<string, string>,
  }
  if (part === "node-demo") return { ...base, question: makeIntro("node-demo") }
  if (part === "teach") return { ...base, question: makeIntro("teach") }
  if (part === "traverse") {
    const { question, next } = makeWalk(state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "rewire-insert") {
    const { question, next } = makeInsert(state.rngState)
    return { ...base, question, workingNext: { ...question.initialNext }, rngState: next }
  }
  if (part === "rewire-delete") {
    const { question, next } = makeDelete(state.rngState)
    return { ...base, question, workingNext: { ...question.initialNext }, rngState: next }
  }
  if (part === "predict") {
    const { question, next } = makePredict(state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "playlist") {
    const question = makePlaylistSynthesis()
    return { ...base, question, workingNext: { ...question.initialNext } }
  }
  if (part === "contrast-insert") {
    const { question, next } = makeContrast("contrast-insert", state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "contrast-reach") {
    const { question, next } = makeContrast("contrast-reach", state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "doubly-demo") return { ...base, question: makeDoublyDemo() }
  if (part === "doubly-splice") return { ...base, question: makeDoublySplice() }
  // doubly-walk
  const { question, next } = makeDoublyWalk(state.rngState)
  return { ...base, question, rngState: next }
}

export function createLinkedLists(seed: number = Date.now()): LinkedListsState {
  const init: LinkedListsState = {
    seed,
    rngState: seed,
    partIndex: 0,
    traverseCleared: 0,
    insertCleared: 0,
    deleteCleared: 0,
    predictCleared: 0,
    playlistCleared: 0,
    contrastInsertCleared: 0,
    contrastReachCleared: 0,
    doublySpliceCleared: 0,
    doublyWalkCleared: 0,
    attempts: 0,
    question: null,
    workingNext: {},
    writes: [],
    selected: null,
    contrastPhase: "pick",
    pick: null,
    wrongCount: 0,
    feedback: "idle",
    revealed: false,
    showWhy: false,
    combo: 0,
    completed: false,
  }
  return enterPart(init, 0)
}

/* ----------------------------- part predicates ----------------------------- */

/** A plain MCQ commit (predict). Contrasts have their own two-step handling. */
const isMcqPart = (part: LLPart): boolean => part === "predict"
const isContrastPart = (part: LLPart): boolean =>
  part === "contrast-insert" || part === "contrast-reach"
/** A forced-walk beat (only the next hop tappable). */
const isWalkPart = (part: LLPart): boolean => part === "traverse" || part === "doubly-walk"
/** The reachability-graded rewire beats (save-first can orphan the tail). */
const isRewirePart = (part: LLPart): boolean =>
  part === "rewire-insert" || part === "rewire-delete"
/** Scripted-write beats (perform the writes in order; a wrong move only nudges). */
const isScriptPart = (part: LLPart): boolean =>
  part === "playlist" || part === "doubly-splice"

/** Bump the graded counter for a just-cleared beat. */
function markCleared(s: LinkedListsState, part: LLPart): void {
  if (part === "traverse") s.traverseCleared = 1
  else if (part === "rewire-insert") s.insertCleared = 1
  else if (part === "rewire-delete") s.deleteCleared = 1
  else if (part === "predict") s.predictCleared = 1
  else if (part === "playlist") s.playlistCleared = 1
  else if (part === "contrast-insert") s.contrastInsertCleared = 1
  else if (part === "contrast-reach") s.contrastReachCleared = 1
  else if (part === "doubly-splice") s.doublySpliceCleared = 1
  else if (part === "doubly-walk") s.doublyWalkCleared = 1
}

/** The flat script for a scripted-write beat (synthesis flatWrites or doubly writes). */
function scriptWrites(q: LLQuestion): RewirePair[] {
  return q.kind === "playlist" ? q.flatWrites : q.doublyWrites
}

/* --------------------------------- reducer --------------------------------- */

export function linkedListsReducer(
  state: LinkedListsState,
  action: LessonAction,
): LinkedListsState {
  const part = LL_PARTS[state.partIndex]

  switch (action.type) {
    case "continue": {
      if (part === "node-demo") return enterPart(state, 1)
      if (part === "teach") return enterPart(state, 2)
      // The doubly free-play demo advances on continue.
      if (part === "doubly-demo") return enterPart(state, 10)
      return state
    }

    case "select": {
      if (isTerminalLL(state) || !state.question) return state
      // Forced walk: only the next hop is tappable.
      if (isWalkPart(part)) {
        const frontier = walkFrontierLL(state)
        if (frontier < 0) return state
        if (action.letter !== state.question.nodes[frontier]) return state
        return { ...state, selected: action.letter, feedback: "idle" }
      }
      if (isMcqPart(part) || isContrastPart(part)) {
        return { ...state, selected: action.letter, feedback: "idle" }
      }
      return state
    }

    case "rewire": {
      if (!state.question || isTerminalLL(state)) return state

      // Scripted beats (playlist synthesis, doubly splice): accept only the next
      // correct write; a wrong write nudges with no state change (never strands).
      if (isScriptPart(part)) {
        const script = scriptWrites(state.question)
        const cursor = state.writes.length
        const next = script[cursor]
        if (!next || next.from !== action.from || next.to !== action.to) {
          return { ...state, feedback: "nudge", attempts: state.attempts + 1 }
        }
        const writes = [...state.writes, { from: action.from, to: action.to }]
        const workingNext = { ...state.workingNext, [action.from]: action.to }
        if (writes.length < script.length) {
          return { ...state, writes, workingNext, feedback: "idle", attempts: state.attempts + 1 }
        }
        const v = gradeAnswer(state, true)
        const done: LinkedListsState = {
          ...state,
          writes,
          workingNext,
          feedback: v.feedback,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        markCleared(done, part)
        return done
      }

      // Reachability-graded rewire (insert / delete).
      if (!isRewirePart(part)) return state
      if (sourceNode(action.from) === action.to) return state
      const avail = availableNodes(state)
      if (!avail.has(sourceNode(action.from))) return state
      if (!avail.has(action.to)) return state
      return {
        ...state,
        workingNext: { ...state.workingNext, [action.from]: action.to },
        writes: [...state.writes, { from: action.from, to: action.to }],
        feedback: "idle",
      }
    }

    case "check": {
      if (!state.question || isTerminalLL(state)) return state
      const q = state.question

      // Contrast two-step: the pick is low-stakes (advances to the why-MCQ); the
      // why-MCQ is the real graded check.
      if (isContrastPart(part)) {
        if (state.selected == null) return state
        if (state.contrastPhase === "pick") {
          return {
            ...state,
            pick: state.selected,
            contrastPhase: "why",
            selected: null,
            feedback: "idle",
            attempts: state.attempts + 1,
          }
        }
        const v = gradeAnswer(state, state.selected === q.whyAnswer)
        const next: LinkedListsState = {
          ...state,
          feedback: v.feedback,
          wrongCount: v.wrongCount,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        if (v.correct) markCleared(next, part)
        return next
      }

      // Forced-walk + plain MCQ commit (traverse, doubly-walk, predict).
      if (isWalkPart(part) || isMcqPart(part)) {
        if (state.selected == null) return state
        const v = gradeAnswer(state, state.selected === q.answer)
        const next: LinkedListsState = {
          ...state,
          feedback: v.feedback,
          wrongCount: v.wrongCount,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        if (v.correct) markCleared(next, part)
        return next
      }

      // Reachability-graded rewire (insert / delete).
      if (isRewirePart(part)) {
        if (state.writes.length === 0) return state
        const correct = !isStuckLL(state) && isRewireCorrect(state.workingNext, q.correctNext)
        const v = gradeAnswer(state, correct)
        const next: LinkedListsState = {
          ...state,
          feedback: v.feedback,
          wrongCount: v.wrongCount,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        if (v.correct) markCleared(next, part)
        return next
      }
      return state
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      // A fresh seeded instance - demonstrate the rule, don't memorize one board.
      if (part === "traverse") {
        const { question, next } = makeWalk(state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      if (part === "rewire-insert") {
        const { question, next } = makeInsert(state.rngState)
        return { ...state, ...FRESH, question, workingNext: { ...question.initialNext }, writes: [], rngState: next }
      }
      if (part === "rewire-delete") {
        const { question, next } = makeDelete(state.rngState)
        return { ...state, ...FRESH, question, workingNext: { ...question.initialNext }, writes: [], rngState: next }
      }
      if (part === "predict") {
        const { question, next } = makePredict(state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      if (part === "playlist") {
        const question = makePlaylistSynthesis()
        return { ...state, ...FRESH, question, workingNext: { ...question.initialNext }, writes: [] }
      }
      if (part === "contrast-insert") {
        const { question, next } = makeContrast("contrast-insert", state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      if (part === "contrast-reach") {
        const { question, next } = makeContrast("contrast-reach", state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      if (part === "doubly-splice") {
        const question = makeDoublySplice()
        return { ...state, ...FRESH, question, writes: [] }
      }
      if (part === "doubly-walk") {
        const { question, next } = makeDoublyWalk(state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      return { ...state, ...FRESH, writes: [] }
    }

    case "next": {
      if (state.feedback !== "correct") return state
      if (part === "traverse") return enterPart(state, 3)
      if (part === "rewire-insert") return enterPart(state, 4)
      if (part === "rewire-delete") return enterPart(state, 5)
      if (part === "predict") return enterPart(state, 6)
      if (part === "playlist") return enterPart(state, 7)
      if (part === "contrast-insert") return enterPart(state, 8)
      if (part === "contrast-reach") return enterPart(state, 9) // -> doubly-demo
      if (part === "doubly-splice") return enterPart(state, 11)
      if (part === "doubly-walk") return { ...state, completed: true }
      return state
    }

    default:
      return state
  }
}

/* -------------------------------- selectors -------------------------------- */

export function currentPartLL(state: LinkedListsState): LLPart {
  return LL_PARTS[state.partIndex]
}

/** A verdict is terminal once correct or failed - the board locks. */
export function isTerminalLL(state: LinkedListsState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledPartsLL(state: LinkedListsState): number {
  return state.completed ? LL_TOTAL_PARTS : state.partIndex
}

/* ------------------------------- forced walk ------------------------------- */

/** The learner's current walk position (node index): head for traverse, tail for
 * the backward doubly walk, advancing as they tap the next legal hop. */
export function walkCursorLL(state: LinkedListsState): number {
  const q = state.question
  if (!q) return 0
  if (state.selected != null) {
    const i = q.nodes.indexOf(state.selected)
    if (i >= 0) return i
  }
  return q.backward ? q.nodes.length - 1 : 0
}

/** The ONLY tappable node index (the next hop), or -1 if the walk can't advance. */
export function walkFrontierLL(state: LinkedListsState): number {
  const q = state.question
  if (!q || !isWalkPart(q.kind)) return -1
  const cursor = walkCursorLL(state)
  if (q.backward) return cursor > 0 ? cursor - 1 : -1
  return cursor < q.nodes.length - 1 ? cursor + 1 : -1
}

/* ------------------------------ rewire targets ------------------------------ */

/**
 * The nodes you can currently aim at / grab the pointer of for the reachability-
 * graded rewires (insert / delete): everything reachable from the head, plus the
 * loose new node. Drives the figure's legal-target glow.
 */
export function availableNodes(state: LinkedListsState): Set<string> {
  const q = state.question
  if (!q) return new Set()
  const reachable = reachableFrom(q.head, state.workingNext)
  if (q.newNode) reachable.add(q.newNode)
  return reachable
}

/** Legal rewire targets for the current beat (synthesis is permissive; the engine
 * validates the actual scripted write). */
export function legalTargets(state: LinkedListsState): Set<string> {
  const q = state.question
  if (q && q.kind === "playlist") return playlistLegalLL(state)
  return availableNodes(state)
}

/** Question nodes the list has orphaned (present, but no longer reachable). */
export function orphanedNodes(state: LinkedListsState): string[] {
  const q = state.question
  if (!q) return []
  if (q.kind === "playlist") return playlistOrphanedLL(state)
  if (q.kind !== "rewire-insert" && q.kind !== "rewire-delete") return []
  const avail = availableNodes(state)
  return q.nodes.filter((n) => !avail.has(n))
}

/**
 * Is the splice now impossible (insert only)? True once `at` (the node X must
 * point to) is neither reachable from the head nor already held by X - i.e. the
 * tail floated off. This is the unsafe-order catastrophe; it grades as a fail.
 */
export function isStuckLL(state: LinkedListsState): boolean {
  const q = state.question
  if (!q || q.kind !== "rewire-insert" || !q.at || !q.newNode || isTerminalLL(state)) {
    return false
  }
  const reachable = reachableFrom(q.head, state.workingNext)
  const xHoldsAt = state.workingNext[pointerId(q.newNode)] === q.at
  return !reachable.has(q.at) && !xHoldsAt
}

/* ----------------------------- playlist synthesis ----------------------------- */

/** The current playlist step (insert / delete / reorder), derived from progress. */
export function playlistStepLL(state: LinkedListsState): PlaylistStep | null {
  const q = state.question
  if (!q || q.kind !== "playlist") return null
  const cursor = state.writes.length
  for (const step of q.playlistSteps) {
    if (cursor < step.writeEnd) return step
  }
  return q.playlistSteps[q.playlistSteps.length - 1]
}

/** Zero-based index of the current playlist phase (0..steps-1; clamped at the end). */
export function playlistPhaseIndexLL(state: LinkedListsState): number {
  const q = state.question
  if (!q || q.kind !== "playlist") return 0
  const cursor = state.writes.length
  for (let i = 0; i < q.playlistSteps.length; i++) {
    if (cursor < q.playlistSteps[i].writeEnd) return i
  }
  return q.playlistSteps.length - 1
}

/** Tracks the playlist has truly dropped (deleted), excluding the new + moved tracks. */
export function playlistOrphanedLL(state: LinkedListsState): string[] {
  const q = state.question
  if (!q || q.kind !== "playlist") return []
  const reach = reachableFrom(q.head, state.workingNext)
  const keep = new Set<string>([NEW_NODE])
  for (const step of q.playlistSteps) if (step.phase === "reorder" && step.cur) keep.add(step.cur)
  return q.nodes.filter((n) => !reach.has(n) && !keep.has(n))
}

/** Permissive legal-target glow for the synthesis (the engine validates the write). */
export function playlistLegalLL(state: LinkedListsState): Set<string> {
  const q = state.question
  if (!q || q.kind !== "playlist") return new Set()
  const orphan = new Set(playlistOrphanedLL(state))
  const legal = new Set<string>([NEW_NODE])
  for (const n of q.nodes) if (!orphan.has(n)) legal.add(n)
  return legal
}

/** The remaining scripted writes (the next one carries the dev/E2E order hint). */
export function remainingScriptLL(state: LinkedListsState): RewirePair[] {
  const q = state.question
  if (!q || !isScriptPart(q.kind)) return []
  return scriptWrites(q).slice(state.writes.length)
}

/** True once a scripted write has been performed (drives the chip checkmarks). */
export function isWriteDoneLL(state: LinkedListsState, write: RewirePair): boolean {
  return state.writes.some((w) => w.from === write.from && w.to === write.to)
}

/* ------------------------------- completion ------------------------------- */

/** The hard mastery gate: clear all nine graded beats. */
export function isCompleteLL(state: LinkedListsState): boolean {
  return (
    state.traverseCleared >= 1 &&
    state.insertCleared >= 1 &&
    state.deleteCleared >= 1 &&
    state.predictCleared >= 1 &&
    state.playlistCleared >= 1 &&
    state.contrastInsertCleared >= 1 &&
    state.contrastReachCleared >= 1 &&
    state.doublySpliceCleared >= 1 &&
    state.doublyWalkCleared >= 1
  )
}

/* ----------------------------- resume / progress ----------------------------- */

export function toProgressLinkedLists(s: LinkedListsState): LessonProgress {
  return {
    counters: {
      traverse: s.traverseCleared,
      insert: s.insertCleared,
      delete: s.deleteCleared,
      predict: s.predictCleared,
      playlist: s.playlistCleared,
      contrastInsert: s.contrastInsertCleared,
      contrastReach: s.contrastReachCleared,
      doublySplice: s.doublySpliceCleared,
      doublyWalk: s.doublyWalkCleared,
      attempts: s.attempts,
    },
    currentPart: currentPartLL(s),
    completed: s.completed || isCompleteLL(s),
  }
}

function clampLL(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), max)
}

export function resumeLinkedLists(
  progress: LessonProgress,
  seed: number = Date.now(),
): LinkedListsState {
  const base = createLinkedLists(seed)
  const c = progress.counters
  const seeded: LinkedListsState = {
    ...base,
    traverseCleared: clampLL(c.traverse ?? 0, 1),
    insertCleared: clampLL(c.insert ?? 0, 1),
    deleteCleared: clampLL(c.delete ?? 0, 1),
    predictCleared: clampLL(c.predict ?? 0, 1),
    playlistCleared: clampLL(c.playlist ?? 0, 1),
    contrastInsertCleared: clampLL(c.contrastInsert ?? 0, 1),
    contrastReachCleared: clampLL(c.contrastReach ?? 0, 1),
    doublySpliceCleared: clampLL(c.doublySplice ?? 0, 1),
    doublyWalkCleared: clampLL(c.doublyWalk ?? 0, 1),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, LL_PARTS.indexOf(progress.currentPart as LLPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}

export function hasProgressLinkedLists(s: LinkedListsState): boolean {
  return (
    s.partIndex > 0 ||
    s.traverseCleared > 0 ||
    s.insertCleared > 0 ||
    s.deleteCleared > 0 ||
    s.predictCleared > 0 ||
    s.playlistCleared > 0 ||
    s.contrastInsertCleared > 0 ||
    s.contrastReachCleared > 0 ||
    s.doublySpliceCleared > 0 ||
    s.doublyWalkCleared > 0
  )
}
