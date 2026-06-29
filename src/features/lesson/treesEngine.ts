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
 * right), not *stored* in a row. Three faces (descend / locate, build / grow,
 * and in-order / sequence) plus a comparison synthesis (same keys → same sorted
 * output → different shape → different cost) kill the "a BST is just a sorted
 * list" misconception.
 *
 * Sixteen beats, twelve graded behind the until-correct wall, aggregated into a
 * 5/3/2/2 gate across four bins (Locate / Sequence / Build / Comparison). The
 * Build bin is the synthesis: the learner grows a BST by descending each key in
 * a sequence to its empty `insertSlot` and dropping it in (a watched build
 * teaches it first, ungraded). Reuses the shared feedback machine + flame
 * (`gradeAnswer`) and the same LessonProgress shape; only the tree model,
 * verdicts, and quotas are Trees-specific. Layout is hand-rolled and
 * PRESENTATIONAL. Every verdict here is a pure function of the given tree
 * (`descendPath` / `insertSlot` / `inorder`), never of pixels. Tap only: no
 * drag, no heavy layout lib. The build + bigger trees are seeded-deterministic:
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
  "find-hit", // 3  descend-find (hit)                          Locate ✓
  "find-miss", // 4  descend-find (falls off / absent)            Locate ✓
  "insert", // 5  descend-insert (tap the ghost slot)           Locate ✓
  "watched-build", // 6  teach: watch a BST built from scratch, key by key
  "build-bst-1", // 7  grow a BST: descend + drop each key          Build ✓
  "build-bst-2", // 8  grow a second BST, different keys/shape      Build ✓
  "find-big", // 9  descend a large/varied tree (deep path)      Locate ✓
  "teach-inorder", // 10 teach: left subtree → node → right subtree
  "sequence-a", // 11 in-order tap, frontier-gated (tree #1)        Sequence ✓
  "sequence-b", // 12 in-order tap, frontier-gated (zigzag)         Sequence ✓
  "sequence-c", // 13 in-order tap, frontier-gated (larger shape)   Sequence ✓
  "realworld", // 14 bracket skin: higher/lower seed search        Locate ✓
  "compare-shape", // 15 same keys, two shapes (de-cued MCQ)          Comparison ✓
  "contrast-list", // 16 sorted list walk vs BST descend             Comparison ✓
] as const
export type TreesPart = (typeof TREES_PARTS)[number]
export const TREES_TOTAL_PARTS = TREES_PARTS.length

export const LOCATE_QUOTA = 5
export const SEQUENCE_QUOTA = 3
export const BUILD_QUOTA = 2
export const COMPARISON_QUOTA = 2

export type TreesBin = "locate" | "sequence" | "build" | "comparison"
export type TreesMode = "intro" | "descend" | "build" | "sequence" | "mcq" | "contrast"
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

/** A node's stable tap id, derived from its (distinct) key, for generated trees. */
export const nodeIdFor = (key: number): string => `n${key}`

/** A fresh leaf node for `key` (used when growing a tree by insertion). */
const leafNode = (key: number): TreeNode => ({ id: nodeIdFor(key), key, left: null, right: null })

/**
 * Insert `key` into a BST, returning a NEW tree (pure, no mutation). The key
 * descends by compare and attaches at the unique empty slot the search falls
 * into, exactly the slot `insertSlot` reports. `key` must be absent (distinct
 * keys), so the recursion always lands on a `null` child. This is the primitive
 * the build-the-BST arc grows the tree with.
 */
export function insertBstKey(node: TreeNode, key: number): TreeNode {
  if (key < node.key) {
    return { ...node, left: node.left ? insertBstKey(node.left, key) : leafNode(key) }
  }
  return { ...node, right: node.right ? insertBstKey(node.right, key) : leafNode(key) }
}

/**
 * Build a BST by inserting `keys` left to right (the canonical "grow it key by
 * key"). The result is the unique tree those insertions produce; the watched
 * build animates it and the graded builds are checked against it.
 */
