import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/**
 * Pure, framework-agnostic Trees (BST) lesson engine. One idea: a BST is an
 * *ordering you descend*. Each comparison throws away half the tree (halving),
 * and the sorted order is *recovered* by an in-order traversal (left → node →
 * right), not *stored* in a row. Two faces (descend / locate and in-order /
 * sequence) plus a comparison synthesis (same keys → same sorted output →
 * different shape → different cost) kill the "a BST is just a sorted list"
 * misconception.
 *
 * Eleven beats, eight graded behind the until-correct wall, aggregated into a
 * 4/2/2 gate across three bins (Locate / Sequence / Comparison). Reuses the
 * shared feedback machine + flame (`gradeAnswer`) and the same LessonProgress
 * shape; only the tree model, verdicts, and quotas are Trees-specific. Layout is
 * hand-rolled and PRESENTATIONAL. Every verdict here is a pure function of the
 * given tree (`descendPath` / `insertSlot` / `inorder`), never of pixels. Tap
 * only: no `rewire` action, no drag, no heavy layout lib. Deterministic (seeded):
 * same state always yields the same question/feedback.
 */

export interface TreeNode {
  /** Stable tap id, unique within a tree (e.g. "n8"). */
  id: string
  key: number
  left: TreeNode | null
  right: TreeNode | null
}

export const TREES_PARTS = [
  "demo", // 1  intro free-play: tap a node, watch the opposite subtree drop
  "teach-descend", // 2  teach: compare · go left if smaller / right if larger · drop half
  "find-hit", // 3  T1 descend-find (hit)                       Locate ✓
  "find-miss", // 4  T1 descend-find (falls off / absent)         Locate ✓
  "insert", // 5  T2 descend-insert (tap the ghost slot)        Locate ✓
  "teach-inorder", // 6  teach: left subtree → node → right subtree
  "sequence-a", // 7  T3 in-order tap (compact, tree #1)            Sequence ✓
  "sequence-b", // 8  T3 in-order tap (compact, tree #2)            Sequence ✓
  "realworld", // 9  T1 skin: higher/lower number guess           Locate ✓
  "compare-shape", // 10 T4 same keys, balanced vs stick (MCQ)        Comparison ✓
  "contrast-list", // 11 T5 sorted list walk vs BST descend           Comparison ✓
] as const
export type TreesPart = (typeof TREES_PARTS)[number]
export const TREES_TOTAL_PARTS = TREES_PARTS.length

export const LOCATE_QUOTA = 4
export const SEQUENCE_QUOTA = 2
export const COMPARISON_QUOTA = 2

export type TreesBin = "locate" | "sequence" | "comparison"
export type TreesMode = "intro" | "descend" | "sequence" | "mcq" | "contrast"
export type Side = "left" | "right"

export interface TreesOption {
  id: string
  label: string
}
export interface TreesCost {
  word: CostWord
  count: number
  unit: string
}

/* ----------------- pure tree helpers (all grading lives here) ---------------- */

export interface DescendStep {
  id: string
  goLeft: boolean
  /** Size of the opposite subtree discarded at this step (the halving number). */
  droppedSize: number
}
export interface DescendResult {
  /** Node ids root → … (target | last-before-fall). */
  path: string[]
  found: boolean
  /** Parent of the empty slot (miss / insert), else null. */
  missingParentId: string | null
  missingSide: Side | null
  /** = path.length → the "barely grows" comparison count. */
  comparisons: number
  steps: DescendStep[]
}

export function subtreeSize(node: TreeNode | null): number {
  if (!node) return 0
  return 1 + subtreeSize(node.left) + subtreeSize(node.right)
}

/**
 * The closed key interval `[min, max]` a subtree spans (its leftmost and
 * rightmost in-order keys). Pure over the tree, so the "guess my number" range
 * band is derived from the same source as the verdict and can never disagree
 * with it: the lit band is always exactly the cursor subtree's reachable keys,
 * which halves as the descend discards the opposite side. Returns null for an
 * empty subtree.
 */
export function subtreeKeyRange(node: TreeNode | null): [number, number] | null {
  if (!node) return null
  let min = node.key
  let max = node.key
  const walk = (n: TreeNode | null) => {
    if (!n) return
    if (n.key < min) min = n.key
    if (n.key > max) max = n.key
    walk(n.left)
    walk(n.right)
  }
  walk(node)
  return [min, max]
}

