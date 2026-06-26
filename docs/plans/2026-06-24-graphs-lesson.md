# Plan: Willow (Graphs Lesson (L7)) node-link picture ↔ adjacency list, consume rewire for undirected edge-draw

> Source of truth: `docs/lessons/graphs.md`, the LOCKED, grilled spec. Honor it exactly: **12 beats, gate = 8**; bins **read (4) / draw (2) / same (2)**; mechanics **Locate-the-position + Repair/rewire**; canonical model a **symmetric `Record<NodeId, NodeId[]>`**, **positions never enter a verdict**; **consume `src/components/rewire/*` (a node is both `RewireSource` and `RewireTarget`), normalize `{from,to}` to an undirected edge in the engine**; **G1 read = tap-the-neighbors multi-select** (verdict = set equality; degree = set size); **G2 path-exists = bounded yes/no reachability** (no traversal graded); **same-graph** staged one "same" (moved-node) + one "different" (one-edge); **real-world skin = transit/subway**; **cost = NONE**; **layouts hand-authored + Framer Motion, no heavy lib → ships eager/playable like Arrays**. Where the spec body and its "Grilling decisions. Session Jun 24" conflict, the **grilling decisions win**. Binding parents: `docs/lesson-design.md` (Worked lesson B, Principles 1–7, determinism rules), `docs/design/design-system.md` (§16 two-panel; reduced-motion §7/§14), `docs/design/design-system.md` (D1 SR-only fail copy + reveal-on-Why order). Structure mirrors `docs/plans/2026-06-24-hash-tables-lesson.md`.
>
> Constraints (verified in `package.json`): lint `oxlint` (`npm run lint`); unit `vitest run` node (`src/**/*.test.ts`) + dom (`src/**/*.test.tsx`) (`npm run test`); typecheck/build `tsc -b` (`npx tsc -b`); emulator (`npm run test:emulator`); e2e (`npm run e2e`). Strict TS: `import type` (verbatimModuleSyntax), no enums/namespaces (erasableSyntaxOnly), `noUnusedLocals/Parameters`. Don't touch git.

## Goal

Ship **Graphs** as the **fifth** playable `LessonModule` on the existing shared seam: a **two-panel, synced** figure. A node-link **picture** (labeled circles `A…H`, plain undirected lines, no arrowheads, positionally inert) beside the **adjacency list** ("the graph's actual data"). That drives six de-cued reads and two undirected edge-draws. Twelve beats; **8 graded** behind the until-correct wall, aggregated into a **read 4 / draw 2 / same 2** gate. It reuses (unchanged) the shared feedback machine + flame (`gradeAnswer`), `FeedbackFooter` (incl. its `canCheck` gate), `AnswerCard`, the durable `LessonProgress` shape, and the pure rewire infra (`src/components/rewire/*`, especially `useRewireNode`, a node that is *both* source and target). Wire it live (register → drop the catalog `load` thunk → delete the preview). **No shared-engine edit, no new `LessonAction` (`rewire {from,to}` already exists), no cost readout, no heavy libs**, it ships eager/playable like Arrays.

## Reused vs lesson-specific

| Reused unchanged | Lesson-specific (new) |
|---|---|
| `gradeAnswer` / `LessonAction` (incl. `rewire {from,to}`) / `LessonProgress` (`engine.ts`) | `src/features/lesson/graphsEngine.ts` (+ `.test.ts`). Adjacency model, edge normalization, curated 12-beat flow, 3 bin counters, verdicts |
| `FeedbackFooter` (with `canCheck`), `AnswerCard` (`data-answer`, `data-testid="answer-card"`) | `src/lessons/graphs/GraphCanvas.tsx`: node-link picture (demo-drag / multi-select / draw / display); undirected `<line>`s; Framer Motion `layout` redraw |
| Rewire infra: `RewireSurface` / `RewireSource` / `RewireTarget` / `useRewireNode` / pure `core.ts` (consumer only) | `src/lessons/graphs/AdjacencyPanel.tsx`, synced sorted rows (the "data" panel); `SameGraphView.tsx`, two canvases for the redraw beat |
| `LessonModule` contract, `LessonPlayer`/`LessonHost`, `useLessonRun`, persistence repo, catalog derivation | `src/lessons/graphs/Stage.tsx`, `src/lessons/graphs.tsx` (the module) + a dom test |
| `LessonLab` gallery harness, the emulator test + Playwright tracer patterns | wiring edits (`lessons.ts`, `catalog.ts`), gallery presets, emulator case, E2E leg, `catalog.test.ts` update |

## Grounding in the repo (verified: read before slicing)

**The `rewire` action already exists on the shared union**: no `engine.ts` change (verified `src/features/lesson/engine.ts`):

```ts
// src/features/lesson/engine.ts (LessonAction)
 | { type: "rewire"; from: string; to: string }
```

**A node can be BOTH source and target: the primitive already exists.** `src/components/rewire/useRewireNode.ts` registers a node as a source (`sourceId`) *and* a target (`targetId`), separate registry maps, so the two ids may even be the same string, and returns `rootProps` to spread on one `<button>` (drag/tap/keyboard all funnel to the same `{from,to}` intent). `src/lessons/linkedLists/NodeGraph.tsx`'s `RewireNode` is the worked consumer (`sourceId: pointerId(node)`, `targetId: node`). **Graphs uses `sourceId = targetId = node` so a drag A→B emits `{from:"A", to:"B"}`** and the engine normalizes to the undirected edge `{A,B}`.

**The Check-gate for non-`selected` beats already exists.** `FeedbackFooter` takes an optional `canCheck` override (`src/components/willow/FeedbackFooter.tsx`); LL's rewire beat uses `canCheck={state.writes.length > 0}`, Hash's drag beat uses `canCheck={state.placement != null}`. Graphs: multi-select read → `canCheck={selectedNodes.length > 0}`; draw → `canCheck={pendingEdge != null}`; yes-no / MCQ / classify → default `selected`-based gate.