export function buildBstFromKeys(keys: number[]): TreeNode {
  let tree = leafNode(keys[0])
  for (let i = 1; i < keys.length; i++) tree = insertBstKey(tree, keys[i])
  return tree
}

/**
 * A balanced BST over already-sorted distinct `keys`: the median is the root and
 * each half recurses, so the height is minimal (`⌈log2(n+1)⌉ − 1`). This is how
 * the bigger `find-big` tree is shaped, so the descend halves cleanly and the
 * "halving pays off" payoff actually shows on screen.
 */
export function balancedBst(sortedKeys: number[]): TreeNode | null {
  if (sortedKeys.length === 0) return null
  const mid = sortedKeys.length >> 1
  return {
    id: nodeIdFor(sortedKeys[mid]),
    key: sortedKeys[mid],
    left: balancedBst(sortedKeys.slice(0, mid)),
    right: balancedBst(sortedKeys.slice(mid + 1)),
  }
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

/**
 * `T_SEQ_C` (keys 1·2·3·4·5·6·7·8·9): the third, larger sequence shape, distinct
 * from `T_BAL` and `T_ZIG`. Nine single-digit keys in an asymmetric BST so the
 * compact non-monotonic draw can't be read left-to-right. inorder = 1..9. Used
 * only by `sequence-c` (the new Sequence rep).
 */
export const T_SEQ_C: TreeNode = {
  id: "n6",
  key: 6,
  left: {
    id: "n3",
    key: 3,
    left: { id: "n1", key: 1, left: null, right: { id: "n2", key: 2, left: null, right: null } },
    right: { id: "n5", key: 5, left: { id: "n4", key: 4, left: null, right: null }, right: null },
  },
  right: {
    id: "n8",
    key: 8,
    left: { id: "n7", key: 7, left: null, right: null },
    right: { id: "n9", key: 9, left: null, right: null },
  },
}

/* ----------------------- build-the-BST (grow it, active) ---------------------- */

/**
 * The live state of an active "build a BST" beat, where the learner grows the
 * tree by inserting a fixed sequence of keys, descending each to its empty slot
 * and dropping it in. It pairs the tree built so far with a cursor (`path`) into
 * the descend for the key currently being placed. The first key is the root
 * (auto-placed when the beat opens), so every learner-facing action is a real
 * descend-and-drop. Pure: `bstBuildTap` returns a fresh beat; a wrong proposal
 * is rejected and the beat returned untouched. It is the BST analog of the Heaps
 * build-a-heap (one graded slot, many guided steps). The resulting tree is the
 * unique `buildBstFromKeys(keys)`, so completing the build is exactly building
 * the right tree, no separate verdict needed.
 */
export interface BstBuildBeat {
  /** The full insert sequence, fixed when the beat opens. */
  keys: number[]
  /** How many of `keys` are fully placed (>= 1 after open: the root is auto-placed). */
  placed: number
  /** The BST grown from the first `placed` keys (never null after open). */
  tree: TreeNode
  /** The live descend for `keys[placed]`: ids root..cursor, or [] once every key is placed. */
  path: string[]
}

/** Open a build beat for an insert sequence: drop the first key as the root, then descend the rest. */
export function bstBuildFromKeys(keys: number[]): BstBuildBeat {
  const tree = leafNode(keys[0])
  return { keys: keys.slice(), placed: 1, tree, path: keys.length > 1 ? [tree.id] : [] }
}

/** The key currently being placed (`keys[placed]`), or null once the build is solved. */
export function bstBuildCurrentKey(beat: BstBuildBeat): number | null {
  return beat.placed < beat.keys.length ? beat.keys[beat.placed] : null
}

/** The descend cursor for the current key: the last node the learner has stepped to. */
export function bstBuildCursor(beat: BstBuildBeat): TreeNode | null {
  if (beat.path.length === 0) return null
  return nodeById(beat.tree, beat.path[beat.path.length - 1])
}

/**
 * The single correct next action for the current key: step to a child, or drop
 * it into the empty slot the search falls into. Pure over (tree, path, key) via
 * `descendPath`; null once the build is solved. Drives both the validator and
 * the DEV `data-answer` hook.
 */
export function bstBuildNextStep(
  beat: BstBuildBeat,
): { kind: "node"; id: string } | { kind: "ghost"; side: Side } | null {
  const key = bstBuildCurrentKey(beat)
  if (key == null) return null
  const d = descendPath(beat.tree, key)
  if (beat.path.length < d.path.length) {
    return { kind: "node", id: d.path[beat.path.length] }
  }
  return d.missingSide ? { kind: "ghost", side: d.missingSide } : null
}

/**
 * Validate a learner action against the current key's descend. A `letter` is a
 * child node id (step down) or `"ghost:left"` / `"ghost:right"` (drop into the
 * empty slot). A correct step advances the cursor; a correct drop inserts the
 * key, commits it, and opens the next key's descend at the root (`placedKey:
 * true`); a wrong proposal is rejected and the SAME beat returned. Never mutates.
 */
export function bstBuildTap(
  beat: BstBuildBeat,
  letter: string,
): { beat: BstBuildBeat; accepted: boolean; placedKey: boolean } {
  const step = bstBuildNextStep(beat)
  if (!step) return { beat, accepted: false, placedKey: false }
  if (step.kind === "node" && letter === step.id) {
    return { beat: { ...beat, path: [...beat.path, letter] }, accepted: true, placedKey: false }
  }
  if (step.kind === "ghost" && letter === `ghost:${step.side}`) {
    const key = bstBuildCurrentKey(beat) as number
    const tree = insertBstKey(beat.tree, key)
    const placed = beat.placed + 1
    const done = placed >= beat.keys.length
    return {
      beat: { keys: beat.keys, placed, tree, path: done ? [] : [tree.id] },
      accepted: true,
      placedKey: true,
    }
  }
  return { beat, accepted: false, placedKey: false }
}

/** The build is solved once every key in the sequence is placed. */
export function isBstBuildSolved(beat: BstBuildBeat): boolean {
  return beat.placed >= beat.keys.length
}

/* -------------------- watched-build frames (teach, end to end) ----------------- */

/** One frame of a from-scratch build replay: the tree so far, the descend lit, the new node. */
export interface BuildFrame {
  /** The tree after this frame's key has attached. */
  tree: TreeNode
  /** The descend path lit for this frame (root..parent plus the new node). */
  highlightIds: string[]
  /** The id of the node placed in this frame (the one that just appeared). */
  newId: string
  /** The key placed in this frame. */
  key: number
  /** A reading caption for the comparison this frame made. */
  caption: string
}

/**
 * Expand a from-scratch build (`keys`, inserted in order) into the ordered frames
 * a `FrameSequence` can auto-play end to end. Frame 0 is the root; each later
 * frame lights the descend the next key took and shows it attached, so the tree
 * visibly grows key by key. Pure view over `descendPath` / `buildBstFromKeys`; it
 * never mutates the inputs and never feeds grading.
 */
export function watchedBuildFrames(keys: number[]): BuildFrame[] {
  const frames: BuildFrame[] = []
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const tree = buildBstFromKeys(keys.slice(0, i + 1))
    const newId = nodeIdFor(key)
    if (i === 0) {
      frames.push({ tree, highlightIds: [newId], newId, key, caption: `${key} starts the tree as the root.` })
      continue
    }
    const before = buildBstFromKeys(keys.slice(0, i))
    const d = descendPath(before, key)
    const parent = d.missingParentId ? nodeById(before, d.missingParentId) : null
    const side = d.missingSide ?? "left"
    const caption = parent
      ? `${key} ${key < parent.key ? "is less than" : "is greater than"} ${parent.key}, so it attaches ${side}.`
      : `${key} attaches.`
    frames.push({ tree, highlightIds: [...d.path, newId], newId, key, caption })
  }
  return frames
}

