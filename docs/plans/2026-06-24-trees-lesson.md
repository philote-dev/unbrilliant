# Plan: Willow (Trees (BST) Lesson (L5)) tap-to-descend halving + predict-the-in-order-sequence

> Source of truth: `docs/lessons/trees-bst.md`, the LOCKED, grilled spec. Honor it exactly: **11 beats, gate = 8** (Locate ×4 = find ×2 + insert + real-world; Sequence ×2; Comparison ×2); mechanics **Locate-the-position + Predict-the-sequence**; the taught tie-break is **"left subtree → node → right subtree"**; halving is **shown** (opposite subtree dims/collapses on each descend) and the *result* reads **`barely grows`**, a stick/chain walk reads **`scales`**, **no new cost word**. **Tap-only**: imports **nothing** from `src/components/rewire/*` (Principle 7. No drag/rewire prerequisite emitted). Layout is **hand-rolled** `inorder-index → x` / `depth → y` (NO `d3-hierarchy`); ships eager/playable like Arrays. Where the spec body and its **"Grilling decisions: session Jun 24"** conflict, the grilling decisions win. Binding parents: `docs/lesson-design.md` (Principles 1–7, Determinism rules, cost house-words §3, the **BST in-order mini-example**), `docs/design/design-system.md` (§16 "Trees (BST), hierarchical node/edge layout; descend / 'halve the search' highlight"), `docs/design/design-system.md` (D1 reveal-on-Why + SR-only fail copy). Structure modeled on `docs/plans/2026-06-24-hash-tables-lesson.md`.
>
> Constraints (verified in `package.json`): lint `oxlint` (`npm run lint`), unit `vitest run` node+dom (`npm run test`), typecheck/build `tsc -b` (`npx tsc -b`), emulator (`npm run test:emulator`), e2e (`npm run e2e`). Strict TS: `import type` (verbatimModuleSyntax), no enums/namespaces (erasableSyntaxOnly), `noUnusedLocals/Parameters`. Don't touch git.

## Goal

Ship **Trees (BST)** as the fifth playable `LessonModule` on the existing shared seam: a **tap-to-descend** tree figure (each tap lights the chosen edge+node and dims/collapses the opposite subtree. Halving made visible), de-cued **find / insert** locates, a **compact, non-monotonic** in-order **sequence** mechanic (pixel-x ≠ in-order) that **straightens into sorted order during the Why-replay**, a **higher/lower** real-world skin, and two **comparison** knockouts (balanced-vs-stick MCQ; a learner **tap-walked** sorted linked list vs a BST descend). Eleven beats; **8 graded** behind the until-correct wall, aggregated into bins **Locate ×4 / Sequence ×2 / Comparison ×2**. It reuses. Unchanged, the shared feedback machine + flame (`gradeAnswer`), `FeedbackFooter` (incl. its `canCheck` gate + `hideFailHint` SR-only fail copy), `AnswerCard`, `CostReadout` (house words `barely grows` + `scales`), and the durable `LessonProgress` shape. **No shared-engine edit, no new `LessonAction`, no `rewire/*` import, no heavy libs**, it ships eager/playable like Arrays.

## Reused vs lesson-specific

| Reused unchanged | Lesson-specific (new) |
|---|---|
| `gradeAnswer` / `LessonAction` / `LessonProgress` / `Feedback` (`src/features/lesson/engine.ts`) | `src/features/lesson/treesEngine.ts` (+ `.test.ts`). `DescendPath`/`insertSlot`/`inorder`, curated BST pool, 11-beat flow, 3 bin counters, verdicts |
| `CostWord` union + `CostReadout` (`src/components/willow/CostReadout.tsx`): `barely grows` / `scales` only | `src/lessons/trees/treeLayout.ts` (+ `.test.ts`). Hand-rolled tidy + **compact** layout + straighten interpolation |
| `FeedbackFooter` (`canCheck`, `hideFailHint`), `AnswerCard` (`data-answer`), `StatusChip`, `Button` | `src/lessons/trees/TreeFigure.tsx`: SVG edges + node buttons; descend halving, ghost slots, sequence/straighten, display |
| `LessonModule` contract, `LessonPlayer`/`LessonHost`, `useLessonRun`, persistence repo, catalog derivation | `src/lessons/trees/SortedChain.tsx`: read-only **tap-to-advance** chain (T5/T4 contrast); **not** `rewire/*` |
| `LessonLab` gallery harness, the emulator test + Playwright tracer patterns | `src/lessons/trees/Stage.tsx`, `src/lessons/trees.tsx` (the module) |
| Figure **idioms** (not code): `NodeGraph`/`graphLayout` absolute-div-over-SVG + outer scale-to-fit; `HashBox` SR + DEV hooks | wiring edits (`lessons.ts`, `catalog.ts`), gallery presets, emulator case, E2E leg, delete `future/Trees.tsx` |

## Grounding in the repo (verified: read before slicing)

