import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Linked Lists lesson engine. One idea: a list is held
 * together by **pointers, not position**. Reaching the k-th node is a walk from
 * the head (no jump — O(n)); but splicing a node in is two pointer writes whose
 * ORDER matters — save the rest of the list first (`new.next = prev.next`) THEN
 * repoint (`prev.next = new`). Do it backwards and the tail is orphaned:
 * unreachable from the head, gone for good.
 *
 * Insert/delete are graded by **reachability**, not final adjacency — a write
 * that drops nodes out of the head-reachable set makes them un-grabbable and
 * un-targetable (the figure floats them away), so the unsafe order can't be
 * finished. Deterministic (seeded): same state → same question/verdict.
 *
 * Build state (slices 1–2): node demo → teach → traverse (L1) → rewire-insert
 * (L2). Later slices add delete/predict/contrast/doubly to grow the curated set.
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
  "doubly",
] as const
export type LLPart = (typeof LL_PARTS)[number]
export const LL_TOTAL_PARTS = LL_PARTS.length

const LETTERS = ["A", "B", "C", "D", "E", "F", "G"]
/** The node spliced in by an insert (a fixed label keeps keys stable). */
export const NEW_NODE = "X"
/** The null terminator a tail pointer aims at. */
export const NIL = "∅"

/** A pointer source id ("p:A", "p:X") — the re-aimable "next" of a node. */
export const pointerId = (node: string) => `p:${node}`
/** The node a pointer source belongs to ("p:A" → "A"). */
export const sourceNode = (id: string) => (id.startsWith("p:") ? id.slice(2) : id)

export interface LLOption {
  id: string
  label: string
}

/** One pointer re-aim: a pointer source aimed at a target node id. */
export interface RewirePair {
  from: string // pointer source id ("p:A", "p:X")
  to: string // target node id ("A", "X", "∅")
}

export interface LLQuestion {
  kind: LLPart
  prompt: string
  nodes: string[] // the chain, head-first (e.g. [A,B,C,D])
  head: string // nodes[0]
  // traverse (L1):
  targetIndex: number // hops from the head to the asked node (-1 if n/a)
  options: LLOption[]
  answer: string
  // rewire-insert (L2):
  newNode: string | null // "X" — starts loose, spliced in
  prev: string | null // the node X is inserted after
  at: string | null // prev's old next — the node X must end up pointing to
  initialNext: Record<string, string> // the chain's pointer map at the start
  correctNext: Record<string, string> // the unique correct full pointer map
  rewires: RewirePair[] // PINNED correct order: [X→at (save), prev→X (splice)]
  // contrast (L5): the same op on an array and a list, side by side
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
  traverseCleared: number // 0 | 1 — graded L1
  insertCleared: number // 0 | 1 — graded L2
  deleteCleared: number // 0 | 1 — graded L3
  predictCleared: number // 0 | 1 — graded L4
  playlistCleared: number // 0 | 1 — graded real-world (L2 skin)
  contrastInsertCleared: number // 0 | 1 — graded L5 (insert)
  contrastReachCleared: number // 0 | 1 — graded L5 (reach)
  attempts: number
  question: LLQuestion | null
  workingNext: Record<string, string> // the live, learner-mutated pointer map (rewire)
  writes: RewirePair[] // ordered log of this attempt's re-aims (replay + Check-ready)
  selected: string | null // traverse MCQ choice
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
 * The set of node ids reachable by walking `next` from the head — stopping at ∅,
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
  options: [] as LLOption[],
  answer: "",
  newNode: null,
  prev: null,
  at: null,
  rewires: [] as RewirePair[],
  correctNext: {} as Record<string, string>,
}