/* ----------------------- generated bigger trees (variety) --------------------- */

/** Tuning for the seeded `find-big` tree: node count, key range, and the minimum descend depth. */
export interface BigTreeConfig {
  /** Node count. Big enough to feel the halving, small enough to fit a phone (gallery-tunable). */
  size: number
  /** Inclusive [min, max] for the distinct integer keys. */
  value: [number, number]
  /** Minimum descend path length (comparisons) the chosen target must take. */
  minDepth: number
}

/**
 * The tuned default `find-big` tree: thirteen distinct keys, balanced, with a
 * target at least four comparisons deep, so the search visibly halves
 * 13 → 6 → 3 → 1. Sized to feel large but stay legible on a phone.
 */
export const FIND_BIG_GEN: BigTreeConfig = { size: 13, value: [2, 99], minDepth: 4 }

/**
 * A seeded, deterministic balanced BST plus a present target whose descend is at
 * least `config.minDepth` comparisons deep. Same seed always yields the same
 * tree + target; every instance is a valid BST (in-order sorted) with distinct
 * keys, and the target sits on a deep path so the halving pays off. The fallback
 * (the deepest leaf) guarantees a target for any size. Pure.
 */
export function generateBigTree(
  seed: number,
  config: BigTreeConfig = FIND_BIG_GEN,
): { tree: TreeNode; target: number } {
  const [lo, hi] = config.value
  const picked = pickValues(config.size, lo, hi, seed)
  const sorted = picked.values.slice().sort((a, b) => a - b)
  const tree = balancedBst(sorted) as TreeNode
  const deep = sorted.filter((k) => descendPath(tree, k).path.length >= config.minDepth)
  const r = rngNext(picked.next)
  const target =
    deep.length > 0
      ? deep[Math.floor(r.value * deep.length)]
      : sorted.reduce((best, k) =>
          descendPath(tree, k).path.length > descendPath(tree, best).path.length ? k : best,
        )
  return { tree, target }
}

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
  /** The insert sequence the learner grows the tree from (build beats); null otherwise. */
  buildKeys: number[] | null
  options: TreesOption[]
  answer: string
  /** Degenerate same-keys tree (compare-shape). */
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
  locateCorrect: number // 0..5
  sequenceCorrect: number // 0..3
  buildCorrect: number // 0..2
  comparisonCorrect: number // 0..2
  attempts: number
  question: TreesQuestion | null
  /** Descend working state: starts [root.id]; child taps append. Transient. */
  tappedPath: string[]
  /** Ghost terminal (miss / insert). Transient. */
  tappedSlot: { parentId: string; side: Side } | null
  /**
   * The live build-the-BST beat (the key sequence + the tree so far + the current
   * key's descend). Null on every other beat. Working state only, rebuilt by
   * `enterPart` / `resume` from the curated question, never persisted.
   */
  build: BstBuildBeat | null
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