/** The subtree height in edges: a leaf is 0, the degenerate stick is n − 1. */
export function depth(node: TreeNode | null): number {
  if (!node) return -1
  return 1 + Math.max(depth(node.left), depth(node.right))
}

export function nodeById(root: TreeNode | null, id: string): TreeNode | null {
  if (!root) return null
  if (root.id === id) return root
  return nodeById(root.left, id) ?? nodeById(root.right, id)
}

/** In-order node ids: recurse left, emit node, recurse right (the sorted order). */
export function inorder(root: TreeNode | null): string[] {
  if (!root) return []
  return [...inorder(root.left), root.id, ...inorder(root.right)]
}

/** In-order keys: the unique sorted sequence (BST invariant + no dup keys). */
export function inorderKeys(root: TreeNode | null): number[] {
  if (!root) return []
  return [...inorderKeys(root.left), root.key, ...inorderKeys(root.right)]
}

/**
 * Descend the tree comparing `x` at each node: `x < key ⇒ left`, `x > key ⇒
 * right` (`=` only at a hit, since keys are unique). Returns the unique path, a
 * found flag, the empty slot the search falls into (miss / insert), and the
 * per-step opposite-subtree drop counts. Pure: the verdict for every Locate
 * beat is read straight off this.
 */
export function descendPath(root: TreeNode, x: number): DescendResult {
  const path: string[] = []
  const steps: DescendStep[] = []
  let cur: TreeNode | null = root
  while (cur) {
    path.push(cur.id)
    if (x === cur.key) {
      return { path, found: true, missingParentId: null, missingSide: null, comparisons: path.length, steps }
    }
    const goLeft: boolean = x < cur.key
    const child: TreeNode | null = goLeft ? cur.left : cur.right
    const dropped: TreeNode | null = goLeft ? cur.right : cur.left
    if (!child) {
      return {
        path,
        found: false,
        missingParentId: cur.id,
        missingSide: goLeft ? "left" : "right",
        comparisons: path.length,
        steps,
      }
    }
    steps.push({ id: cur.id, goLeft, droppedSize: subtreeSize(dropped) })
    cur = child
  }
  // Unreachable for a non-empty tree, but keeps the function total.
  return { path, found: false, missingParentId: null, missingSide: null, comparisons: path.length, steps }
}

/** The unique empty child slot where `x` would attach (x must be absent). */
export function insertSlot(root: TreeNode, x: number): { parentId: string; side: Side } {
  const d = descendPath(root, x)
  return { parentId: d.missingParentId ?? root.id, side: d.missingSide ?? "left" }
}

/** Ids of every node in a subtree (for the dropped-half SR note + dimming). */
function collectIds(node: TreeNode | null, into: Set<string>): void {
  if (!node) return
  into.add(node.id)
  collectIds(node.left, into)
  collectIds(node.right, into)
}

/* ------------------------------ curated BST pool ----------------------------- */

/**
 * Canonical balanced tree `T_BAL` (keys 2·4·6·8·10·12·14): root 8 → left
 * 4(2,6), right 12(10,14). inorder = 2,4,6,8,10,12,14; balanced (height 2 edges).
 */
export const T_BAL: TreeNode = {
  id: "n8",
  key: 8,
  left: {
    id: "n4",
    key: 4,
    left: { id: "n2", key: 2, left: null, right: null },
    right: { id: "n6", key: 6, left: null, right: null },
  },
  right: {
    id: "n12",
    key: 12,
    left: { id: "n10", key: 10, left: null, right: null },
    right: { id: "n14", key: 14, left: null, right: null },
  },
}

/**
 * The zigzag tree `T_ZIG` (keys 3·5·7·9·11·15): root 9 → left 3(right 7(left 5)),
 * right 15(left 11). inorder = 3,5,7,9,11,15. A clearly non-monotonic shape so
 * the compact draw can't be read left-to-right.
 */
export const T_ZIG: TreeNode = {
  id: "n9",
  key: 9,
  left: {
    id: "n3",
    key: 3,
    left: null,
    right: {
      id: "n7",
      key: 7,
      left: { id: "n5", key: 5, left: null, right: null },
      right: null,
    },
  },
  right: {
    id: "n15",
    key: 15,
    left: { id: "n11", key: 11, left: null, right: null },
    right: null,
  },
}