/** A small read-only chain for the intro (beat 1) and teach (beat 2) screens. */
function makeIntro(kind: "node-demo" | "teach"): LLQuestion {
  const nodes = LETTERS.slice(0, 4)
  return {
    kind,
    prompt:
      kind === "node-demo"
        ? "Drag a node anywhere — the list doesn't change."
        : "Pointers are the structure — and the head is sacred.",
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
 * Traverse-to-find (L1, de-cued): walk from the head — there's no jump. The
 * learner answers by **tapping the target node itself** (no MCQ); tapping any
 * node lights the head→node path and shows the hop cost, so the "walk, don't
 * jump" cost is felt. Two prompt shapes (same answer node): the k-th node by
 * position, or the node a given number of hops from the head.
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

  // The answer is the node itself — the learner taps it in the figure.
  const answer = nodes[targetIndex]
  const prompt = askValue
    ? `Tap the ${ordinal(targetIndex + 1)} node.`
    : `Tap the node ${targetIndex} hop${plural(targetIndex)} from the head.`
  const correct = askValue
    ? `That's the ${ordinal(targetIndex + 1)} node — ${targetIndex} link${plural(targetIndex)} from the head.`
    : `${answer} sits ${targetIndex} hop${plural(targetIndex)} from the head — one per link.`
  const why = askValue
    ? `From the head you follow each next pointer ${targetIndex} time${plural(targetIndex)} — there's no jump — landing on ${answer}.`
    : `Reaching ${answer} means following ${targetIndex} next pointer${plural(targetIndex)} from the head; a list has no index math.`

  return {
    question: {
      kind: "traverse",
      prompt,
      nodes,
      head,
      initialNext: chainNext(nodes),
      newNode: null,
      prev: null,
      at: null,
      rewires: [],
      correctNext: {},
      targetIndex,
      options: [],
      answer,
      cost: { word: "scales", count: targetIndex, unit: targetIndex === 1 ? "hop" : "hops" },
      hint: "",
      nudge: "Count the links from the head one hop at a time, then tap that node.",
      correct,
      why,
    },
    next: a,
  }
}

/**
 * Insert X after an interior node. Seeded chain (len 4–5), insert index
 * i ∈ 1..len−1, so X always splices between two real nodes. The pinned correct
 * order is SAVE-FIRST: `X → node[i]` (save the tail) THEN `node[i−1] → X`.
 */
function makeInsert(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  let r = rngInt(a, 2)
  a = r.next
  const len = 4 + r.value // 4..5 — fits a phone row once the figure scales
  const nodes = LETTERS.slice(0, len)
  r = rngInt(a, len - 1)
  a = r.next
  const index = 1 + r.value // 1..len-1

  const head = nodes[0]
  const prev = nodes[index - 1]
  const at = nodes[index]
  const initialNext = chainNext(nodes) // p:X is unset until the learner aims it
  const correctNext: Record<string, string> = {
    ...initialNext,
    [pointerId(NEW_NODE)]: at,
    [pointerId(prev)]: NEW_NODE,
  }
  // Save-first: aim the new node at the tail BEFORE repointing prev — the reverse
  // overwrites prev's link before the tail is saved, orphaning everything after.
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
      targetIndex: -1,
      options: [],
      answer: "",
      newNode: NEW_NODE,
      prev,
      at,
      initialNext,
      correctNext,
      rewires,
      cost: { word: "free", count: 2, unit: "pointers rewired" },
      hint: "",
      nudge: "Re-aim a pointer — don't slide nodes. Two writes splice X in.",
      correct: "Two writes splice X in — nothing else moved.",
      why: `Aim ${NEW_NODE} → ${at} first so the tail is saved, then ${prev} → ${NEW_NODE}. Repoint ${prev} first and ${at}'s run of the list is orphaned — unreachable from the head.`,
    },
    next: a,
  }
}