/** Pick `count` distinct integers from `[lo, hi]` in a seeded order (a shuffled slice). */
function pickValues(
  count: number,
  lo: number,
  hi: number,
  seed: number,
): { values: number[]; next: number } {
  const pool: number[] = []
  for (let v = lo; v <= hi; v++) pool.push(v)
  const { result, next } = shuffle(pool, seed)
  return { values: result.slice(0, count), next }
}

/* ------------------------------ part predicates ------------------------------ */

const CONTINUE_PARTS: ReadonlySet<TreesPart> = new Set([
  "demo",
  "teach-descend",
  "watched-build",
  "teach-inorder",
])
const DESCEND_PARTS: ReadonlySet<TreesPart> = new Set([
  "demo",
  "find-hit",
  "find-miss",
  "insert",
  "find-big",
  "realworld",
  "contrast-list",
])
const BUILD_PARTS: ReadonlySet<TreesPart> = new Set(["build-bst-1", "build-bst-2"])
const SEQUENCE_PARTS: ReadonlySet<TreesPart> = new Set(["sequence-a", "sequence-b", "sequence-c"])

/** Beats advanced by Continue (no grading). */
export const isContinuePart = (part: TreesPart): boolean => CONTINUE_PARTS.has(part)
/** Beats whose figure is a tap-to-descend tree. */
export const isDescendPart = (part: TreesPart): boolean => DESCEND_PARTS.has(part)
/** Beats where the learner grows a BST by descending + dropping each key. */
export const isBuildPart = (part: TreesPart): boolean => BUILD_PARTS.has(part)
export const isSequencePart = (part: TreesPart): boolean => SEQUENCE_PARTS.has(part)
/** Ghost slots only matter where falling off is the answer or a wrong commit. */
const allowsGhost = (part: TreesPart): boolean => isDescendPart(part) && part !== "demo"