/** A right-leaning degenerate "stick": a linked list drawn as a tree. */
function buildStick(keys: number[], prefix: string): TreeNode {
  let acc: TreeNode | null = null
  for (let i = keys.length - 1; i >= 0; i--) {
    acc = { id: `${prefix}${keys[i]}`, key: keys[i], left: null, right: acc }
  }
  return acc as TreeNode
}

/** `T_STICK`: the same keys as `T_BAL`, but a stick (depth 6, same in-order). */
export const T_STICK: TreeNode = buildStick([2, 4, 6, 8, 10, 12, 14], "s")

/* ----------------------------- cost + copy makers ---------------------------- */

const comparisonsCost = (n: number): TreesCost => ({
  word: "barely grows",
  count: n,
  unit: n === 1 ? "comparison" : "comparisons",
})
const scalesCost = (n: number, unit: string): TreesCost => ({ word: "scales", count: n, unit })

export interface TreesQuestion {
  kind: TreesPart
  bin: TreesBin | null
  mode: TreesMode
  title: string
  prompt: string
  tree: TreeNode
  /** The X being searched / inserted (the present key for hits, absent for miss/insert). */
  target: number | null
  descend: DescendResult | null
  insertAt: { parentId: string; side: Side } | null
  /** In-order ids: the unique correct tap order (sequence beats). */
  order: string[]
  options: TreesOption[]
  answer: string
  /** T4 degenerate same-keys tree (compare-shape). */
  stick: TreeNode | null
  /** T5 sorted list keys (tap-walk). */
  chain: number[] | null
  /** T5 index of the target within `chain` (-1 if n/a). */
  chainTargetIndex: number
  cost: TreesCost | null
  altCost: TreesCost | null
  /** Real-world (higher/lower) skin flag. */
  realWorld: boolean
  hint: string
  nudge: string
  correct: string
  why: string
}