**The shared, stable seams to build on (do not edit):**
- `gradeAnswer` (`engine.ts`): nudge on first wrong, fail at `WRONG_LIMIT=2`, combo climbs on correct, breaks only on a full fail. Only "which counter to bump" is lesson-specific.
- `LessonProgress` (`engine.ts`): durable slice = `counters: Record<string, number>` + `currentPart: string` + `completed: boolean`. **Counters are NUMBERS only**, new keys `read`/`draw`/`same`(+`attempts`) ride it with no shape change.
- `LessonModule` contract (`lessonModule.ts`): `create`, `reducer`, `toProgress`, `resume`, `hasProgress`, `totalParts`, `filledParts`, `combo`, `completed`, `Stage`.
- The pure rewire core (`core.ts`): `isWithin` / `resolveDropTarget` (nearest-center, deterministic tie-break) / `resolveIntent` / `cycleTarget` (keyboard wrap). `RewireSurface` owns the registry + pointer-drag + tap + keyboard + one `aria-live` + the `suppressClick` discipline. `RewireTarget`/`useRewireNode` emit a drop **for any registered target, legal or not**, **legality (`legalTargets`) is highlight/announcement only; it never gates emission**.
- Reference engine/stage to mirror: `arraysEngine.ts` (const-tuple `PARTS`, copied seeded `rngNext/shuffle`, MCQ recipe: correct-first → deterministic distractors → de-dupe → seed-shuffle) and `linkedListsEngine.ts` (curated 1:1 part-per-beat flow, `enterPart`/`resume`, the `rewire`-action handling + `workingNext`/`writes` working state + `legalTargets`/`reachableFrom`). `hashTablesEngine.ts` (bin counters + `partQuota` "n of 9" + `legalBuckets` + `canCheckHash` + part-predicate sets). For the Stage: `linkedLists/Stage.tsx` `RewirePart` (the `RewireSurface` + `canCheck` pattern) and `hashTables/Stage.tsx` (BinHeader + `AnswerCard` MCQ + drag/tap parts).
- SVG/figure idioms: `linkedLists/NodeGraph.tsx` (absolutely-positioned circular nodes + `RewireContext` `armedSource`/`hoveredTarget` reads + a live "stretch" arrow + reduced-motion via `useReducedMotion`) and `graphLayout.ts` (pure geometry: `center`, `radius`, `directArrow`, **reusable for straight undirected lines if wanted**; Graphs needs *no* arrowheads, so a plain `<line>` is simpler).
- Test infra ready (verified `vitest` projects in the repo): **node** (`src/**/*.test.ts`) + **dom** (`src/**/*.test.tsx`, jsdom + Testing Library). Emulator round-trip pattern: `firestoreProgressRepository.emulator.test.ts` (has S&Q + LL + **Hash** cases to copy). Single Playwright tracer: `e2e/tracer.spec.ts` (today: S&Q → Arrays → Linked Lists → Hash Tables; helpers `rewireByKeyboard`, `hashDropByKeyboard`, `answerArrays`). `src/components/rewire/imports.test.ts` guards the rewire dir against `@xyflow`/`d3`/`gsap`, Graphs must likewise stay native + `motion/react`. Gallery harness: `src/dev/GalleryApp.tsx` (`LessonLab` + `Preset[]` per module).

### Grounding corrections: locked *assumptions* that are wrong against the code

1. **The playable registry is `src/features/lesson/lessons.ts` (`LESSONS`), not `src/lessons/registry.tsx`** (which only exports the *derived* `FUTURE_LESSONS` lazy previews). Verified current `LESSONS`: S&Q, Arrays, Linked Lists, **Hash Tables**. Hash Tables is **already wired live** (in `LESSONS`, no `load` thunk in `catalog.ts`, plays to completion in `e2e/tracer.spec.ts`). So the real coordination is **don't break the shared rewire primitives** while consuming them.
2. **"Graphs unlocks after Trees" is wrong: it unlocks after its IMMEDIATE predecessor, HEAPS.** `isLessonUnlocked` (`src/lessons/catalog.ts`) reads `DATA_STRUCTURES_LESSONS[index - 1]`. The array order is `… trees(4), heaps(5), graphs(6)`, so Graphs gates on `progress["heaps"].completed`. **Trees and Heaps are still preview stubs** (`load` thunks → not playable, not completable). Consequence below (E2E reachability). This is the single biggest correction in this plan.
3. **The "in-flight working adjacency round-trips in persistence" requirement is NOT achievable**: `LessonProgress.counters` is `Record<string, number>`; a partial-draw adjacency map cannot ride it without a forbidden seam change. So, exactly like Hash's `placement` and LL's `workingNext`/`writes`, **the working adjacency / pending edge / multi-select set are TRANSIENT** (not persisted). Resume re-enters the beat fresh. The emulator case round-trips `{read, draw, same, attempts}` + `currentPart` + `completed` and resumes on the same beat. **Not** the in-flight draw.
4. **`legalTargets` cannot be source-dependent at the surface prop level**: the surface takes one flat `Set<string>` computed from engine `state`, which does not know which node is armed (arming is surface-internal). The spec's "`legalTargets` excludes the source and its existing neighbors" is therefore enforced **in the engine `rewire` reducer** (a draw to self or to an existing neighbor is a **no-op**). The surface prop `legalTargets` = **all node ids** (so every node is keyboard-reachable, per the a11y requirement); the figure may *additionally* dim a source's existing neighbors by reading `armedSource` from `RewireContext` (presentational polish, like `NodeGraph`). See Decisions.
5. **There is no URL/deep-link routing** (`src/lessons/LessonHost.tsx` + state-based `NavigationProvider`). A lesson opens only via an unlocked course-path node or the completion CTA. Both gated by unlock. Combined with #2, the Graphs E2E needs a deliberate entry (see Risks/Open questions).

## Decisions (settled before slicing)