export function binOf(part: TreesPart): TreesBin | null {
  switch (part) {
    case "find-hit":
    case "find-miss":
    case "insert":
    case "find-big":
    case "realworld":
      return "locate"
    case "build-bst-1":
    case "build-bst-2":
      return "build"
    case "sequence-a":
    case "sequence-b":
    case "sequence-c":
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
  buildKeys: null as number[] | null,
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

/**
 * Curated insert sequences for the build-the-BST arc. The watched build grows the
 * canonical balanced tree (the one the learner just searched), so "this is how
 * that tree was made" lands; the two graded builds grow different shapes. Each
 * sequence's first key is the root (auto-placed), so the learner descends + drops
 * the rest. Keys are distinct and chosen so the trees read well on a phone.
 */
const WATCHED_BUILD_KEYS = [8, 4, 12, 2, 6, 10, 14] // grows T_BAL
const BUILD1_KEYS = [6, 4, 9, 2, 5, 8]
const BUILD2_KEYS = [10, 14, 7, 12, 5, 8]

/** Watch-it-built (teach, ungraded): a BST grown from scratch, key by key. */
function makeWatchedBuild(): TreesQuestion {
  const keys = WATCHED_BUILD_KEYS
  return {
    ...BASE,
    kind: "watched-build",
    bin: null,
    mode: "build",
    tree: buildBstFromKeys(keys),
    buildKeys: keys.slice(),
    title: "Watch a tree grow",
    prompt: "Each key drops in, compares down the tree, and attaches at the first empty slot.",
    cost: comparisonsCost(keys.length),
  }
}

/** Build-it-yourself (graded): grow a BST by descending + dropping each key. */
function makeBuild(part: "build-bst-1" | "build-bst-2"): TreesQuestion {
  const keys = part === "build-bst-1" ? BUILD1_KEYS : BUILD2_KEYS
  const result = buildBstFromKeys(keys)
  return {
    ...BASE,
    kind: part,
    bin: "build",
    mode: "build",
    tree: result,
    buildKeys: keys.slice(),
    title: "Grow the tree",
    prompt: "Insert each key by descending with comparisons, then dropping it in the empty slot it lands in.",
    hint: "",
    nudge: "Compare the incoming key at each node, step toward its side, then drop it in the empty slot.",
    correct: `You grew the tree, key by key. In-order it reads ${inorderKeys(result).join(", ")}.`,
    why: `Each key descended by compare and attached at the first empty slot, never reshuffling what was already placed. The shape comes from the insert order, and the in-order reading is always sorted as ${inorderKeys(
      result,
    ).join(", ")}.`,
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
      hint: "",
      nudge: "Compare 10 with the node, then step toward it. Don't skip around.",
      correct: "Found 10 in 3 comparisons. Each step dropped half the tree.",
      why: "The path is 8 → 12 → 10. At each node you compare and discard the side that can't hold 10. Three steps, even if the tree were huge.",
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
      hint: "",
      nudge: "Keep comparing. If the child you need is empty, 7 isn't here.",
      correct: "7 would sit right of 6, but that slot is empty, 7 is absent.",
      why: "The path is 8 → 4 → 6. Since 7 > 6 needs a right child and there is none, the empty slot proves 7 isn't in the tree.",
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
      hint: "",
      nudge: "Compare 5 at each node and step down; tap the empty slot it lands in.",
      correct: "5 attaches left of 6. The slot the search falls into.",
      why: "The path is 8 → 4 → 6. Since 5 < 6 needs a left child and that child is empty, the empty slot is exactly where 5 belongs.",
    }
  }
  // realworld: the tournament BRACKET. Target 6 takes a MIXED path (advance left
  // to 4, then right to 6), so the search swings both ways down the bracket.
  const target = 6
  const d = descendPath(tree, target)
  return {
    ...BASE,
    kind: part,
    bin: "locate",
    mode: "descend",
    tree,
    title: "Bracket buster",
    target,
    descend: d,
    realWorld: true,
    cost: comparisonsCost(d.comparisons),
    prompt: "Find the 6 seed. Each round, the half you skip is eliminated.",
      hint: "",
    nudge: "Compare the seed at each matchup, then advance toward it; do not jump around.",
    correct: "Found the 6 seed in three rounds, half the bracket eliminated each round.",
    why: "A bracket search is a BST descend through 8 → 4 → 6, halving the field every round. That is why even a huge bracket resolves in a few rounds.",
  }
}

/**
 * The bigger Locate rep (`find-big`): a generated balanced tree where the descend
 * runs deep, so the halving visibly pays off. Seeded so a reattempt yields a fresh
 * tree + target; the rng advances one step like the other generated beats.
 */
function makeFindBig(seed: number): { question: TreesQuestion; next: number } {
  const { tree, target } = generateBigTree(seed)
  const d = descendPath(tree, target)
  const next = rngNext(seed).next
  return {
    question: {
      ...BASE,
      kind: "find-big",
      bin: "locate",
      mode: "descend",
      tree,
      title: "Find it in a big tree",
      target,
      descend: d,
      cost: comparisonsCost(d.comparisons),
      prompt: `Find ${target} in this larger tree. Tap the path down to it.`,
      hint: "",
      nudge: `Compare ${target} at each node, then step toward its side. Don't skip around.`,
      correct: `Found ${target} in ${d.comparisons} comparisons, even in a tree this size.`,
      why: `Each compare dropped a whole subtree, so the search reached ${target} in ${d.comparisons} steps. Double the tree and that count barely moves: that is the halving paying off.`,
    },
    next,
  }
}

function makeSequence(part: "sequence-a" | "sequence-b" | "sequence-c"): TreesQuestion {
  const tree = part === "sequence-a" ? T_BAL : part === "sequence-b" ? T_ZIG : T_SEQ_C
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
      prompt: "Tap the nodes in order by visiting the left subtree, then the node, then the right subtree. Only the next one lights up.",
      hint: "",
      nudge: "Apply left → node → right. The picture isn't laid out in sorted order.",
      correct: "That's the in-order traversal. It comes out sorted.",
      why: `Left → node → right recovers the sorted order of ${keys.join(", ")}. The order isn't stored in the layout; the rule recovers it.`,
    }
  }
  if (part === "sequence-b") {
    return {
      ...shared,
      prompt: "Same rule, new shape. Tap the nodes in in-order order.",
      hint: "",
      nudge: "Run left → node → right; the pixels aren't in sorted order.",
      correct: `In-order again gives sorted order as ${keys.join(", ")}.`,
      why: `However the tree is drawn, left → node → right yields the sorted keys ${keys.join(", ")}.`,
    }
  }
  return {
    ...shared,
    prompt: "A bigger tree, same rule. Tap the nodes in in-order order.",
    hint: "",
    nudge: "Left → node → right, even with more nodes; the layout isn't the order.",
    correct: `In-order on the larger tree still reads sorted: ${keys.join(", ")}.`,
    why: `More nodes, same recovery: left → node → right yields the sorted keys ${keys.join(", ")}, whatever the shape.`,
  }
}