/**
 * Delete an interior node by bypassing it: one repoint, `prev.next = after`. The
 * removed node simply falls out of the head-reachable set (in a pointer world,
 * bypassing IS deleting). Seeded chain (len 4–5), cur ∈ 1..len−2 so it has both
 * a prev and a successor.
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
      targetIndex: -1,
      options: [],
      answer: "",
      newNode: null,
      prev,
      at: null,
      initialNext,
      correctNext,
      rewires,
      cost: { word: "free", count: 1, unit: "pointer rewired" },
      hint: "",
      nudge: "Re-aim one pointer to bypass the node — don't slide anything.",
      correct: `One write and ${cur} is bypassed — it's gone.`,
      why: `Re-aim ${prev} → ${after}. ${cur} is no longer reachable from the head, so it's removed — a single pointer write.`,
    },
    next: a,
  }
}

/**
 * Predict-the-break (L4): a pure MCQ on the consequence of the UNSAFE insert
 * order. Repoint `prev → X` before saving `X → cur` and the tail is orphaned —
 * the misconception ("order doesn't matter") and a classic fear ("it loops") are
 * the distractors.
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
      { id: "fine", label: "It works — the order doesn't matter" },
      { id: "lost", label: `Everything after ${prev} is lost` },
      { id: "loop", label: "The list loops back on itself forever" },
    ],
    a,
  )
  a = sh.next

  return {
    question: {
      kind: "predict",
      prompt: `You point ${prev} → ${NEW_NODE} before saving ${NEW_NODE} → ${cur}. What happens?`,
      nodes,
      head: nodes[0],
      initialNext: chainNext(nodes),
      newNode: NEW_NODE,
      prev,
      at: cur,
      rewires: [],
      correctNext: {},
      targetIndex: -1,
      options: sh.result,
      answer: "lost",
      cost: { word: "scales", count: 0, unit: "" },
      hint: "",
      nudge: `After you repoint ${prev}, what still points at ${cur}?`,
      correct: `Right — nothing points at ${cur} anymore, so the tail is orphaned.`,
      why: `Repointing ${prev} first overwrites the only link to ${cur}'s run before ${NEW_NODE} saved it — the rest of the list is unreachable from the head. Save first, then repoint.`,
    },
    next: a,
  }
}

/**
 * Real-world skin (beat 7): the same save-first insert, framed as queuing a track
 * in a playlist. A playlist IS a linked list — adding a song is two pointer
 * writes in the right order.
 */
function makePlaylist(seed: number): { question: LLQuestion; next: number } {
  const { question, next } = makeInsert(seed)
  const prev = question.prev!
  const at = question.at!
  return {
    question: {
      ...question,
      kind: "playlist",
      prompt: `Queue the new track after ${prev}.`,
      hint: "",
      correct: "Two writes and the track is queued — the rest of the playlist plays on.",
      why: `A playlist is a linked list. Save ${at} onto the new track first, then point ${prev} at it — repoint ${prev} first and the rest of the queue is lost.`,
    },
    next,
  }
}

/** L5 contrast — insert in the middle: an array ripples; a list rewires 2. */
function makeContrastInsert(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  const r = rngInt(a, 2)
  a = r.next
  const len = 5 + r.value // 5..6 — a clear ripple
  const items = LETTERS.slice(0, len)
  const k = Math.floor(len / 2)
  const arrayShift = len - k
  const sh = shuffle(
    [
      { id: "list", label: "List — rewire 2 pointers" },
      { id: "array", label: `Array — shift ${arrayShift} cells` },
      { id: "same", label: "Same work either way" },
    ],
    a,
  )
  a = sh.next
  return {
    question: {
      kind: "contrast-insert",
      prompt: "Insert a value in the middle. Which does less work?",
      nodes: items,
      head: items[0],
      initialNext: chainNext(items),
      newNode: null,
      prev: null,
      at: null,
      rewires: [],
      correctNext: {},
      targetIndex: -1,
      options: sh.result,
      answer: "list",
      array: items,
      arrayCost: { word: "scales", count: arrayShift, unit: "cells shifted" },
      listCost: { word: "free", count: 2, unit: "pointers rewired" },
      cost: { word: "free", count: 2, unit: "pointers rewired" },
      hint: "",
      nudge: "One slides everything after the spot; the other re-aims 2 pointers.",
      correct: "The list rewires 2 pointers; the array shifts the rest.",
      why: `A list splices anywhere with 2 writes. An array slides ${arrayShift} cells to open a gap.`,
    },
    next: a,
  }
}

/** L5 contrast — reach the k-th item: an array jumps; a list walks. The inverse trade. */
function makeContrastReach(seed: number): { question: LLQuestion; next: number } {
  let a = seed
  const r = rngInt(a, 2)
  a = r.next
  const len = 5 + r.value
  const items = LETTERS.slice(0, len)
  const k = len - 1
  const sh = shuffle(
    [
      { id: "array", label: "Array — jump straight there" },
      { id: "list", label: `List — walk ${k} hops` },
      { id: "same", label: "Same work either way" },
    ],
    a,
  )
  a = sh.next
  return {
    question: {
      kind: "contrast-reach",
      prompt: "Reach the last item. Which does less work?",
      nodes: items,
      head: items[0],
      initialNext: chainNext(items),
      newNode: null,
      prev: null,
      at: null,
      rewires: [],
      correctNext: {},
      targetIndex: k,
      options: sh.result,
      answer: "array",
      array: items,
      arrayCost: { word: "free", count: 1, unit: "jump" },
      listCost: { word: "scales", count: k, unit: "hops" },
      cost: { word: "free", count: 1, unit: "jump" },
      hint: "",
      nudge: "Can you jump to an index in a list?",
      correct: "The array jumps by index; the list must walk.",
      why: `An array reads any index in one jump. A list walks ${k} hops from the head — no index math.`,
    },
    next: a,
  }
}