- **Engine location:** `src/features/lesson/graphsEngine.ts` (matches every shipped engine; node glob `src/**/*.test.ts`). Stage + figures colocate under `src/lessons/graphs/`.
- **Eager/playable, no code-split.** Hand-authored 6–8-node layouts + `motion/react` only → no heavy lib → no per-lesson chunk. `graphs.tsx` is imported directly in `lessons.ts` and the catalog `load` thunk is dropped. The playable+code-split tension **dissolves**.
- **Parts model:** **12 parts, one per beat** (curated, 1:1, like `LL_PARTS`/`HASH_PARTS`), advanced linearly via `next`/`continue`. **Gate counters aggregate by bin** (like Hash): `readCorrect` (cap 4) / `drawCorrect` (cap 2) / `sameCorrect` (cap 2). `isCompleteGraphs = read≥4 && draw≥2 && same≥2` (sum 8). `totalParts=12` drives the progress bar; `partQuotaGraphs` returns the cumulative **"n of 8"** for the header (plus a bin sub-label).

```ts
export const GRAPHS_PARTS = [
 "demo", // 1 intro: drag a node, nothing changes; tap a node lights its list,
 "teach", // 2 teach: adjacency is the data; a graph is not a tree,
 "read-list", // 3 G1 tap C's connection list (multi-select) Read ✓
 "read-degree", // 4 G1 tap D's neighbors; degree = count (multi-select) Read ✓
 "read-path", // 5 G2 is there a path from A to F? (yes/no) Read ✓
 "match-list", // 6 G3 which adjacency list matches? (MCQ) Read ✓
 "draw-demo", // 7 intro: draw an edge, watch the list gain a neighbor,
 "draw-edge", // 8 G4 draw the one missing edge (rewire) Draw ✓
 "draw-transit", // 9 G4 transit skin: add the missing connection (rewire) Draw ✓
 "redraw-demo", // 10 teach: same graph snaps to a new layout, list still,
 "same-graph", // 11 G5 same graph? moved-node (same) / one-edge (diff) Same ✓
 "tree-or-not", // 12 G2-family: tree or general graph? (spot the cycle) Same ✓
] as const
export type GraphsPart = (typeof GRAPHS_PARTS)[number]
```