export interface TreesState {
  seed: number
  rngState: number
  partIndex: number
  locateCorrect: number // 0..4
  sequenceCorrect: number // 0..2
  comparisonCorrect: number // 0..2
  attempts: number
  question: TreesQuestion | null
  /** Descend working state: starts [root.id]; child taps append. Transient. */
  tappedPath: string[]
  /** Ghost terminal (miss / insert). Transient. */
  tappedSlot: { parentId: string; side: Side } | null
  /** Sequence taps. Transient. */
  tappedOrder: string[]
  /** T5 felt pre-walk position. Transient. */
  chainCursor: number
  /** MCQ option id. */
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

const CONTINUE_PARTS: ReadonlySet<TreesPart> = new Set([
  "demo",
  "teach-descend",
  "teach-inorder",
])
const DESCEND_PARTS: ReadonlySet<TreesPart> = new Set([
  "demo",
  "find-hit",
  "find-miss",
  "insert",
  "realworld",
  "contrast-list",
])
const SEQUENCE_PARTS: ReadonlySet<TreesPart> = new Set(["sequence-a", "sequence-b"])

/** Beats advanced by Continue (no grading). */
export const isContinuePart = (part: TreesPart): boolean => CONTINUE_PARTS.has(part)
/** Beats whose figure is a tap-to-descend tree. */
export const isDescendPart = (part: TreesPart): boolean => DESCEND_PARTS.has(part)
export const isSequencePart = (part: TreesPart): boolean => SEQUENCE_PARTS.has(part)
/** Ghost slots only matter where falling off is the answer or a wrong commit. */
const allowsGhost = (part: TreesPart): boolean => isDescendPart(part) && part !== "demo"

export function binOf(part: TreesPart): TreesBin | null {
  switch (part) {
    case "find-hit":
    case "find-miss":
    case "insert":
    case "realworld":
      return "locate"
    case "sequence-a":
    case "sequence-b":
      return "sequence"
    case "compare-shape":
    case "contrast-list":
      return "comparison"
    default:
      return null
  }
}

/* ------------------------------ question makers ------------------------------ */

const BASE = {
  target: null as number | null,
  descend: null as DescendResult | null,
  insertAt: null as { parentId: string; side: Side } | null,
  order: [] as string[],
  options: [] as TreesOption[],
  answer: "",
  stick: null as TreeNode | null,
  chain: null as number[] | null,
  chainTargetIndex: -1,
  cost: null as TreesCost | null,
  altCost: null as TreesCost | null,
  realWorld: false,
  hint: "",
  nudge: "",
  correct: "",
  why: "",
}

function makeIntro(part: "demo" | "teach-descend" | "teach-inorder"): TreesQuestion {
  if (part === "demo") {
    return {
      ...BASE,
      kind: part,
      bin: null,
      mode: "descend",
      tree: T_BAL,
      title: "Tap to descend",
      prompt: "Tap a child to step down. Watch the half you skip drop away.",
    }
  }
  if (part === "teach-descend") {
    return {
      ...BASE,
      kind: part,
      bin: null,
      mode: "intro",
      tree: T_BAL,
      title: "Compare, then drop a half",
      prompt: "Smaller? go left. Larger? go right. Either way, the half you didn't pick is gone.",
    }
  }
  return {
    ...BASE,
    kind: part,
    bin: null,
    mode: "intro",
    tree: T_BAL,
    title: "Left, node, right",
    prompt: "Visit the left subtree, then the node, then the right subtree. It comes out sorted.",
    order: inorder(T_BAL),
  }
}

function makeDescend(part: "find-hit" | "find-miss" | "insert" | "realworld"): TreesQuestion {
  const tree = T_BAL
  if (part === "find-hit") {
    const target = 10
    const d = descendPath(tree, target)
    return {
      ...BASE,
      kind: part,
      bin: "locate",
      mode: "descend",
      tree,
      title: "Find a value",
      target,
      descend: d,
      cost: comparisonsCost(d.comparisons),
      prompt: "Does 10 exist? Tap the path down to it.",
      hint: "Compare at each node: go left if 10 is smaller, right if larger.",
      nudge: "Compare 10 with the node, then step toward it. Don't skip around.",
      correct: "Found 10 in 3 comparisons. Each step dropped half the tree.",
      why: "8 → 12 → 10: at each node you compare and discard the side that can't hold 10. Three steps, even if the tree were huge.",
    }
  }
  if (part === "find-miss") {
    const target = 7
    const d = descendPath(tree, target)
    return {
      ...BASE,
      kind: part,
      bin: "locate",
      mode: "descend",
      tree,
      title: "Find a value",
      target,
      descend: d,
      cost: comparisonsCost(d.comparisons),
      prompt: "Does 7 exist? Tap the path. Then the empty slot where it would be.",
      hint: "Descend as if 7 were there; if you run off the tree, it's absent.",
      nudge: "Keep comparing. If the child you need is empty, 7 isn't here.",
      correct: "7 would sit right of 6, but that slot is empty, 7 is absent.",
      why: "8 → 4 → 6: 7 > 6 needs a right child, but there is none. The empty slot is the proof 7 isn't in the tree.",
    }
  }
  if (part === "insert") {
    const target = 5
    const d = descendPath(tree, target)
    return {
      ...BASE,
      kind: part,
      bin: "locate",
      mode: "descend",
      tree,
      title: "Where would it go?",
      target,
      descend: d,
      insertAt: insertSlot(tree, target),
      cost: comparisonsCost(d.comparisons),
      prompt: "Where would 5 attach? Descend to the empty slot and tap it.",
      hint: "The search IS the insert: descend until the child you need is empty.",
      nudge: "Compare 5 at each node and step down; tap the empty slot it lands in.",
      correct: "5 attaches left of 6. The slot the search falls into.",
      why: "8 → 4 → 6: 5 < 6 needs a left child, which is empty. That empty slot is exactly where 5 belongs.",
    }
  }
  // realworld: the "guess my number" game show. Target 6 takes a MIXED path
  // (lower to 4, then higher to 6), so the host says both "Lower!" and "Higher!".
  const target = 6
  const d = descendPath(tree, target)
  return {
    ...BASE,
    kind: part,
    bin: "locate",
    mode: "descend",
    tree,
    title: "Guess my number",
    target,
    descend: d,
    realWorld: true,
    cost: comparisonsCost(d.comparisons),
    prompt: "I'm thinking of a number from 2 to 14. Each guess tells you higher or lower.",
    hint: "Use the clue: lower means the secret sits below your guess, higher means above. Each guess halves the range.",
    nudge: "Follow the clue: if it says lower, guess lower; if it says higher, guess higher.",
    correct: "Lower then higher pins it to 6 in three guesses, halving the range each time.",
    why: "Higher or lower is just a BST descend: 8 → 4 → 6, halving the range at every guess. That's why guessing games end so fast.",
  }
}

function makeSequence(part: "sequence-a" | "sequence-b"): TreesQuestion {
  const tree = part === "sequence-a" ? T_BAL : T_ZIG
  const keys = inorderKeys(tree)
  const shared = {
    ...BASE,
    kind: part,
    bin: "sequence" as const,
    mode: "sequence" as const,
    tree,
    title: "Tap in order",
    order: inorder(tree),
  }
  if (part === "sequence-a") {
    return {
      ...shared,
      prompt: "Tap every node in in-order order: left subtree, node, right subtree.",
      hint: "Go as far left as you can, visit, then go right. Don't read the picture left-to-right.",
      nudge: "Apply left → node → right. The picture isn't laid out in sorted order.",
      correct: "That's the in-order traversal. It comes out sorted.",
      why: `Left → node → right recovers the sorted order: ${keys.join(", ")}. The order isn't stored in the layout; the rule recovers it.`,
    }
  }
  return {
    ...shared,
    prompt: "Same rule, new shape: tap the nodes in in-order order.",
    hint: "Left subtree first (all the way down) then the node, then right.",
    nudge: "Run left → node → right; the pixels aren't in sorted order.",
    correct: `In-order again gives sorted: ${keys.join(", ")}.`,
    why: `However the tree is drawn, left → node → right yields the sorted keys: ${keys.join(", ")}.`,
  }
}

function makeCompare(seed: number): { question: TreesQuestion; next: number } {
  const balanced = T_BAL
  const stick = T_STICK
  const probe = 14
  const balCost = comparisonsCost(descendPath(balanced, probe).comparisons)
  const stickCost = scalesCost(descendPath(stick, probe).comparisons, "comparisons")
  const sh = shuffle(
    [
      {
        id: "same-order-diff-cost",
        label: "Same keys, same in-order order, but the stick walks and the balanced tree halves",
      },
      { id: "same-structure", label: "They're the same structure" },
      { id: "diff-sets", label: "They hold different sets of keys" },
    ],
    seed,
  )
  return {
    question: {
      ...BASE,
      kind: "compare-shape",
      bin: "comparison",
      mode: "mcq",
      tree: balanced,
      stick,
      title: "Same keys, two shapes",
      target: probe,
      options: sh.result,
      answer: "same-order-diff-cost",
      cost: balCost,
      altCost: stickCost,
      prompt: "Both trees were built from the same keys. Which is true?",
      hint: "Run in-order on each, then picture finding a value in both.",
      nudge: "Same keys and same sorted order, but does the stick halve, or walk?",
      correct: "Same set, same in-order order, but the stick walks while the balanced tree halves.",
      why: "Both give 2, 4, 6, 8, 10, 12, 14 in-order, so same keys and same sorted output. But the stick is a linked list in disguise: finding 14 walks all 7, while the balanced tree finds it in 3.",
    },
    next: sh.next,
  }
}

function makeContrast(): TreesQuestion {
  const tree = T_BAL
  const target = 14
  const d = descendPath(tree, target)
  const chain = inorderKeys(tree)
  const chainTargetIndex = chain.indexOf(target)
  return {
    ...BASE,
    kind: "contrast-list",
    bin: "comparison",
    mode: "contrast",
    tree,
    title: "List vs tree",
    target,
    descend: d,
    chain,
    chainTargetIndex,
    cost: comparisonsCost(d.comparisons),
    altCost: scalesCost(chainTargetIndex + 1, chainTargetIndex + 1 === 1 ? "hop" : "hops"),
    prompt: "Find 14. First walk the sorted list, then descend the tree.",
    hint: "Walk the list hop by hop, then descend the tree by comparing.",
    nudge: "Finish the walk to the value, then descend the tree to it.",
    correct: "The list walks 7 hops; the tree finds 14 in 3 comparisons.",
    why: "A sorted linked list has no branches. You walk every node (7 hops). The balanced BST drops half each step, finding 14 in 3. Branching is the whole difference.",
  }
}

function buildQuestion(part: TreesPart, seed: number): { question: TreesQuestion; next: number } {
  if (part === "demo" || part === "teach-descend" || part === "teach-inorder") {
    return { question: makeIntro(part), next: seed }
  }
  if (part === "find-hit" || part === "find-miss" || part === "insert" || part === "realworld") {
    return { question: makeDescend(part), next: seed }
  }
  if (part === "sequence-a" || part === "sequence-b") {
    return { question: makeSequence(part), next: seed }
  }
  if (part === "compare-shape") return makeCompare(seed)
  return { question: makeContrast(), next: seed }
}

/* ------------------------------- construction ------------------------------- */

const FRESH = {
  selected: null,
  wrongCount: 0,
  feedback: "idle" as Feedback,
  revealed: false,
  showWhy: false,
}

function enterPart(state: TreesState, index: number): TreesState {
  const part = TREES_PARTS[index]
  const { question, next } = buildQuestion(part, state.rngState)
  return {
    ...state,
    partIndex: index,
    rngState: next,
    question,
    ...FRESH,
    tappedPath: isDescendPart(part) ? [question.tree.id] : [],
    tappedSlot: null,
    tappedOrder: [],
    chainCursor: 0,
  }
}

export function createTrees(seed: number = Date.now()): TreesState {
  const init: TreesState = {
    seed,
    rngState: seed,
    partIndex: 0,
    locateCorrect: 0,
    sequenceCorrect: 0,
    comparisonCorrect: 0,
    attempts: 0,
    question: null,
    tappedPath: [],
    tappedSlot: null,
    tappedOrder: [],
    chainCursor: 0,
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

export function currentPartTrees(state: TreesState): TreesPart {
  return TREES_PARTS[state.partIndex]
}

/** A verdict is terminal once correct or failed: the question locks. */
export function isTerminalTrees(state: TreesState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledPartsTrees(state: TreesState): number {
  return state.completed ? TREES_TOTAL_PARTS : state.partIndex
}

function binProgress(state: TreesState, bin: TreesBin): { done: number; total: number } {
  if (bin === "locate") return { done: state.locateCorrect, total: LOCATE_QUOTA }
  if (bin === "sequence") return { done: state.sequenceCorrect, total: SEQUENCE_QUOTA }
  return { done: state.comparisonCorrect, total: COMPARISON_QUOTA }
}

/** "n / total" header for a graded beat (cumulative within its bin). */
export function partQuotaTrees(state: TreesState): { done: number; total: number } | null {
  const bin = binOf(currentPartTrees(state))
  return bin ? binProgress(state, bin) : null
}

/** The descend cursor: the last node the learner has stepped to. */
export function cursorNode(state: TreesState): TreeNode | null {
  const q = state.question
  if (!q || state.tappedPath.length === 0) return null
  return nodeById(q.tree, state.tappedPath[state.tappedPath.length - 1])
}

/**
 * What the learner can tap from the current descend cursor: each existing child,
 * plus a dashed ghost slot for every empty side (only where falling off is a
 * legal commit, and never once they've landed on the target). The "no jumping"
 * rule: only the current node's two children are reachable.
 */
export function tappableChildren(state: TreesState): {
  left: boolean
  right: boolean
  ghostSides: Side[]
} {
  const q = state.question
  const cursor = cursorNode(state)
  if (!q || !cursor || !isDescendPart(currentPartTrees(state))) {
    return { left: false, right: false, ghostSides: [] }
  }
  const left = cursor.left != null
  const right = cursor.right != null
  const ghostSides: Side[] = []
  const atTarget = q.target != null && cursor.key === q.target
  if (allowsGhost(currentPartTrees(state)) && !atTarget) {
    if (!left) ghostSides.push("left")
    if (!right) ghostSides.push("right")
  }
  return { left, right, ghostSides }
}

/**
 * Node ids dropped (the opposite subtree discarded at each step) along an
 * arbitrary descend path. Pure over (tree, pathIds) so the post-correct contrast
 * race can grey the discarded subtrees of any path prefix, not only the live
 * working state.
 */
export function droppedAlongPath(tree: TreeNode | null, pathIds: string[]): Set<string> {
  const out = new Set<string>()
  if (!tree) return out
  for (let i = 0; i < pathIds.length - 1; i++) {
    const parent = nodeById(tree, pathIds[i])
    const childId = pathIds[i + 1]
    if (!parent) continue
    const opp =
      parent.left?.id === childId ? parent.right : parent.right?.id === childId ? parent.left : null
    if (opp) collectIds(opp, out)
  }
  return out
}

/** Node ids dropped (opposite subtrees) along the descend so far: dimmed + SR. */
export function droppedNodeIds(state: TreesState): Set<string> {
  return state.question ? droppedAlongPath(state.question.tree, state.tappedPath) : new Set<string>()
}

/**
 * How many nodes are still in play: the size of the cursor's subtree (every node
 * the target could still be hiding in). Each comparison discards the opposite
 * subtree, so this halves cleanly (7 -> 3 -> 1 on the balanced tree). Zero once
 * the search has fallen into an empty slot (the value is absent / placed). Drives
 * both the HalvingMeter and the SR descend line, so the two always agree.
 */
export function candidatesRemaining(state: TreesState): number {
  if (state.tappedSlot != null) return 0
  return subtreeSize(cursorNode(state))
}

/**
 * The single correct next descend step (child or ghost), recomputed from the
 * pure path. Drives the DEV `data-answer` hook so the tracer can walk it.
 */
export function correctNextStep(
  state: TreesState,
): { kind: "node"; id: string } | { kind: "ghost"; side: Side } | null {
  const q = state.question
  if (!q || !q.descend) return null
  const d = q.descend
  if (state.tappedPath.length < d.path.length) {
    return { kind: "node", id: d.path[state.tappedPath.length] }
  }
  if (d.found) return null // already on the target. Just Check
  if (d.missingSide) return { kind: "ghost", side: d.missingSide }
  return null
}

/** The chain (T5) walk is complete once the cursor has reached the target. */
export function chainWalkDone(state: TreesState): boolean {
  const q = state.question
  if (!q || q.chainTargetIndex < 0) return false
  return state.chainCursor >= q.chainTargetIndex
}

function descendTerminal(state: TreesState): boolean {
  const q = state.question
  if (!q) return false
  if (state.tappedSlot != null) return true
  const cursor = cursorNode(state)
  return cursor != null && q.target != null && cursor.key === q.target
}

/** Can the learner press Check? Per-mechanic terminal-ready gate. */
export function canCheckTrees(state: TreesState): boolean {
  const part = currentPartTrees(state)
  const q = state.question
  if (!q) return false
  if (part === "compare-shape") return state.selected != null
  if (isSequencePart(part)) return state.tappedOrder.length === q.order.length
  if (part === "contrast-list") return chainWalkDone(state) && descendTerminal(state)
  if (part === "find-miss" || part === "insert") return state.tappedSlot != null
  if (part === "find-hit" || part === "realworld") return descendTerminal(state)
  return false
}

/** The hard mastery gate: Locate 4 + Sequence 2 + Comparison 2 = 8. */
export function isCompleteTrees(state: TreesState): boolean {
  return (
    state.locateCorrect >= LOCATE_QUOTA &&
    state.sequenceCorrect >= SEQUENCE_QUOTA &&
    state.comparisonCorrect >= COMPARISON_QUOTA
  )
}

export function hasProgressTrees(state: TreesState): boolean {
  return (
    state.partIndex > 0 ||
    state.locateCorrect > 0 ||
    state.sequenceCorrect > 0 ||
    state.comparisonCorrect > 0
  )
}

/* --------------------------------- grading --------------------------------- */

const arraysEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

function isCorrect(state: TreesState): boolean {
  const part = currentPartTrees(state)
  const q = state.question
  if (!q) return false
  switch (part) {
    case "find-hit":
    case "realworld":
    case "contrast-list":
      return (
        q.descend != null &&
        q.descend.found &&
        state.tappedSlot == null &&
        arraysEqual(state.tappedPath, q.descend.path)
      )
    case "find-miss":
      return (
        q.descend != null &&
        !q.descend.found &&
        state.tappedSlot != null &&
        state.tappedSlot.parentId === q.descend.missingParentId &&
        state.tappedSlot.side === q.descend.missingSide &&
        arraysEqual(state.tappedPath, q.descend.path)
      )
    case "insert":
      return (
        q.insertAt != null &&
        q.descend != null &&
        state.tappedSlot != null &&
        state.tappedSlot.parentId === q.insertAt.parentId &&
        state.tappedSlot.side === q.insertAt.side &&
        arraysEqual(state.tappedPath, q.descend.path)
      )
    case "sequence-a":
    case "sequence-b":
      return arraysEqual(state.tappedOrder, q.order)
    case "compare-shape":
      return state.selected === q.answer
    default:
      return false
  }
}

function bumpBin(state: TreesState, bin: TreesBin): void {
  if (bin === "locate") state.locateCorrect = Math.min(LOCATE_QUOTA, state.locateCorrect + 1)
  else if (bin === "sequence")
    state.sequenceCorrect = Math.min(SEQUENCE_QUOTA, state.sequenceCorrect + 1)
  else state.comparisonCorrect = Math.min(COMPARISON_QUOTA, state.comparisonCorrect + 1)
}

/* --------------------------------- reducer --------------------------------- */

export function treesReducer(state: TreesState, action: LessonAction): TreesState {
  const part = currentPartTrees(state)
  const q = state.question

  switch (action.type) {
    case "continue": {
      if (!isContinuePart(part)) return state
      if (state.partIndex >= TREES_TOTAL_PARTS - 1) return state
      return enterPart(state, state.partIndex + 1)
    }

    case "select": {
      if (!q || isTerminalTrees(state)) return state
      const letter = action.letter

      if (part === "compare-shape") {
        return { ...state, selected: letter, feedback: "idle" }
      }

      if (isSequencePart(part)) {
        if (!q.order.includes(letter) || state.tappedOrder.includes(letter)) return state
        return { ...state, tappedOrder: [...state.tappedOrder, letter], feedback: "idle" }
      }

      if (isDescendPart(part)) {
        // T5 felt pre-walk: advance the sorted-list cursor one hop.
        if (letter === "chain") {
          if (q.chainTargetIndex < 0) return state
          return {
            ...state,
            chainCursor: Math.min(q.chainTargetIndex, state.chainCursor + 1),
            feedback: "idle",
          }
        }
        // Ghost-slot tap (miss / insert / wrong commit): "it falls here".
        if (letter === "ghost:left" || letter === "ghost:right") {
          const side: Side = letter === "ghost:left" ? "left" : "right"
          const { ghostSides } = tappableChildren(state)
          const cursor = cursorNode(state)
          if (!cursor || !ghostSides.includes(side)) return state
          return { ...state, tappedSlot: { parentId: cursor.id, side }, feedback: "idle" }
        }
        // Child tap: only the cursor's own children are reachable (no jumping).
        const cursor = cursorNode(state)
        if (!cursor) return state
        if (cursor.left?.id === letter || cursor.right?.id === letter) {
          return {
            ...state,
            tappedPath: [...state.tappedPath, letter],
            tappedSlot: null,
            feedback: "idle",
          }
        }
        return state
      }
      return state
    }

    case "check": {
      if (!q || isTerminalTrees(state)) return state
      const bin = binOf(part)
      if (!bin || !canCheckTrees(state)) return state
      const v = gradeAnswer(state, isCorrect(state))
      const next: TreesState = {
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
      // A fresh instance: reset the working state (and re-shuffle MCQ options).
      const { question, next } = buildQuestion(part, state.rngState)
      return {
        ...state,
        ...FRESH,
        question,
        rngState: next,
        tappedPath: isDescendPart(part) ? [question.tree.id] : [],
        tappedSlot: null,
        tappedOrder: [],
        chainCursor: 0,
      }
    }

    case "next": {
      if (state.feedback !== "correct") return state
      if (state.partIndex >= TREES_TOTAL_PARTS - 1) {
        return { ...state, ...FRESH, completed: true }
      }
      return enterPart(state, state.partIndex + 1)
    }

    default:
      return state
  }
}

/* ----------------------------- resume / progress ----------------------------- */

export function toProgressTrees(s: TreesState): LessonProgress {
  return {
    counters: {
      locate: s.locateCorrect,
      sequence: s.sequenceCorrect,
      comparison: s.comparisonCorrect,
      attempts: s.attempts,
    },
    currentPart: currentPartTrees(s),
    completed: s.completed || isCompleteTrees(s),
  }
}

function clampT(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), max)
}

export function resumeTrees(progress: LessonProgress, seed: number = Date.now()): TreesState {
  const base = createTrees(seed)
  const c = progress.counters
  const seeded: TreesState = {
    ...base,
    locateCorrect: clampT(c.locate ?? 0, LOCATE_QUOTA),
    sequenceCorrect: clampT(c.sequence ?? 0, SEQUENCE_QUOTA),
    comparisonCorrect: clampT(c.comparison ?? 0, COMPARISON_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, TREES_PARTS.indexOf(progress.currentPart as TreesPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