**The playable registry is `src/features/lesson/lessons.ts` (`LESSONS`), not `src/lessons/registry.tsx`.** Verified current state, Hash Tables (L4) already shipped:

```ts
// src/features/lesson/lessons.ts
export const LESSONS: Record<string, LessonModule<any>> = {
 [stacksQueuesModule.id]: stacksQueuesModule,
 [arraysModule.id]: arraysModule,
 [linkedListsModule.id]: linkedListsModule,
 [hashTablesModule.id]: hashTablesModule,
}
```
`src/lessons/registry.tsx` exports the auto-derived `FUTURE_LESSONS` (every catalog entry **with** a `load` thunk → `React.lazy`). Dropping `trees`'s `load` removes it from `FUTURE_LESSONS` automatically.

**The `trees` catalog entry is a lazy preview today** (`src/lessons/catalog.ts`):
```ts
{ id: "trees", name: "Trees", load: () => import("@/lessons/future/Trees") },
```
`isLessonPlayable("trees")` is `!def.load` ⇒ removing the thunk flips it playable, and `LessonHost` then renders it eagerly via `LessonPlayer`. Sequential unlock (`isLessonUnlocked`) gates `trees` behind `hash-tables` completion. The module id is **`trees`** (must match the catalog id).

**No shared-engine change needed.** `src/features/lesson/engine.ts` already exports `gradeAnswer` (nudge → fail at `WRONG_LIMIT=2`, combo climbs on correct, breaks only on a full fail), `Feedback`, `LessonAction`, `LessonProgress`/`ResumeProgress` (durable slice = `counters: Record<string, number>` + `currentPart: string` + `completed`). New counter keys `locate`/`sequence`/`comparison` (+`attempts`) ride the `counters` map with no shape change. Exactly as Arrays/LL/Hash do.

**No new `LessonAction`.** The shared union is `build-step | continue | select{letter} | check | reveal | reattempt | next | rewire{from,to}`. Trees is **tap-only**: it uses `continue` (intro/teach), `select{letter}` (each node tap / MCQ option / chain-advance), `check`, `reveal`, `reattempt`, `next`. The reducer is lesson-owned, so it **accumulates** repeated `select` taps into `tappedPath` / `tappedOrder` (the same way `linkedListsEngine` interprets one `{type:"select", letter: nodeId}` as the traverse answer. Trees extends it to multi-tap). **It must not handle or emit `rewire`.**