/**
 * The shape-vs-cost synthesis (`compare-shape`), de-cued. The three option labels
 * are neutral (they only compare step counts between Tree A and Tree B, never
 * state which halves, which walks, or that the keys match), and the figure
 * captions are the neutral "Tree A" / "Tree B" painted by the Stage. The verdict
 * (balanced halves, the stick walks every node) lives entirely in `correct` /
 * `why`, reinforced after the commit by the cost readouts + the RebalanceBracket
 * flourish. The misconception ("same data, so same cost") is the `same-cost`
 * distractor, so it is a real check, not a give-away.
 */
function makeCompare(seed: number): { question: TreesQuestion; next: number } {
  const balanced = T_BAL // Tree A
  const stick = T_STICK // Tree B
  const probe = 14 // the largest key: the stick's worst case
  const balCost = comparisonsCost(descendPath(balanced, probe).comparisons)
  const stickCost = scalesCost(descendPath(stick, probe).comparisons, "comparisons")
  const sh = shuffle(
    [
      { id: "a-fewer", label: "Tree A reaches it in fewer steps" },
      { id: "b-fewer", label: "Tree B reaches it in fewer steps" },
      { id: "same-cost", label: "Both take the same number of steps" },
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
      title: "Two shapes",
      target: probe,
      options: sh.result,
      answer: "a-fewer",
      cost: balCost,
      altCost: stickCost,
      prompt: "Both trees hold the same numbers. To find the largest, which is true?",
      hint: "",
      nudge: "They read the same in-order, but compare the shapes. Which one keeps dropping half?",
      correct: "Tree A wins. It halves to the value in 3 steps while Tree B walks all 7.",
      why: "Both read 2, 4, 6, 8, 10, 12, 14 in-order, so the same numbers and the same sorted output. But Tree B is a linked list in disguise. Finding 14 walks every node (7 steps), while balanced Tree A drops half each step and gets there in 3. Same data, very different cost.",
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
    hint: "",
    nudge: "Finish the walk to the value, then descend the tree to it.",
    correct: "The list walks 7 hops; the tree finds 14 in 3 comparisons.",
    why: "A sorted linked list has no branches. You walk every node (7 hops). The balanced BST drops half each step, finding 14 in 3. Branching is the whole difference.",
  }
}

function buildQuestion(part: TreesPart, seed: number): { question: TreesQuestion; next: number } {
  if (part === "demo" || part === "teach-descend" || part === "teach-inorder") {
    return { question: makeIntro(part), next: seed }
  }
  if (part === "watched-build") return { question: makeWatchedBuild(), next: seed }
  if (part === "build-bst-1" || part === "build-bst-2") {
    return { question: makeBuild(part), next: seed }
  }
  if (part === "find-hit" || part === "find-miss" || part === "insert" || part === "realworld") {
    return { question: makeDescend(part), next: seed }
  }
  if (part === "find-big") return makeFindBig(seed)
  if (part === "sequence-a" || part === "sequence-b" || part === "sequence-c") {
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
    build: isBuildPart(part) && question.buildKeys ? bstBuildFromKeys(question.buildKeys) : null,
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
    buildCorrect: 0,
    comparisonCorrect: 0,
    attempts: 0,
    question: null,
    tappedPath: [],
    tappedSlot: null,
    build: null,
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
  if (bin === "build") return { done: state.buildCorrect, total: BUILD_QUOTA }
  return { done: state.comparisonCorrect, total: COMPARISON_QUOTA }
}

/**
 * Frontier-gate for the in-order tap (Bucket 4): the single next correct in-order
 * id, the only node the learner may tap on a sequence beat. Returns null off a
 * sequence beat or once the whole order has been tapped. The reducer rejects any
 * other tap and the figure renders only this node as tappable, so the "tap by
 * ascending value" shortcut is gone: you can only walk the real traversal.
 */
export function sequenceFrontier(state: TreesState): string | null {
  const q = state.question
  if (!q || !isSequencePart(currentPartTrees(state))) return null
  if (state.tappedOrder.length >= q.order.length) return null
  return q.order[state.tappedOrder.length]
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

/** Can the learner press Check? Per-mechanic terminal-ready gate. Build beats commit
 * via taps (like the watched build / Heaps do-the-sift), so they never gate Check. */
export function canCheckTrees(state: TreesState): boolean {
  const part = currentPartTrees(state)
  const q = state.question
  if (!q) return false
  if (part === "compare-shape") return state.selected != null
  if (isSequencePart(part)) return state.tappedOrder.length === q.order.length
  if (part === "contrast-list") return chainWalkDone(state) && descendTerminal(state)
  if (part === "find-miss" || part === "insert") return state.tappedSlot != null
  if (part === "find-hit" || part === "find-big" || part === "realworld") return descendTerminal(state)
  return false
}

/** The hard mastery gate: Locate 5 + Sequence 3 + Build 2 + Comparison 2 = 12. */
export function isCompleteTrees(state: TreesState): boolean {
  return (
    state.locateCorrect >= LOCATE_QUOTA &&
    state.sequenceCorrect >= SEQUENCE_QUOTA &&
    state.buildCorrect >= BUILD_QUOTA &&
    state.comparisonCorrect >= COMPARISON_QUOTA
  )
}

export function hasProgressTrees(state: TreesState): boolean {
  return (
    state.partIndex > 0 ||
    state.locateCorrect > 0 ||
    state.sequenceCorrect > 0 ||
    state.buildCorrect > 0 ||
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
    case "find-big":
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
    case "sequence-c":
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
  else if (bin === "build") state.buildCorrect = Math.min(BUILD_QUOTA, state.buildCorrect + 1)
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

      // Build-the-BST: each tap is a descend step (a child id) or a drop
      // ("ghost:left" / "ghost:right"). The engine validates it against the
      // current key's descend; a correct drop that places the LAST key grades
      // the build and bumps the Build bin; any wrong tap is a brief nudge (no
      // fail wall), exactly like the Heaps build.
      if (isBuildPart(part)) {
        if (!state.build) return state
        const { beat, accepted, placedKey } = bstBuildTap(state.build, letter)
        if (!accepted) {
          return { ...state, feedback: "nudge", attempts: state.attempts + 1 }
        }
        if (placedKey && isBstBuildSolved(beat)) {
          const v = gradeAnswer(state, true)
          const next: TreesState = {
            ...state,
            build: beat,
            feedback: v.feedback,
            combo: v.combo,
            revealed: v.revealed,
            attempts: state.attempts + 1,
          }
          bumpBin(next, "build")
          return next
        }
        return { ...state, build: beat, feedback: "idle", attempts: state.attempts + 1 }
      }

      if (isSequencePart(part)) {
        // Frontier-gated: only the next correct in-order id is accepted, so the
        // learner walks the real traversal instead of tapping by ascending value.
        if (letter !== sequenceFrontier(state)) return state
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
      // Build beats commit via taps (select), never Check.
      if (isBuildPart(part)) return state
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
      // A fresh instance: reset the working state (and re-shuffle MCQ options /
      // regenerate the big tree). The build beat is rebuilt from its sequence.
      const { question, next } = buildQuestion(part, state.rngState)
      return {
        ...state,
        ...FRESH,
        question,
        rngState: next,
        tappedPath: isDescendPart(part) ? [question.tree.id] : [],
        tappedSlot: null,
        build: isBuildPart(part) && question.buildKeys ? bstBuildFromKeys(question.buildKeys) : null,
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
      build: s.buildCorrect,
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
    buildCorrect: clampT(c.build ?? 0, BUILD_QUOTA),
    comparisonCorrect: clampT(c.comparison ?? 0, COMPARISON_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, TREES_PARTS.indexOf(progress.currentPart as TreesPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