- **Bins are read/draw/same; mechanics are Locate + Repair/rewire (orthogonal).** Read bin = beats 3,4,5,6 (Locate). Draw bin = beats 8,9 (Repair/rewire). Same bin = beats 11,12 (Locate/Classify). The "6 distinct structural reads" the spec names (connection-list, degree, connected/path, picture→list, same-graph, tree-or-not) are the *pedagogical* coverage; the *counters* split read/draw/same.
- **`select` is overloaded (no new action):** on multi-select read beats (3,4) it **toggles** a node in `selectedNodes`; on single-choice beats (5,6,11,12) it sets `selected`. The reducer branches on the current part's mode.
- **`rewire` (draw beats 8,9) is the only drag.** The engine normalizes `{from,to}` → undirected edge, enforces guards (no self-loop, no parallel/dup, both endpoints in the beat's node set), and records a **single pending edge** (a new legal draw *replaces* the prior. "One edge at a time"; verdict is set-equality so it still generalizes). The figure renders `workingAdj = shownAdj + pendingEdge` so the drawn line + the new list row appear live.
- **`legalTargets` for a draw = all nodes** (keyboard reach + announce); the **engine** rejects self/dup draws as no-ops. The figure may dim a source's existing neighbors via `armedSource` from context (polish).
- **Positions never enter a verdict.** Each beat's `layout` (a `Record<NodeId, Pt>`, plus `layoutB` for same-graph/redraw) rides the question as **plain presentational data**; no verdict reads it. A unit test pins this (relabel positions → verdict unchanged).
- **Cost: none.** No `CostReadout`, no `CostWord`, no house words anywhere in this lesson.
- **Working state is transient** (not persisted): `selectedNodes`, `selected`, `pendingEdge`, `workingAdj`. Durable = `{read, draw, same, attempts}` + `currentPart` + `completed`.

### Proposed engine shapes (for the executor)

```ts
// graphsEngine.ts. Adjacency model + pure helpers (no React, no geometry in verdicts)
export type NodeId = string // "A".."H"
export type Adjacency = Record<NodeId, NodeId[]> // kept SYMMETRIC + sorted
export type Edge = readonly [NodeId, NodeId] // normalized so a <= b
export interface Pt { x: number; y: number }

export const normalizeEdge = (u: NodeId, v: NodeId): Edge => (u <= v ? [u, v] : [v, u])
export const edgeKey = (u: NodeId, v: NodeId): string => normalizeEdge(u, v).join("-")

/** Symmetric neighbor read, sorted (order-independent for verdicts). */
export const neighbors = (adj: Adjacency, n: NodeId): NodeId[] => [...(adj[n] ?? [])].sort()
export const degree = (adj: Adjacency, n: NodeId): number => (adj[n] ?? []).length
export const hasEdge = (adj: Adjacency, u: NodeId, v: NodeId): boolean =>
 (adj[u] ?? []).includes(v)

/** The undirected edge set of an adjacency (each {u,v} once): the canonical identity. */
export function edgeSet(adj: Adjacency): Set<string> {
 const s = new Set<string>()
 for (const u of Object.keys(adj)) for (const v of adj[u]) s.add(edgeKey(u, v))
 return s
}
/** Add an undirected edge to BOTH rows (idempotent, sorted). Returns a new map. */
export function addEdge(adj: Adjacency, u: NodeId, v: NodeId): Adjacency {
 const next: Adjacency = { ...adj, [u]: [...(adj[u] ?? [])], [v]: [...(adj[v] ?? [])] }
 if (!next[u].includes(v)) next[u] = [...next[u], v].sort()
 if (!next[v].includes(u)) next[v] = [...next[v], u].sort()
 return next
}
/** Two graphs are the SAME iff their edge sets are equal: provably position-free. */
export const sameGraph = (a: Adjacency, b: Adjacency): boolean => setEqualStr(edgeSet(a), edgeSet(b))

/** Reachability (BFS over adjacency): internal; the learner predicts yes/no only. */
export function reachable(adj: Adjacency, start: NodeId): Set<NodeId> {
 const seen = new Set<NodeId>([start]); const q = [start]
 while (q.length) { const n = q.shift()!; for (const m of adj[n] ?? []) if (!seen.has(m)) { seen.add(m); q.push(m) } }
 return seen
}
export const pathExists = (adj: Adjacency, a: NodeId, b: NodeId): boolean => reachable(adj, a).has(b)
export const isConnected = (adj: Adjacency, nodes: NodeId[]): boolean =>
 nodes.length === 0 || reachable(adj, nodes[0]).size === nodes.length
/** Connected undirected graph is a tree iff |edges| === |nodes| − 1 (i.e. acyclic). */
export const isTree = (adj: Adjacency, nodes: NodeId[]): boolean =>
 isConnected(adj, nodes) && edgeSet(adj).size === nodes.length - 1

/** Set equality for the multi-select read verdict (order-independent). */
export function setEqual(a: readonly string[], b: readonly string[]): boolean {
 if (a.length !== b.length) return false
 const s = new Set(a); return b.every((x) => s.has(x))
}
function setEqualStr(a: Set<string>, b: Set<string>): boolean {
 return a.size === b.size && [...a].every((x) => b.has(x))
}
```

```ts
export type GraphBin = "read" | "draw" | "same"
export type GraphMode = "intro" | "multiselect" | "yesno" | "mcq" | "draw" | "classify"
export interface GraphOption { id: string; label: string }

export interface GraphsQuestion {
 kind: GraphsPart
 bin: GraphBin | null
 mode: GraphMode
 prompt: string
 nodes: NodeId[] // the beat's labels (6–8 of A..H)
 adj: Adjacency // the canonical (correct) symmetric adjacency
 shownAdj?: Adjacency // draw beats: the picture's adjacency (missing one edge)
 focus?: NodeId // read-list / read-degree: the asked node
 pair?: readonly [NodeId, NodeId] // read-path: the (X,Y) asked
 missingEdge?: Edge // draw beats: the one correct edge to add
 adjB?: Adjacency // same-graph: the second layout's adjacency
 layout: Record<NodeId, Pt> // PRESENTATIONAL only. Never read by a verdict
 layoutB?: Record<NodeId, Pt> // same-graph / redraw: the alternate layout
 options: GraphOption[] // mcq (match-list) / yesno / classify choices
 answer: string // winning option id (yesno/mcq/classify); else ""
 answerSet?: NodeId[] // multiselect: the correct neighbor set
 transit?: boolean // draw-transit skin flag
 hint: string; nudge: string; correct: string; why: string
}

export interface GraphsState {
 seed: number; rngState: number; partIndex: number
 readCorrect: number; drawCorrect: number; sameCorrect: number // capped 4 / 2 / 2
 attempts: number
 question: GraphsQuestion | null
 // working state (TRANSIENT, never persisted):
 selectedNodes: NodeId[] // multi-select read set (toggled by `select`)
 selected: string | null // yes/no | mcq option | same/different | tree/graph
 pendingEdge: Edge | null // draw beat: the single drawn edge
 workingAdj: Adjacency // draw beat: shownAdj + pendingEdge (for the figure)
 wrongCount: number; feedback: Feedback; revealed: boolean; showWhy: boolean
 combo: number; completed: boolean
}
```

- **Reducer (mirrors `hashTablesReducer`/`linkedListsReducer`):**
 - `continue`: intro/teach beats only (`demo`, `teach`, `draw-demo`, `redraw-demo`).
 - `select`: multiselect beats toggle `action.letter` in `selectedNodes` (`feedback:"idle"`); single-choice beats set `selected`.
 - `rewire`, draw beats only; `const e = normalizeEdge(from, to)`; **no-op** if `from===to`, if `hasEdge(shownAdj, from, to)` (existing neighbor / dup), or if either endpoint ∉ `nodes`; else `{ pendingEdge: e, workingAdj: addEdge(shownAdj, from, to), feedback:"idle" }`.
 - `check`: grade by mode, then `gradeAnswer` (nudge → fail at `WRONG_LIMIT`, combo). On correct, bump the bin (`Math.min(quota, …)`):
 - `multiselect`: `setEqual(selectedNodes, answerSet)`
 - `yesno` / `mcq` / `classify`: `selected === answer`
 - `draw`: `sameGraph(workingAdj, adj)` (≡ `pendingEdge` is the `missingEdge`)
 - `reveal`, `reattempt` (fresh seeded instance: re-shuffle MCQ/options, clear working state), `next` (advance; on the last part set `completed`).
- **`canCheckGraphs`:** multiselect → `selectedNodes.length > 0`; draw → `pendingEdge != null`; else `selected != null`.
- **`legalDrawTargets(state)`** → `new Set(question.nodes)` (all nodes; engine enforces real legality). `legalNeighborTargets(adj, source)` (pure, for the figure's optional dimming) → `nodes \ {source} \ neighbors(source)`.
- **Selectors:** `currentPartGraphs`, `isTerminalGraphs` (`feedback==="correct"||"fail"`), `filledPartsGraphs` (`completed ? 12 : partIndex`), `partQuotaGraphs` → `{ done: read+draw+same, total: 8 }` (+ a `binOf`/bin label for the sub-header), `isCompleteGraphs`, `hasProgressGraphs`, `toProgressGraphs`, `resumeGraphs`.

### Proposed curated graph pool (the worked-values fixture: tests pin it)

Base graph **G6** (nodes `A B C D E F`; edges `A–B, A–C, B–C, B–D, C–E, D–E, E–F`) → adjacency `A:[B,C] B:[A,C,D] C:[A,B,E] D:[B,E] E:[C,D,F] F:[E]`, 6 nodes, **7 edges, connected, has a cycle (A-B-C)** ⇒ a general graph, not a tree.

| beat | what's asked | data | graded as |
|---|---|---|---|
| 3 `read-list` | "Tap everyone in **C**'s connection list." | G6, focus `C` | `answerSet = {A,B,E}` (set equality) |
| 4 `read-degree` | "Tap **D**'s neighbors. Its degree is how many?" | G6, focus `D` | `answerSet = {B,E}`, degree 2 (set size) |
| 5 `read-path` | "Is there a **path** from **A** to **F**?" (de-cued) | G6, pair `(A,F)` | yes: `pathExists` (subtype `connected` variant covered by tests) |
| 6 `match-list` | "Which adjacency list matches?" | G6 | correct = G6 set; distractors **+A–D**, **−C–E**, **+B–F** (each differs by one real edge; none is G6 re-sorted) |
| 8 `draw-edge` | "Given the list, draw the missing edge." | shown = G6 **−{B,D}**; list = G6 | `missingEdge = {B,D}`; legal-from-B = {D,E,F}; B–E/B–F = legal-but-wrong |
| 9 `draw-transit` | transit skin: "Add the missing line." | transit graph (6 stations), missing one transfer | `missingEdge` = the one absent connection |
| 11 `same-graph` | "Same graph as before?" | layout `A` = G6; layout `B` = G6 moved (curated "same"); "different" variant swaps one edge | `answer = sameGraph(adj, adjB) ? "same" : "different"` |
| 12 `tree-or-not` | "Tree or general graph?" | G6 (cycle): "general graph"; tree variant `T6` (`A–B,A–C,C–D,C–E,E–F`, 5 edges) covered by tests | `answer = isTree(adj, nodes) ? "tree" : "graph"` |

> Positions for each beat are hand-authored `layout` maps (and `layoutB` for beats 10/11). These are presentational; tests assert no verdict depends on them.

## The 12-beat → bin → graded → mechanic table

| # | Beat | Type · bin | Mode | Mechanic | Graded |
|---|---|---|---|---|---|
| 1 | Graph demo. Drag a node, nothing changes; tap a node lights its list | intro | intro | - | - |
| 2 | Explanation: adjacency is the data; not a tree (no root, cycles OK) | teach | intro | - | - |
| 3 | C's connection list (tap-the-neighbors) | G1 · **read** | multiselect | Locate | ✓ |
| 4 | Degree of D (tap-the-neighbors) | G1 · **read** | multiselect | Locate | ✓ |
| 5 | Path from A to F? (yes/no) | G2 · **read** | yesno | Locate | ✓ |
| 6 | Which adjacency list matches? | G3 · **read** | mcq | Locate | ✓ |
| 7 | Draw-edges demo. Draw an edge, the list gains a neighbor | intro | intro | - | - |
| 8 | Draw the missing edge (rewire) | G4 · **draw** | draw | Repair/rewire | ✓ |
| 9 | Transit skin. Add the missing connection (rewire) | G4 · **draw** | draw | Repair/rewire | ✓ |
| 10 | Redraw demo. Same graph, new layout; list still | teach | intro | - | - |
| 11 | Same graph? (moved-node same / one-edge different) | G5 · **same** | classify | Locate | ✓ |
| 12 | Tree or general graph? (spot the cycle) | G2-fam · **same** | classify | Locate | ✓ |

**Gate:** `read ≥ 4 && draw ≥ 2 && same ≥ 2` (= 8). Flame/combo spans the 8; breaks only on a full fail.

## Tracer-bullet slices (smallest-first, riskiest-first, each full-stack + tests)

Slices 1–3 ship behind the Gallery lab + node/dom tests; Slice 4 flips the lesson live and adds emulator + Playwright. **Build the two riskiest beats first**: the draw-edge-via-rewire (beat 8) and the tap-the-neighbors multi-select (beat 3). Before fan-out, because they exercise the two new interaction shapes (node-as-source+target; overloaded `select` set-toggle).

### Slice 1, De-risking tracer: edge-draw (beat 8) + multi-select read (beat 3)

**Engine (pure-first):** `graphsEngine.ts`, the adjacency model + all pure helpers above; `GRAPHS_PARTS`; `createGraphs`/`enterPart`/reducer for `demo`/`teach`/`read-list`/`draw-demo`/`draw-edge`; the `select` set-toggle + `rewire` (normalize + guards + pending edge) + `check` grading multiselect (set equality) and draw (set equality); `legalDrawTargets`/`canCheckGraphs`; selectors (`currentPartGraphs`/`isTerminalGraphs`/`partQuotaGraphs` "n of 8"); `readCorrect`/`drawCorrect` bumping; seeded makers `makeReadList` + `makeDrawEdge`.

**Figures (the biggest risk):**
- `graphs/GraphCanvas.tsx`, absolutely-positioned circular nodes from `layout`; undirected `<line>`s for each edge (no arrowheads); `mode="multiselect"` (each node a button; selected → lilac; `data-answer="1"` DEV hook on correct-neighbor nodes; sync-highlight the focus row); `mode="draw"` (each node via `useRewireNode({ sourceId:n, targetId:n, … })`; renders `workingAdj`; a DEV `data-graph-correct-target` marker on the correct source). `useReducedMotion()` → snap.
- `graphs/AdjacencyPanel.tsx`: sorted monospace rows; highlights the focused/affected row; renders `workingAdj` live on draw beats.

**Stage + gallery:** `graphs/Stage.tsx` routes `demo`/`teach`/`draw-demo` (Continue) + a `ReadMultiSelectPart` (taps nodes, `canCheck={selectedNodes.length>0}`) + a `DrawPart` (inside `RewireSurface`, `legalTargets={legalDrawTargets(state)}`, `onRewire`, `canCheck={pendingEdge!=null}`). Add a `graphs` `LessonLab` group + presets to `GalleryApp.tsx`. **Do not** make the catalog entry live yet.

**Acceptance:** `neighbors`/`degree`/`edgeSet`/`addEdge`/`sameGraph` correct on G6; beat 3 set-equality → correct/combo+1/`read=1`, partial/extra selection → nudge→fail at `WRONG_LIMIT` (counter untouched on fail); beat 8 drawing `{B,D}` → correct, drawing `{B,A}`≡`{A,B}` no-ops (dup), `{B,B}` no-ops (self), `{B,E}` legal-but-wrong → nudge; `canCheck` false until a selection/draw; same seed → identical question; keyboard-only draw matches pointer; reduced-motion snaps (dom test); lint + tsc + test green.

### Slice 2, The rest of the read bin: degree (4), path (5), match-list (6)

**Engine:** makers `makeReadDegree` (multiselect, `answerSet`=neighbors, degree=size), `makeReadPath` (yesno over `pathExists`; subtype `connected`|`path` seeded; curated = `path`), `makeMatchList` (MCQ: correct G6 set + 3 one-edge distractors, seed-shuffled, guard no re-sort dup). `readCorrect` caps at 4.

**Stage:** a `YesNoPart` (two `AnswerCard`s yes/no) + a `PictureToListPart` (figure + `AnswerCard` list options). Gallery presets per beat.

**Acceptance:** degree set-equality + size correct; path yes/no correct for both subtypes; match-list correct option = G6 set, every distractor differs by exactly one edge and is distinct, none is a re-sort; options deterministic per seed; `read` caps at 4; green.

### Slice 3, Draw skin + the same bin: transit (9), same-graph (11), tree-or-not (12)

**Engine:** `makeDrawTransit` (transit skin flag; same draw verdict), `makeSameGraph(variant)` (two layouts; `answer` via `sameGraph`; both "same"/"different" variants), `makeTreeOrNot(variant)` (`answer` via `isTree`; G6 + T6 variants). `drawCorrect` caps 2, `sameCorrect` caps 2; `isCompleteGraphs`.

**Figures/Stage:** `SameGraphView.tsx` (two `GraphCanvas` display instances, list panel held still, Framer Motion `layout` for the redraw demo) + a `ClassifyPart` (two `AnswerCard`s: same/different, tree/graph). Token-scoped transit skin around `DrawPart` (à la LL's Spotify wrapper. Pass contrast/lilac-focus/reduced-motion). Why-replay overlays the two adjacency lists for same-graph.

**Acceptance:** transit draw grades identically to beat 8; same-graph verdict **invariant under a positions-only relabel**, flips on a one-edge change; tree-or-not = `edges===nodes−1 ∧ connected`; all 8 graded beats gate; reduced-motion snaps; green.

### Slice 4: Wire live, gate, persistence, E2E, determinism

- **Module:** `src/lessons/graphs.tsx` exporting `LessonModule<GraphsState>` (`id:"graphs"`, `totalParts:12`), mirroring `hashTables.tsx`.
- **Gate/flame:** `isCompleteGraphs` = 4/2/2; `filledPartsGraphs` = `completed ? 12 : partIndex`; flame spans the 8 via shared combo.
- **Persistence:** `toProgressGraphs`/`resumeGraphs` with counters `{read, draw, same, attempts}` + `currentPart` + `completed`; resume = same beat, fresh instance, cold combo, working state reset.
- **Wire live (exact steps: (B) shared seams):**
 1. `src/features/lesson/lessons.ts`: `import { graphsModule } from "@/lessons/graphs"` and add `[graphsModule.id]: graphsModule,` to `LESSONS`.
 2. `src/lessons/catalog.ts`, remove `load: () => import("@/lessons/future/Graphs")` from the `graphs` entry. Flips `isLessonPlayable("graphs")` true and auto-drops it from `FUTURE_LESSONS`.
 3. **Delete** `src/lessons/future/Graphs.tsx`. (Keep `future/_shell.tsx`: Trees/Heaps still use it.)
 4. Update `src/lessons/catalog.test.ts` (the "three playable lessons …" assertions are already stale vs Hash Tables; extend to include `graphs` playable + absent from `FUTURE_LESSONS`, and the lazy set = `{trees, heaps}`).
- **Emulator:** add a Graphs case to `firestoreProgressRepository.emulator.test.ts` (mirror the Hash case): mid-beat round-trip of `{read, draw, same, attempts}` + `currentPart` (e.g. `"draw-edge"`) + resume-on-same-beat. (No in-flight adjacency. It isn't persistable.)
- **E2E:** extend the tracer with a Graphs leg + a `drawEdgeByKeyboard` helper (focus the `data-graph-correct-target` node's `data-rewire-source`, Enter to arm, ArrowRight to the correct `data-rewire-target`, Enter; then Check) and a `tapNeighbors` helper (click every `[data-answer="1"]`, Check). **Reachability caveat (see Risks):** Graphs cannot be reached by the existing completion chain (Trees/Heaps are previews), so this leg requires seeding the unlock.
- **Determinism:** a node test. Same seed → identical graphs, focus nodes, options, draws, verdicts; no model calls.

**Acceptance:** `isCompleteGraphs` flips only after 4/2/2; the happy path reaches `completed` with `combo=8`; failed/revealed never count; the lesson renders via `LessonHost` for `lessonId:"graphs"`; signed-in reload resumes mid-lesson; `npm run lint`, `npx tsc -b`, `npm run test`, `npm run test:emulator` green; E2E green once the unlock-seed decision (Open Q1) is taken.

## Stories → slices matrix

| Beat | Type · bin | Graded | Verb | Slice |
|---|---|---|---|---|
| 1 demo / 2 teach | intro | - | play / read | 1 |
| 3 read-list | G1 · read | ✓ | **multi-select** | **1 (tracer)** |
| 7 draw-demo / 8 draw-edge | intro / G4 · draw | ✓ | **draw (rewire)** | **1 (tracer)** |
| 4 degree | G1 · read | ✓ | multi-select | 2 |
| 5 path | G2 · read | ✓ | yes/no | 2 |
| 6 match-list | G3 · read | ✓ | MCQ | 2 |
| 9 transit | G4 · draw | ✓ | draw (rewire) | 3 |
| 10 redraw-demo | teach | - | watch | 3 |
| 11 same-graph | G5 · same | ✓ | classify | 3 |
| 12 tree-or-not | G2-fam · same | ✓ | classify | 3 |
| gate · flame · wire · persistence · E2E · determinism | - | - | - | 4 |

## Acceptance criteria (the verifier's checklist)

- **Model purity:** every verdict is a pure function of `adj` (+ `selectedNodes` / `selected` / `pendingEdge`); **no verdict reads `layout`** (proved by a positions-relabel test). Adjacency always symmetric; no self-loops; no parallel/dup edges.
- **Reads:** connection-list & degree grade by **set equality** (order-independent; extra or missing node = wrong); degree = set size; path = `pathExists` yes/no; match-list correct = the picture's exact edge set, distractors each differ by exactly one real edge.
- **Draws:** `{A,B}` ≡ `{B,A}`; a draw to self or an existing neighbor is a **no-op**; a legal-but-wrong edge grades wrong; one missing edge ⇒ one correct draw; tap **and** keyboard both commit the edge.
- **Same/tree:** same-graph verdict invariant under a moved-node redraw, flips on a one-edge change; tree-or-not = `|edges|===|nodes|−1 ∧ connected`.
- **Gate/flame:** `isCompleteGraphs` only after 4/2/2; flame climbs on correct, breaks only on a full fail; revealed/failed never count.
- **Persistence:** `{read, draw, same, attempts}` + `currentPart` + `completed` round-trip and resume on the same beat (cold combo, fresh working state).
- **a11y/reduced-motion:** tapping a node announces its connection list; edge-draw has tap+keyboard parity (≥44px targets, visible lilac focus); `prefers-reduced-motion` snaps every new animation (sync highlight, redraw, edge-draw, drag demo) + SR status; minimal fail UX (no fail sentence; Why?/Reattempt + SR-only status; correct revealed only on Why).
- **Quality gates:** `npm run lint`, `npx tsc -b`, `npm run test`, `npm run test:emulator` green; E2E per Open Q1.

## Risks & mitigations

- **E2E reachability (HIGHEST).** Graphs gates on `progress["heaps"].completed`, and Trees/Heaps are previews → no UI route reaches Graphs (no deep link either). → **Mitigation/Decision needed (Open Q1):** seed unlock for the Graphs e2e (sign up, then write `completed:true` progress for `trees`+`heaps` for the test uid via the emulator, reload → course path shows Graphs current → play), **or** ship a Stage-level keyboard-draw integration test (dom) as the interim proof and defer the Playwright leg until Trees/Heaps are playable. Do **not** weaken the unlock rule to make the tracer pass.
- **Node = source AND target self-loop.** `resolveDropTarget` can return the source's own rect (a registered target) → `{from:A,to:A}`. → Engine `rewire` no-ops `from===to`; `useRewireNode` already blocks self-hover/self-choose for tap/keyboard.
- **Source-dependent legality can't live in the flat `legalTargets` prop.** → Enforce in the reducer (no-op self/dup); pass `legalTargets = all nodes` for keyboard reach; optional figure-level dimming via `armedSource` from `RewireContext`.
- **Multi-select reuses `select` (overload).** → Reducer branches on part mode; `selectedNodes` for multiselect, `selected` for single-choice; `canCheck` gates each; covered by unit + dom tests.
- **"In-flight working adjacency persists" is impossible** (numbers-only counters). → Keep working state transient; emulator test asserts counters/part/completed only. **Notify the persistence agent** of new keys `read`/`draw`/`same`.
- **Same-graph could grade on layout.** → Verdict is strictly `sameGraph(edgeSet)`; positions-relabel test pins invariance; "different" instances change a real edge, never just positions.
- **Heavy-lib temptation for layout.** → Hand-authored `layout` maps + `motion/react` only; keep `graphs/` free of `@xyflow`/`d3`/`gsap` (mirror the `rewire/imports.test.ts` discipline; optionally add a graphs-dir bundle guard).
- **Reduced motion across 4 new animations.** → Gate every `motion` animation behind `useReducedMotion()` → snap + SR.
- **Tracer determinism for the draw.** → DEV-only `data-graph-correct-target` on the correct source node + the stable `data-rewire-source`/`data-rewire-target` from `useRewireNode`; `data-answer="1"` on correct multiselect nodes + the correct yes/no/MCQ/classify option. Reuse the `rewireByKeyboard` shape.

## Test-contract mapping (the three seams + determinism)

- **Engine unit (node): `graphsEngine.test.ts`** (mirror `hashTablesEngine.test.ts` + `linkedListsEngine.test.ts`):
 - pure helpers on the G6 fixture: `neighbors`/`degree`/`edgeSet`/`addEdge`(symmetric, idempotent)/`sameGraph`/`reachable`/`pathExists`/`isConnected`/`isTree`.
 - **undirected set-equality:** multiselect grades `setEqual(selected, neighbors)`; draw grades `sameGraph(workingAdj, adj)` with `{A,B}`≡`{B,A}`; self/dup draw = no-op; legal-but-wrong draw = wrong.
 - **same-graph layout-invariance:** relabel every position in `layoutB` (same adjacency) → verdict stays "same"; change one edge → "different".
 - **tree-or-not:** G6 → "graph", T6 → "tree" (`edges===nodes−1 ∧ connected`).
 - match-list: correct = G6 set; each distractor differs by exactly one edge, distinct, none a re-sort.
 - `gradeAnswer` nudge→fail at `WRONG_LIMIT`; gate flips only at 4/2/2; flame breaks only on a full fail; `partQuotaGraphs` "n of 8".
 - **determinism:** same seed → identical graphs/focus/options/draws/verdicts; no model calls.
- **Figure (dom): `graphs/Stage.test.tsx`** (mirror `NodeGraph.test.tsx`/figure tests): multiselect toggle + `canCheck`; keyboard-path edge-draw parity with pointer through a real `RewireSurface`; reduced-motion snap (`data-reduced-motion`); registry idempotent under StrictMode.
- **Repository (emulator): Graphs case in `firestoreProgressRepository.emulator.test.ts`:** `{read, draw, same, attempts}` + `currentPart` + `completed` round-trip and resume-on-same-beat; reconcile (anon → account) unchanged.
- **One Playwright leg: `e2e/tracer.spec.ts` (or `e2e/graphs.spec.ts`):** enter Graphs (per Open Q1); play all 12 beats; the **edge-draw via keyboard fallback** commits an undirected edge and **both** the picture and the list panel update; the same-graph beat grades on adjacency, not layout; assert each graded beat gates and a reload resumes.

## Coordination notes

- **Shared-seam stability:** do **not** touch `LessonModule` / `LessonAction` / `LessonProgress` / `gradeAnswer`. Graphs is "a module + one registry entry," never a seam change. `LessonAction.rewire {from,to}` stays directional; Graphs keeps the **undirected normalization inside `graphsEngine.ts`**.
- **The rewire infra is shared with L3 (Linked Lists) and L4 (Hash Tables).** Keep `src/components/rewire/*`'s public API stable. **Consume `useRewireNode` / `RewireSurface` / `RewireSource` / `RewireTarget` / `core.ts` read-only**; importing is fine, **editing is not**. Add only a **new spatial presentation** (the node-link canvas), exactly as L3 did. The `rewire/imports.test.ts` bundle guard must stay green. Any change you think you need to the core → stop and coordinate (it must stay compatible with both existing consumers).
- **Build split (binding):** the **build agent creates only the NEW, disjoint files** in §"(A)" and validates with a **targeted `npx vitest run`** on its own test files. It must **not** touch the shared seams in §"(B)" (it consumes `rewire/*`, `engine.ts`, `FeedbackFooter`, `AnswerCard` read-only). The **orchestrator** performs the §"(B)" integration sequentially.
- **Persistence agent:** new counter keys `read`/`draw`/`same` ride the `counters` map. Flag so analytics/dashboards expect them.
- **Heavy libs:** none added. Keep the proto bundle unchanged; Graphs ships eager/playable.
- **Unlock chain:** Graphs becomes playable but stays **locked in the path** until Heaps completes (Grounding correction #2). That's the honest derived state; surfacing/unblocking it (e.g. when Trees/Heaps ship) is out of this lesson's scope beyond the e2e seed decision.

## (A) NEW disjoint files: the build agent owns these (CONSUME shared seams read-only)

- `src/features/lesson/graphsEngine.ts` (+ `src/features/lesson/graphsEngine.test.ts`)
- `src/lessons/graphs/GraphCanvas.tsx`
- `src/lessons/graphs/AdjacencyPanel.tsx`
- `src/lessons/graphs/SameGraphView.tsx`
- `src/lessons/graphs/Stage.tsx` (+ `src/lessons/graphs/Stage.test.tsx`)
- `src/lessons/graphs.tsx` (the `LessonModule`)
- *(optional)* `src/lessons/graphs/layout.ts` for the hand-authored position maps, if cleaner than inlining on the question.

Validate with: `npx vitest run src/features/lesson/graphsEngine.test.ts src/lessons/graphs/Stage.test.tsx`.

## (B) Shared-seam integration edits: the orchestrator owns these (sequential)

1. `src/features/lesson/lessons.ts`: import + register `graphsModule` in `LESSONS`.
2. `src/lessons/catalog.ts`: drop the `graphs` `load` thunk (→ playable + eager).
3. Delete `src/lessons/future/Graphs.tsx`.
4. `src/lessons/catalog.test.ts`: update playable/lazy assertions (add `graphs`; lazy set = `{trees, heaps}`).
5. `src/dev/GalleryApp.tsx`: add the `graphs` `LessonLab` group + presets (per-beat canned states).
6. `src/features/progress/firestoreProgressRepository.emulator.test.ts`: add the Graphs round-trip/resume case.
7. `e2e/tracer.spec.ts` (or a new `e2e/graphs.spec.ts`). Add the Graphs leg + `drawEdgeByKeyboard`/`tapNeighbors` helpers, gated on the Open Q1 unlock decision.

Run `npm run lint && npx tsc -b && npm run test` after each integration step; add emulator + e2e last; re-run the full set before declaring done (delegate to `verifier`/`test-runner`).

## Open questions for the human (resolve before / during the build)

1. **E2E entry into Graphs (blocking the Playwright leg).** Graphs is unreachable through the completion chain (Trees/Heaps are previews; no deep link). Options: **(a)** seed `trees`+`heaps` as completed for the test uid (emulator write) so the course path opens Graphs. *Recommended, honest, fully end-to-end*; **(b)** ship a Stage-level **dom** keyboard-draw test now and defer the Playwright leg until Trees/Heaps are playable. Which?
2. **Multi-select commit UX (spec flags this as still-open).** Confirm: tap-to-toggle the neighbor set + an explicit **Check** (recommended; reuses `canCheck`), vs auto-check on each tap; and degree shown as a **live count** of the current selection vs revealed only on correct. (Recommend explicit Check + live count.)
3. **Draw commit semantics.** A new legal draw **replaces** the single pending edge ("one edge at a time", mirrors Hash `placement`) vs **accumulates** like LL `writes` (verdict still set-equality). (Recommend replace.)
4. **Curated instance choice for the staged beats.** same-graph (11): curate the **"same"** (moved-node) case as the headline aha, with the "different" variant in tests/variant pool? tree-or-not (12): curate **G6 "general graph"** (spot the cycle)? read-path (5): curate the **`path`** subtype (the locked bounded reachability read)? (Recommend yes to all; makers + tests cover both variants either way.)
5. **Transit skin fidelity (beat 9).** A light token-scoped subway card (like LL's Spotify wrapper) vs a fuller transit map UI. (Recommend the light scoped skin.)