**`canCheck` + SR-only fail are proven seams.** `FeedbackFooter` takes an optional `canCheck` override (LL's rewire uses `canCheck={state.writes.length > 0}`; Hash uses `canCheck={state.placement != null}`) and `hideFailHint` (renders `StatusChip` + an `sr-only` `role="status"`, no answer until **Why?**: the D1 convention, verified in `FeedbackFooter.tsx` + `design-system.md` §D1). Trees uses `canCheck={canCheckTrees(state)}` for descend/sequence and the default `selected` gate for MCQ, with `hideFailHint`.

**`CostWord` is the locked union** `"free" | "barely grows" | "scales" | "usually free"` (`CostReadout.tsx`). Trees uses only **`barely grows`** (balanced descend) and **`scales`** (stick/chain walk). The **halving work-meter** (opposite subtree shrinking out) is a **Trees-only visual on top of** the house word per `lesson-design.md` §3. **Not** a new `CostWord`. Never `free`/`usually free`.

**Figure idioms to mirror (do not edit the originals: L3-owned, shared downstream):** `src/lessons/linkedLists/NodeGraph.tsx` renders absolute-positioned node `<button>`s over an SVG arrow layer, scaled to fit via an outer `ResizeObserver` wrapper, with pure geometry in `src/lessons/linkedLists/graphLayout.ts` (unit-testable in node, since jsdom zeroes `getBoundingClientRect`). Trees mirrors this split: a **pure** `treeLayout.ts` (+ test) + a presentational `TreeFigure.tsx`. `useReducedMotion()` (from `motion/react`) gates every animation → snap + SR (NodeGraph/HashBox pattern). DEV-only test hooks: `data-answer="1"` on a winning `AnswerCard`/tap target, à la `HashTable`'s `correctTarget` and `HashBox`'s `data-hash-correct-bucket`.

### Grounding corrections: stale assumptions, fixed against the code

1. **The `future/Trees.tsx` preview says it "loads a heavy lib (d3-hierarchy) lazily."** STALE vs the grill: **the layout is hand-rolled, zero layout deps.** `d3-hierarchy` (+ `@types/d3-hierarchy`), `@xyflow/react`, `d3-force`, `gsap` are still in `package.json` and named as the Trees heavy lib in `design-system.md` §16-adjacent and `registry.tsx`'s comment. All **superseded** for Trees. The build imports **nothing** from `d3-*` / `@xyflow/react` / `gsap`, and adds **no** dependency. (`derivePathNodes`/`FUTURE_LESSONS` are derived, so deleting `future/Trees.tsx` after the thunk is dropped is clean.)
2. **There is no "sequence" or multi-tap `LessonAction`.** Multi-tap descend/sequence is accumulated in `TreesState` via repeated `select`: no shared-seam change (corrects any assumption that a new action is required). The `select` payload field is named `letter` (overloaded for ids), as in every engine.
3. **Trees is tap-only.** Confirm via tests/lint that `treesEngine.ts`, `TreeFigure.tsx`, `SortedChain.tsx`, and `Stage.tsx` import nothing from `@/components/rewire/*` (the T5 chain is a bespoke read-only tap-to-advance row, **not** `RewireSurface`). Principle 7: no drag/rewire prerequisite is emitted.
4. **The e2e tracer is one long chain** (`e2e/tracer.spec.ts`): S&Q → Arrays → Linked Lists → **Hash Tables** ("You mastered Hash Tables."). The Trees leg appends after that, gated by **completing Hash Tables first** (the sequential unlock is real. Trees is course-reachable only once L1–L4 are completed; until then it's exercised via the Gallery lab + the tracer chain).

## Decisions (settled before slicing)

- **Engine location:** `src/features/lesson/treesEngine.ts` (matches every shipped engine; node test glob `src/**/*.test.ts`). Stage + figures + the pure `treeLayout.ts` colocate under `src/lessons/trees/` (dom test glob `src/**/*.test.tsx`; `treeLayout.test.ts` runs in node).
- **Parts model:** **11 parts, one per beat** (curated, 1:1, like `LL_PARTS`/`HASH_PARTS`), advanced linearly. **Gate counters aggregate by bin** (like Hash): `locateCorrect` (cap 4) / `sequenceCorrect` (cap 2) / `comparisonCorrect` (cap 2). `isCompleteTrees = locate≥4 && sequence≥2 && comparison≥2` (**8**). `totalParts = 11` drives the progress bar; `partQuotaTrees` shows "Locate · n / 4" etc. (the `BinHeader` pattern from `hashTables/Stage.tsx`).
- **Tap-only, accumulate in state.** Descend: cursor starts at the root; only the **current node's two children** (and, when the relevant child is empty, a **dashed ghost slot**) are tappable; each real-child tap appends to `tappedPath`; tapping the ghost is the **terminal** "fell off / attach here". Sequence: each tap appends to `tappedOrder`. T5: the chain is tap-to-advance (`chainCursor`), then the BST is descended. No `rewire`.
- **Grading is pure over the GIVEN tree** (never learner-built; no dup keys; one locate/insert/traversal at a time. Determinism rules). `descendPath`/`insertSlot`/`inorder` carry every verdict; **layout never affects grading** (the compact draw grades identically to a tidy one).
- **Halving is shown, not a new word.** Per descend step the figure dims+collapses the opposite subtree (size = `subtreeSize` of the dropped child) and the SR status announces it; the **result** is one `CostReadout` `barely grows` with `count = comparisons` (= path length). The stick/chain walk reads `scales` with `count = hops`.
- **No new `LessonAction`, no new shared widget, no `rewire/*`, no heavy libs.** Plain React + `motion` over hand-rolled geometry. Ships eager.

### Proposed engine shapes (for the executor)

```ts
// src/features/lesson/treesEngine.ts
import {
 gradeAnswer, type Feedback, type LessonAction, type LessonProgress,
} from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

export interface TreeNode {
 id: string // stable tap id, unique within a tree (e.g. "n8")
 key: number
 left: TreeNode | null
 right: TreeNode | null
}

export const TREES_PARTS = [
 "demo", // 1 intro free-play: tap a node, watch the opposite subtree drop,
 "teach-descend", // 2 teach: compare · go left if smaller / right if larger · drop half,
 "find-hit", // 3 T1 descend-find (hit) Locate ✓
 "find-miss", // 4 T1 descend-find (falls off / absent) Locate ✓
 "insert", // 5 T2 descend-insert (tap the ghost slot) Locate ✓
 "teach-inorder", // 6 teach: left subtree → node → right subtree,
 "sequence-a", // 7 T3 in-order tap (compact, tree #1) Sequence ✓
 "sequence-b", // 8 T3 in-order tap (compact, tree #2. Diff shape) Sequence ✓
 "realworld", // 9 T1 skin: higher/lower number guess Locate ✓
 "compare-shape", // 10 T4 same keys, balanced vs stick (MCQ) Comparison ✓
 "contrast-list", // 11 T5 sorted list walk vs BST descend Comparison ✓
] as const
export type TreesPart = (typeof TREES_PARTS)[number]
export const TREES_TOTAL_PARTS = TREES_PARTS.length

export const LOCATE_QUOTA = 4
export const SEQUENCE_QUOTA = 2
export const COMPARISON_QUOTA = 2

export type TreesBin = "locate" | "sequence" | "comparison"
export type TreesMode = "intro" | "descend" | "sequence" | "mcq" | "contrast"

export interface TreesOption { id: string; label: string }
export interface TreesCost { word: CostWord; count: number; unit: string }

/* ----- pure helpers (no React, no layout. All grading lives here) ----- */
export interface DescendStep { id: string; goLeft: boolean; droppedSize: number }
export interface DescendResult {
 path: string[] // node ids root→…(target | last-before-fall)
 found: boolean
 missingParentId: string | null // parent of the empty slot (miss/insert)
 missingSide: "left" | "right" | null
 comparisons: number // = path.length → the "barely grows" count
 steps: DescendStep[] // per-step dropped opposite-subtree sizes
}
export function descendPath(root: TreeNode, x: number): DescendResult
export function insertSlot(root: TreeNode, x: number): { parentId: string; side: "left" | "right" }
export function inorder(root: TreeNode): string[] // node ids, left→node→right
export function inorderKeys(root: TreeNode): number[]
export function subtreeSize(node: TreeNode | null): number
export function depth(node: TreeNode | null): number
export function nodeById(root: TreeNode, id: string): TreeNode | null

export interface TreesQuestion {
 kind: TreesPart
 bin: TreesBin | null
 mode: TreesMode
 prompt: string
 tree: TreeNode // the GIVEN curated tree
 target: number | null // X for locate / contrast
 descend: DescendResult | null // precomputed for find/insert/realworld/contrast
 insertAt: { parentId: string; side: "left" | "right" } | null
 order: string[] // inorder node ids (unique correct tap order)
 options: TreesOption[] // compare-shape MCQ
 answer: string // winning option id (mcq)
 stick: TreeNode | null // T4 degenerate same-keys tree
 chain: number[] | null // T5 sorted list keys (tap-walk)
 cost: TreesCost | null // barely grows (descend)
 altCost: TreesCost | null // scales (stick / list walk)
 contacts: boolean // realworld (higher/lower) skin flag
 hint: string; nudge: string; correct: string; why: string
}

export interface TreesState {
 seed: number; rngState: number; partIndex: number
 locateCorrect: number // 0..4
 sequenceCorrect: number // 0..2
 comparisonCorrect: number // 0..2
 attempts: number
 question: TreesQuestion | null
 tappedPath: string[] // descend: starts [root.id]; appends children
 tappedSlot: { parentId: string; side: "left" | "right" } | null // ghost terminal
 tappedOrder: string[] // sequence taps
 chainCursor: number // T5 felt pre-walk position
 selected: string | null // mcq option id
 wrongCount: number; feedback: Feedback; revealed: boolean; showWhy: boolean
 combo: number; completed: boolean
}

/* ----- selectors the chrome / Stage / figure need ----- */
export function currentPartTrees(s: TreesState): TreesPart
export function binOf(part: TreesPart): TreesBin | null
export function isTerminalTrees(s: TreesState): boolean // feedback correct|fail
export function filledPartsTrees(s: TreesState): number // completed ? 11 : partIndex
export function partQuotaTrees(s: TreesState): { done: number; total: number } | null
export function tappableChildren(s: TreesState): { left: boolean; right: boolean; ghostSide: "left" | "right" | null }
export function canCheckTrees(s: TreesState): boolean
export function isCompleteTrees(s: TreesState): boolean
export function toProgressTrees(s: TreesState): LessonProgress
export function resumeTrees(progress: LessonProgress, seed?: number): TreesState
export function hasProgressTrees(s: TreesState): boolean
export function createTrees(seed?: number): TreesState
export function treesReducer(s: TreesState, a: LessonAction): TreesState
```

**Reducer sketch** (mirrors `hashTablesReducer`): `continue` advances only on `demo`/`teach-descend`/`teach-inorder`. `select`, descend parts: append the tapped child id to `tappedPath` (or set `tappedSlot` when the ghost is tapped); sequence parts: append to `tappedOrder`; mcq: set `selected`; `contrast-list`: phase-A advances `chainCursor`, phase-B descends. `check` grades via the pure helpers, runs `gradeAnswer`, and on `correct` bumps the bin counter (capped). `reveal` sets `showWhy` (triggers the in-order **straighten** in the figure). `reattempt` rebuilds the working state fresh. `next` (only when `feedback==="correct"`) enters the next part; the last part sets `completed`.

**`canCheckTrees`:** descend ⇒ `tappedSlot != null` **or** the last tapped node's key === `target`; sequence ⇒ `tappedOrder.length === order.length`; mcq ⇒ `selected != null`; contrast ⇒ chain pre-walk finished **and** descend terminal.

**`check` verdicts (all pure):**
- `find-hit` / `realworld`: `tappedPath` equals `descend.path` **and** `descend.found`.
- `find-miss`: `tappedPath` equals `descend.path` **and** `tappedSlot` equals `{descend.missingParentId, descend.missingSide}` **and** `!descend.found`.
- `insert`: `tappedPath` reaches `insertAt.parentId` along `descend.path` **and** `tappedSlot` equals `insertAt`.
- `sequence-*`: `tappedOrder` deep-equals `order`.
- `compare-shape`: `selected === answer`.
- `contrast-list`: `tappedPath` equals `descend.path` **and** `descend.found` (chain pre-walk is felt, ungraded; both `CostReadout`s show on correct).

### Curated BST pool + targets (the worked fixture: the test's ground truth)

Author as **seedable parameters now** (which curated tree, which `target`); randomized variants are a later parameter swap. `id` is `"n<key>"` per tree. All trees ≤ 7 nodes (readability lock). **Canonical balanced tree `T_BAL`** (keys 2·4·6·8·10·12·14): root `8` → left `4`(`2`,`6`), right `12`(`10`,`14`); `inorder = 2,4,6,8,10,12,14`; balanced depth 3.

| beat | tree | target X | expected (pure) | cost shown |
|---|---|---|---|---|
| 3 `find-hit` | `T_BAL` | 10 | path `8→12→10`, found; dropped {3 then 1} | `barely grows` · 3 comparisons |
| 4 `find-miss` | `T_BAL` | 7 | path `8→4→6`, ghost **right of 6**, absent | `barely grows` · 3 (walked) |
| 5 `insert` | `T_BAL` | 5 | path `8→4→6`, slot **left of 6** | `barely grows` · 3 |
| 7 `sequence-a` | `T_BAL` (compact draw) | - | order `2,4,6,8,10,12,14` | - |
| 8 `sequence-b` | `T_ZIG` (6 nodes, zigzag) | - | order = its sorted keys | - |
| 9 `realworld` | `T_BAL` (higher/lower) | 2 | path `8→4→2`, found ("lower, lower") | `barely grows` · 3 |
| 10 `compare-shape` | `T_BAL` vs **stick** (same keys) | - | MCQ: same set + same in-order, **stick walks / balanced halves** | `barely grows` (bal) vs `scales` (stick) |
| 11 `contrast-list` | sorted list `[2..14]` vs `T_BAL` | 14 | list hops `indexOf+1 = 7`; tree path `8→12→14` (3) | `scales` · 7 vs `barely grows` · 3 |

`T_ZIG` (representative 2nd shape; finalize in build): keys 3·5·7·9·11·15 → root `9` → left `3`(right `7`(left `5`)), right `15`(left `11`); `inorder = 3,5,7,9,11,15`. The **compact** layout deliberately places pixel-x ≠ in-order (e.g. the deep-left `5` sits right of shallow nodes), so the row cannot be read left-to-right. **Halving-honesty guard:** every `barely grows` beat uses a reasonably **balanced** tree; the **stick** appears only in the comparison beats (and never to teach balancing).

`compare-shape` options (seeded shuffle, correct-first → de-dupe → `shuffle`): `same-order-diff-cost` (✓ "same keys, same in-order order, but the stick walks, the balanced tree halves"), `same-structure` (the misconception), `diff-sets` (distractor).

## The 11-beat → bin → graded → mechanic table

| # | Beat (part id) | Type · bin | Graded? | Input | Mechanic |
|---|---|---|---|---|---|
| 1 | `demo` | intro | - | tap to descend (free play) | - |
| 2 | `teach-descend` | teach | - | Continue | - |
| 3 | `find-hit` | T1 · Locate | ✓ | tap path | Locate-the-position |
| 4 | `find-miss` | T1 · Locate | ✓ | tap path → ghost | Locate-the-position |
| 5 | `insert` | T2 · Locate | ✓ | tap path → ghost slot | Locate-the-position |
| 6 | `teach-inorder` | teach | - | Continue | - |
| 7 | `sequence-a` | T3 · Sequence | ✓ | tap nodes in order | Predict-the-sequence |
| 8 | `sequence-b` | T3 · Sequence | ✓ | tap nodes in order | Predict-the-sequence |
| 9 | `realworld` | T1 skin · Locate | ✓ | tap (higher/lower) | Locate-the-position |
| 10 | `compare-shape` | T4 · Comparison | ✓ | MCQ (`AnswerCard`) | Locate (compare two finds) |
| 11 | `contrast-list` | T5 · Comparison | ✓ | tap-walk chain → descend | Locate (compare two finds) |

**Gate = 8** = Locate ×4 (beats 3,4,5,9) + Sequence ×2 (7,8) + Comparison ×2 (10,11). Flame/combo via the shared `gradeAnswer`, spanning these 8, breaking only on a full fail.

---

## (A) NEW, disjoint files: the build subagent's deliverable

The build subagent creates **only** these files and **must not touch any shared seam** (no edits to `engine.ts`, `lessonModule.ts`, `lessons.ts`, `catalog.ts`, `FeedbackFooter`, `AnswerCard`, `CostReadout`, `rewire/*`, `GalleryApp.tsx`, the emulator test, or the e2e tracer). It validates with a **targeted** run only:

```
npx vitest run src/features/lesson/treesEngine.test.ts \
 src/lessons/trees/treeLayout.test.ts \
 src/lessons/trees/TreeFigure.test.tsx
```
(no `tsc -b`, no full suite. The orchestrator runs those in (B)). New files: `src/features/lesson/treesEngine.ts` (+ `.test.ts`), `src/lessons/trees/treeLayout.ts` (+ `.test.ts`), `src/lessons/trees/TreeFigure.tsx`, `src/lessons/trees/SortedChain.tsx`, `src/lessons/trees/TreeFigure.test.tsx`, `src/lessons/trees/Stage.tsx`, `src/lessons/trees.tsx`.

Internal build order is **smallest-first, riskiest beat first.** The riskiest thing in the whole lesson is the **compact, non-monotonic in-order layout + the straighten** (novel geometry, no prior art, and the anti-cheat keystone), so it is the tracer bullet.

### Slice A1, TRACER: compact layout + straighten + the Sequence face (beats 6–8)

**Pure-first:** `treeLayout.ts`, `tidyLayout(root)` (`x = inorderIndex·GAP_X`, `y = depth·ROW_Y`, circular-node tokens à la `graphLayout`) **and** `compactLayout(root)` (a deliberately **non-monotonic** packing where each child stays locally down-left/down-right but global pixel-x ≠ in-order), plus `straighten(t, compact, tidy)` interpolation for the Why-replay. All deterministic, node-testable. `treesEngine.ts` foundations: `TreeNode`, `inorder`/`inorderKeys`, the curated pool (`T_BAL`, `T_ZIG`), `TREES_PARTS`, `createTrees`/`enterPart`, the `select`-accumulate + `check` for sequence, `sequenceCorrect`, selectors (`currentPartTrees`, `partQuotaTrees` "n of 8", `canCheckTrees`, `isTerminalTrees`).

**Figure (the biggest risk):** `TreeFigure.tsx` sequence mode. Nodes drawn at **compact** coordinates; tapping a node appends to `tappedOrder` and shows the running order; on **Why** (`showWhy`) the nodes **slide to their tidy in-order x** (reduced-motion → snap, SR announces the order). DEV hook: `data-inorder-rank={i}` per node for the tracer. `Stage.tsx` routes `teach-inorder` (Continue) + the two sequence beats.

**Acceptance (targeted vitest):** `inorder(T_BAL)` = `2,4,6,8,10,12,14`; `inorder(T_ZIG)` = its sorted keys; **tapping in compact order grades identically to tidy** (layout never changes the verdict); a correct full tap-order → `sequenceCorrect+1`/combo climbs, a wrong order → nudge → fail at `WRONG_LIMIT` (counter untouched on fail); reduced-motion snaps (dom test); same seed → identical question.

### Slice A2, the Locate face: descend find / insert / real-world (beats 1–5, 9)

**Engine:** `descendPath`/`insertSlot`/`subtreeSize`/`depth`/`nodeById`; descend `select`-accumulate (only the cursor's children/ghost are legal. `TappableChildren`) + ghost terminal; `check` for `find-hit`/`find-miss`/`insert`/`realworld`; `locateCorrect`; `cost`/`altCost` makers (`barely grows` with `comparisons`).

**Figure:** `TreeFigure.tsx` descend mode. Each tap lights the chosen edge+node and **dims/greys/collapses the opposite subtree** (size from `subtreeSize`); **dashed ghost slots** under the descend path for empty children; reduced-motion → opposite subtree just greys (no collapse), SR announces e.g. *"9 < 12. Go left; dropped the right subtree (4 nodes); 3 left."* DEV hook: `data-answer="1"` on the **single correct next step** (child or ghost), recomputed each render. `Stage.tsx` adds `demo` (free-play descend) + `teach-descend` (Continue) + the descend beats + the **higher/lower** real-world skin (a token-scoped wrapper, à la LL's Spotify part; each guess = tap higher/lower = descend right/left).

**Acceptance:** `descendPath(T_BAL,10)` path `n8,n12,n10`, found, comparisons 3; `descendPath(T_BAL,7)` ghost right-of-`n6`, absent; `insertSlot(T_BAL,5)` = `{n6,left}`; correct descend → `locateCorrect` bumps + `CostReadout barely grows`; wrong direction nudges→fails; only the cursor's two children are tappable; reduced-motion snaps; deterministic.

### Slice A3 (the Comparison face + module (beats 10–11)) completes the gate

**Engine:** `compare-shape` MCQ (seeded options, `answer="same-order-diff-cost"`, the same-structure misconception present); `contrast-list` (chain pre-walk `chainCursor` + graded descend); `comparisonCorrect`; `isCompleteTrees` (4/2/2); `toProgressTrees`/`resumeTrees`/`hasProgressTrees`. `SortedChain.tsx`, read-only **tap-to-advance** row (cursor + hop count → `scales`), **no `rewire/*`**. `Stage.tsx` adds the two comparison routes (T4 reuses `AnswerCard`; T5 shows `SortedChain` then the descend figure with both `CostReadout`s on correct). `trees.tsx` exports `treesModule: LessonModule<TreesState>` (`id:"trees"`, `totalParts:11`), mirroring `arrays.tsx`/`hashTables.tsx`.

**Acceptance:** T4 single-correct with the misconception distractor wrong; `contrast-list` list-hops `7` (`scales`) vs tree-comparisons `3` (`barely grows`); the gate flips to complete **only** after all 8; a happy-path play reaches `completed` with `combo=8`; resume = same beat, cold combo; same seed → identical everything; **no import from `@/components/rewire/*`** anywhere in `src/lessons/trees/**` or `treesEngine.ts`.

---

## (B) Shared-seam integration: the orchestrator's deliverable (sequential)

Only after (A) is green. Each step is a shared seam the build agent was forbidden to touch.

1. **Register**: `src/features/lesson/lessons.ts`: `import { treesModule } from "@/lessons/trees"` and add `[treesModule.id]: treesModule,` to `LESSONS`.
2. **Make playable**: `src/lessons/catalog.ts`: remove `load: () => import("@/lessons/future/Trees")` from the `trees` entry (→ `{ id: "trees", name: "Trees" }`). Flips `isLessonPlayable("trees")` true; auto-drops it from `FUTURE_LESSONS`; unlock stays sequential (after `hash-tables`).
3. **Retire the preview**: delete `src/lessons/future/Trees.tsx`. (Keep `future/_shell.tsx`, Heaps/Graphs still use it.)
4. **Gallery lab**: `src/dev/GalleryApp.tsx`: add a `trees` `LessonLab` (import `createTrees`/`resumeTrees`/`treesReducer`/`treesModule` + a `TR_PRESETS` array mirroring `HT_PRESETS`, per-beat + idle/selected/correct/nudge/fail/why states); extend the `LABS` array, the `Selection` union (`"trees"`), and the render branch.
5. **Emulator round-trip**: `src/features/progress/firestoreProgressRepository.emulator.test.ts`: add a Trees case (mirror the Hash/LL cases). `Counters: { locate, sequence, comparison, attempts }` + `currentPart` (e.g. `"sequence-a"`) round-trips and resumes on the same beat.
6. **E2E leg**: `e2e/tracer.spec.ts`: after `"You mastered Hash Tables."`, click `/Continue to Trees/`, play 11 beats, assert `"You mastered Trees."`. New helpers: `descendToTarget(page)` (loop: while **Check** is disabled, click `[data-answer="1"]`, then Check + Continue), `tapInorder(page)` (read `data-inorder-rank`, tap ascending, Check, Continue), `walkThenDescend(page)` for T5; `compare-shape` reuses `answerCell`/`answerArrays`.
7. **Verify green**, run `npm run lint`, `npx tsc -b`, `npm run test`, `npm run test:emulator`, `npm run e2e`. Delegate to `verifier`/`test-runner` per the orchestration rules; address `security-auditor` only if a seam touches untrusted input (it doesn't here).

## Acceptance criteria (the "done" definition)

- **Tap-only:** no file under `src/lessons/trees/**` or `treesEngine.ts` imports `@/components/rewire/*`; the lesson emits no `rewire` action and no drag/rewire prerequisite.
- **Gate:** `isCompleteTrees` flips only at Locate 4 / Sequence 2 / Comparison 2; the happy path reaches `completed` with `combo=8`; failed/revealed attempts never count.
- **Determinism:** same `(tree, X)` ⇒ same `descendPath`/`insertSlot`/verdict; same tree ⇒ same `inorder`; **compact layout grades identically to tidy**; given-tree only, no dup keys, one step at a time, never "insert k values"; no model calls.
- **Halving honesty:** every `barely grows` beat uses a balanced tree; the stick appears only in comparison beats; the work-meter is `CostReadout` (no new word).
- **A11y / reduced motion:** tap targets ≥ 44px, lilac focus, icon+text+SR for feedback; the dropped subtree carries an SR "discarded (n nodes)" note; in-order order + comparisons/hops announced; reduced-motion snaps to end-state for descend, sequence-straighten, and the contrast walk.
- **Live + persisted:** playable from the course path after Hash Tables; a signed-in reload resumes mid-lesson on the same beat; Gallery lab renders every beat.
- **Green:** `npm run lint`, `npx tsc -b`, `npm run test`, `npm run test:emulator`, `npm run e2e` all pass.

## Risks & mitigations

- **Compact non-monotonic layout + straighten (highest).** Novel geometry; must be un-readable as a row yet animate cleanly to sorted. → Own the x-coordinate in a **pure** `treeLayout.ts` (node-tested); build it **first** (Slice A1); grade off `inorder` (layout-independent) so a layout bug can never change a verdict.
- **Multi-tap with no multi-tap action.** → Accumulate repeated `select` in `TreesState` (proven: LL/Hash interpret `select` per-lesson). Keep `tappedPath`/`tappedOrder` transient (not persisted) so the durable shape is unchanged.
- **"Fell off / absent" interaction (T1-miss).** → Unify with insert: descend to the **ghost slot** and tap it ("it would be here ⇒ absent"). Same figure affordance, different prompt/verdict copy.
- **T5 graded surface (genuine fork).** The grill says "tap-walk the list, then descend the BST." → Grade the **descend** (Locate); the chain walk is a felt, ungraded pre-step feeding the `scales` count. Flagged in Open questions.
- **Halving word drifting dishonest.** → Curate balanced-only `barely grows` beats; never teach balancing/rotations (cut by spec). Test asserts comparison counts on the curated pool.
- **Reduced motion for 3 new animations** (subtree collapse, sequence straighten, contrast walk). → Gate every `motion` animation behind `useReducedMotion()`; dom test asserts the snap path.
- **Tracer determinism for multi-tap.** → DEV hooks `data-answer="1"` (current correct descend step) + `data-inorder-rank` (sequence) mirror `data-push-order`/`data-write-order`; loop until **Check** enables.
- **Stale "d3-hierarchy" lore.** → Build imports nothing from `d3-*`/`@xyflow/react`/`gsap`; add no dependency; a lint/grep check in (A) and the deleted preview enforce it.

## Test-contract mapping (the three seams + determinism)

- **Engine unit (node): `treesEngine.test.ts`** (mirror `hashTablesEngine.test.ts`/`arraysEngine.test.ts`): the worked-fixture (`descendPath` hit/miss, `insertSlot`, `inorder` for `T_BAL`/`T_ZIG`/**stick**, `subtreeSize`/dropped counts); a balanced find → `barely grows` with the right comparison count, a stick/list find → `scales` with the right hop count; T4 single-correct with the misconception distractor present; T5 list-hops vs tree-comparisons numbers; `gradeAnswer` nudge→fail; the gate flips only at 4/2/2 (combo 8); flame breaks only on a full fail; determinism (same seed → identical questions/orders, no model calls); resume on the same beat with a cold combo; a completed run resumes completed.
- **Figure (dom): `TreeFigure.test.tsx`** (mirror `NodeGraph.test.tsx`/`HashBox.test.tsx`): a descend tap appends to the path and only the cursor's children are tappable; a sequence tap order; reduced-motion snap (no collapse/straighten); DEV hooks present in DEV. **Layout (node): `treeLayout.test.ts`**: tidy x = in-order index; compact x is non-monotonic vs in-order; straighten endpoints equal tidy.
- **Repository (emulator): Trees case in `firestoreProgressRepository.emulator.test.ts`**: `{ locate, sequence, comparison, attempts }` + `currentPart` round-trip and resume-on-same-beat; reconcile (anon → account) unchanged (reuses `LessonProgress`).
- **One Playwright leg: `e2e/tracer.spec.ts`**: continue into Trees after Hash Tables; play all 11 beats; the descend tap-path commits, the in-order tap-order commits, the contrast walk+descend commits; assert each graded beat gates and no model calls fire; a reload resumes.
- **Per-mechanic determinism:** **Locate**, same `(tree,X)` ⇒ same path/slot/verdict; **Sequence**, same tree ⇒ same unique in-order, and **compact grades identically to tidy**.

## Coordination notes

- **Shared-seam stability:** Trees only **adds** a module + a `counters` map. Do **not** touch `LessonModule`/`LessonAction`/`LessonProgress`/`gradeAnswer`/`CostWord` or `rewire/*` public API. The (A)/(B) split above is the contract: the build agent never edits a shared seam; the orchestrator does the integration sequentially.
- **Persistence keys:** the new counters `locate`/`sequence`/`comparison` (+`attempts`) ride the `counters` map. Notify the persistence/analytics agent so dashboards expect them (as L0 did for its 8-flag change). `lessonStats` already sums counters−attempts, so `correct=8` derives correctly.
- **No heavy layout lib:** the tree layout is hand-rolled. Zero new deps; the proto bundle is unchanged. (Heaps L6, if built later, may want a tree-layout helper for its dual view. Coordinate then; Trees depends on none.)
- **Sequential-unlock reality:** `trees` is course-reachable only once L1–L4 are completed; until then exercise it via the Gallery lab + the e2e tracer chain. Surfaced for planning, not a code change.
- **Downstream:** this lesson pins "BST = an ordering you descend; in-order = sorted; search halves" for Heaps L6's "a heap is NOT a BST." Hand-off noted, not built here.

## Open questions for the human

1. **T5 graded surface (recommend descend-commit).** Grade `contrast-list` by the **BST descend** (Locate), with the chain tap-walk as a felt, ungraded pre-step feeding the `scales` readout. Honoring "the trade in their hands" without inventing a Comparison-only verdict. Alternative: a terminal MCQ ("which barely grows?"). Pick one before Slice A3.
2. **`T_ZIG` exact shape & whether sequence-b reuses the pool or grows it.** The curated 8 are seedable now; confirm the second sequence tree (a clearly non-monotonic shape) and whether variants reuse the curated trees or add new ones (a parameter swap, deferred. Author the curated set first).
3. **Real-world skin fidelity (recommend a light token-scoped higher/lower card,** like LL's Spotify wrapper) vs a fuller number-guessing UI.
4. **"Fell off" affordance (recommend ghost-slot tap** for both miss and insert) vs an explicit "Not here" button on find-miss.