/**
 * Doubly-linked teaching coda (beat 10): an UNGRADED beat. Adds a backward `prev`
 * arrow, so a splice grows to 4 ordered writes and the walk goes both ways. Not
 * behind the mastery wall — it's where the lesson points next.
 */
function makeDoubly(): LLQuestion {
  const nodes = LETTERS.slice(0, 4) // A,B,C,D
  return {
    kind: "doubly",
    prompt: "Now every node points both ways.",
    nodes,
    head: nodes[0],
    initialNext: chainNext(nodes),
    targetIndex: -1,
    options: [],
    answer: "",
    newNode: NEW_NODE,
    prev: nodes[0], // splice example: insert X between A and B
    at: nodes[1],
    rewires: [],
    correctNext: {},
    cost: { word: "free", count: 4, unit: "pointer writes" },
    hint: "",
    nudge: "",
    correct: "",
    why: "",
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
  if (part === "playlist") {
    const { question, next } = makePlaylist(state.rngState)
    return { ...base, question, workingNext: { ...question.initialNext }, rngState: next }
  }
  if (part === "contrast-insert") {
    const { question, next } = makeContrastInsert(state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "contrast-reach") {
    const { question, next } = makeContrastReach(state.rngState)
    return { ...base, question, rngState: next }
  }
  if (part === "doubly") {
    return { ...base, question: makeDoubly() }
  }
  // predict
  const { question, next } = makePredict(state.rngState)
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
    attempts: 0,
    question: null,
    workingNext: {},
    writes: [],
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

/* ----------------------------- part predicates ----------------------------- */

const isMcqPart = (part: LLPart): boolean =>
  part === "traverse" || part === "predict" || part === "contrast-insert" || part === "contrast-reach"

const isRewirePart = (part: LLPart): boolean =>
  part === "rewire-insert" || part === "rewire-delete" || part === "playlist"

/** Insert-mechanic rewires (save-first, can orphan the tail): insert + playlist. */
const isInsertLike = (kind: LLPart): boolean =>
  kind === "rewire-insert" || kind === "playlist"

/** Bump the graded counter for a just-cleared beat. */
function markCleared(s: LinkedListsState, part: LLPart): void {
  if (part === "traverse") s.traverseCleared = 1
  else if (part === "rewire-insert") s.insertCleared = 1
  else if (part === "rewire-delete") s.deleteCleared = 1
  else if (part === "predict") s.predictCleared = 1
  else if (part === "playlist") s.playlistCleared = 1
  else if (part === "contrast-insert") s.contrastInsertCleared = 1
  else if (part === "contrast-reach") s.contrastReachCleared = 1
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
      // The doubly coda is ungraded — Finish ends the lesson.
      if (part === "doubly") return { ...state, completed: true }
      return state
    }

    case "select": {
      if (!isMcqPart(part) || isTerminalLL(state)) return state
      return { ...state, selected: action.letter, feedback: "idle" }
    }

    case "rewire": {
      if (!isRewirePart(part) || !state.question) return state
      if (isTerminalLL(state)) return state
      // A node can't point at itself — dropping a node's arrow on itself is a no-op
      // (it happens when a grab barely moves before release).
      if (sourceNode(action.from) === action.to) return state
      // Reachability is the gate: you can only grab a pointer you can still reach
      // and aim it at a node you can still reach. A node the list has orphaned is
      // gone — neither grabbable nor targetable. (The figure mirrors this.)
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

      // MCQ beats: traverse (L1), predict (L4), and the two L5 contrasts.
      if (isMcqPart(part)) {
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

      // Rewire beats: insert (L2), delete (L3), and the playlist real-world (L2 skin).
      if (isRewirePart(part)) {
        if (state.writes.length === 0) return state
        // A stuck board (insert/playlist orphaned the tail) can never be correct,
        // so it grades like any wrong answer through the shared machine — a nudge
        // first, then a full fail at WRONG_LIMIT (flame breaks only on the fail).
        // The figure shows the tail floating off the whole time; Why? reveals the
        // safe order. (Delete never stalls.)
        const correct =
          !isStuckLL(state) && isRewireCorrect(state.workingNext, q.correctNext)
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
      // A fresh seeded instance — demonstrate the rule, don't memorize one board.
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
      if (part === "playlist") {
        const { question, next } = makePlaylist(state.rngState)
        return { ...state, ...FRESH, question, workingNext: { ...question.initialNext }, writes: [], rngState: next }
      }
      if (part === "contrast-insert") {
        const { question, next } = makeContrastInsert(state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      if (part === "contrast-reach") {
        const { question, next } = makeContrastReach(state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      if (part === "predict") {
        const { question, next } = makePredict(state.rngState)
        return { ...state, ...FRESH, question, writes: [], rngState: next }
      }
      return { ...state, ...FRESH, writes: [] }
    }

    case "next": {
      if (state.feedback !== "correct") return state
      if (part === "traverse") return enterPart(state, 3) // → rewire-insert
      if (part === "rewire-insert") return enterPart(state, 4) // → rewire-delete
      if (part === "rewire-delete") return enterPart(state, 5) // → predict
      if (part === "predict") return enterPart(state, 6) // → playlist
      if (part === "playlist") return enterPart(state, 7) // → contrast-insert
      if (part === "contrast-insert") return enterPart(state, 8) // → contrast-reach
      if (part === "contrast-reach") return enterPart(state, 9) // → doubly coda (ungraded)
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

/** A verdict is terminal once correct or failed — the board locks. */
export function isTerminalLL(state: LinkedListsState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledPartsLL(state: LinkedListsState): number {
  return state.completed ? LL_TOTAL_PARTS : state.partIndex
}

/**
 * The nodes you can currently aim at / grab the pointer of: everything reachable
 * from the head, plus the loose new node (always available so it can be spliced).
 * Drives the figure's legal-target glow AND which nodes/pointers stay interactive.
 */
export function availableNodes(state: LinkedListsState): Set<string> {
  const q = state.question
  if (!q) return new Set()
  const reachable = reachableFrom(q.head, state.workingNext)
  if (q.newNode) reachable.add(q.newNode)
  return reachable
}

/** Alias kept for the rewire surface's `legalTargets` prop (highlight only). */
export function legalTargets(state: LinkedListsState): Set<string> {
  return availableNodes(state)
}

/** Question nodes the list has orphaned (present, but no longer reachable). */
export function orphanedNodes(state: LinkedListsState): string[] {
  const q = state.question
  if (!q || (!isInsertLike(q.kind) && q.kind !== "rewire-delete")) return []
  const avail = availableNodes(state)
  return q.nodes.filter((n) => !avail.has(n))
}

/**
 * Is the splice now impossible? True once `at` (the node X must point to) is
 * neither reachable from the head nor already held by X — i.e. the tail floated
 * off. This is the unsafe-order catastrophe, and it grades as a full fail.
 */
export function isStuckLL(state: LinkedListsState): boolean {
  const q = state.question
  if (!q || !isInsertLike(q.kind) || !q.at || !q.newNode || isTerminalLL(state)) {
    return false
  }
  const reachable = reachableFrom(q.head, state.workingNext)
  const xHoldsAt = state.workingNext[pointerId(q.newNode)] === q.at
  return !reachable.has(q.at) && !xHoldsAt
}

/** The hard mastery gate: clear all 7 graded beats (doubly, beat 10, is taught). */
export function isCompleteLL(state: LinkedListsState): boolean {
  return (
    state.traverseCleared >= 1 &&
    state.insertCleared >= 1 &&
    state.deleteCleared >= 1 &&
    state.predictCleared >= 1 &&
    state.playlistCleared >= 1 &&
    state.contrastInsertCleared >= 1 &&
    state.contrastReachCleared >= 1
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
    s.contrastReachCleared > 0
  )
}
