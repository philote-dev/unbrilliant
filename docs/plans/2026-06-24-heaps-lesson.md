# Plan: Willow (Heaps Lesson (L6)) hand-rolled dual tree+array `HeapDualView` + de-cued sift predict + index-map locate (tap-only, eager)

> Source of truth: `docs/lessons/heaps.md`, the LOCKED, grilled spec. Honor it exactly: **11 beats, gate = 8 (sift-up ×2 / sift-down ×2 / index-map ×2 / contrast ×2)**; mechanics **Predict-next-state (sift) + Locate-the-position (index-map)**; **max-heap, fixed**, distinct integer keys; real-world skin = **high-score leaderboard**; cost words **peek `free` / sift `barely grows` / full-sort `scales`** (never `usually free`); **tap-only** (no `rewire`). **Where the spec body and its "Grilling decisions: session Jun 24" conflict, the grilling decisions win.** Binding parents: `docs/lesson-design.md` (Principles 1–7, Determinism rules → Heaps bullet, cost house-words), `docs/design/design-system.md` (§16 dual synced tree+array, §7/§14 reduced motion), `docs/design/design-system.md` (D1 SR-only fail copy + reveal-on-Why order). Structure modeled on `docs/plans/2026-06-24-hash-tables-lesson.md`; parts/bin-counter model mirrors the shipped `hashTablesEngine.ts`.
>
> Constraints (verified in `package.json`): lint `oxlint` (`npm run lint`), unit `vitest run` node+dom (`npm run test`), typecheck/build `tsc -b` (`npx tsc -b`), emulator (`npm run test:emulator`), e2e (`npm run e2e`). Strict TS: `import type` (verbatimModuleSyntax), no enums/namespaces, `noUnusedLocals/Parameters`. Don't touch git.
>
> **Build is SPLIT.** Part A = the build subagent creates ONLY the lesson's new, disjoint files and validates with a **targeted** `npx vitest run`. Part B = the orchestrator integrates shared seams sequentially. **The build subagent must NOT touch any shared seam** (`engine.ts`, `lessonModule.ts`, `lessons.ts`, `catalog.ts`, `registry.tsx`, `CostReadout.tsx`, `FeedbackFooter.tsx`, `AnswerCard.tsx`, `rewire/*`, `GalleryApp.tsx`, the emulator test, `e2e/tracer.spec.ts`).

## Goal

Ship **Heaps** as the next playable `LessonModule<HeapsState>` on the existing shared seam: a **hand-rolled, dual synced tree + array** figure (`HeapDualView`), a node-link complete-tree (top) over an `ArrayRow`-style index strip (bottom) with `2i+1`/`2i+2`/`(i-1)/2` connectors drawn in **both** panels and synchronous swap animation. Driving two mechanics: **de-cued sift predict** (insert→sift-up; extract→sift-down, larger-child-first) and **index-map locate** (tap a slot). 11 narrative beats; **8 graded** behind the until-correct wall, aggregated into a **2/2/2/2** gate across four bins (`siftUp` / `siftDown` / `mapping` / `contrast`). It reuses (unchanged) the shared feedback machine + flame (`gradeAnswer`), `FeedbackFooter`, `AnswerCard` (with its `data-answer` hook), `CostReadout`, `StatusChip`, and the durable `LessonProgress` shape. **Tap-only: it consumes NO `src/components/rewire/*` and emits no `{type:"rewire"}`: every commit is the existing `{type:"select"}`.** **No shared-engine edit, no new `LessonAction`, no heavy libs**, per the grilling decision it ships **eager/playable like Arrays**, with nothing to lazy-load.

### Reused vs lesson-specific

| Reused unchanged | Lesson-specific (new: Part A) |
|---|---|
| `gradeAnswer` / `LessonAction` / `LessonProgress` / `Feedback` (`src/features/lesson/engine.ts`) | `src/features/lesson/heapsEngine.ts` (+ `.test.ts`). Pure sift/map/contrast helpers, curated max-heaps, 4 bin counters, verdicts, selectors, resume/progress |
| `CostWord` union (`src/components/willow/CostReadout.tsx`): uses only `free` / `barely grows` / `scales` | `src/lessons/heaps/HeapDualView.tsx`, hand-rolled tree+array, drawn connectors, synchronous swap, local step-replay, reduced-motion |
| `FeedbackFooter` (default `selected` gate. **No `canCheck` needed**), `AnswerCard` (`data-answer`), `StatusChip` | `src/lessons/heaps/Stage.tsx` (+ a colocated `*.test.tsx`), `src/lessons/heaps.tsx` (the module) |
| `ArrayRow` token styling (`src/lessons/arrays/ArrayRow.tsx`), `motion`'s `useReducedMotion` | (any small `ArrangementCard` / leaderboard-skin helper colocated under `src/lessons/heaps/`) |
| `LessonModule` contract, `LessonPlayer`, `useLessonRun`, persistence repo, catalog derivation | **Part B wiring only:** `lessons.ts`, `catalog.ts`, `GalleryApp.tsx`, the emulator case, the e2e leg, delete `future/Heaps.tsx` |
| **Not consumed:** `src/components/rewire/*` (no drag), `d3-hierarchy` (hand-rolled), any shared step-transport (deferred) | - |

## Grounding in the repo (verified: read before slicing)

**The curated 1:1-part + bin-counter model already ships in `hashTablesEngine.ts`**, mirror it (NOT Arrays' quota-of-identical). It is the right pattern for the spec's "fixed curated set of distinct problems." Verified shape:
- `HASH_PARTS` is a `const` tuple, one id per beat; `enterPart` builds the beat's question; `next` just advances `partIndex`; the last part sets `completed:true`.
- Bins are capped counters bumped via `bumpBin` (`Math.min(BIN_QUOTA, …)`); `isCompleteHash` = all bins ≥ quota; `partQuotaHash` returns the *current bin's* progress.
- `select` records `selected`; `check` grades `selected === q.answer`, runs `gradeAnswer`, bumps the bin on correct; `reveal`/`reattempt` mirror Arrays.

**The shared, stable seams to build on (do not edit):**
- `gradeAnswer` (`engine.ts:332`): nudge on 1st wrong, **fail at `WRONG_LIMIT=2`**, combo climbs on correct and breaks only on a full fail. Only "which counter to bump" is lesson-specific.
- `LessonAction` (`engine.ts:68`) **already includes `{type:"select"; letter:string}`**, the only action Heaps needs for every commit (arrangement-card id for H1/H2/H4; a slot id for H3). `{type:"rewire"}` exists but **Heaps must not emit it.** No new action type.
- `LessonProgress`/`ResumeProgress` (`engine.ts:421-435`): durable slice = `counters: Record<string, number>` + `currentPart: string` + `completed`. New keys `siftUp`/`siftDown`/`mapping`/`contrast` (+`attempts`) ride it with **no shape change, no migration** (Heaps is newly playable. No old docs).
- `LessonModule` contract (`lessonModule.ts:16`): `create`, `reducer`, `toProgress`, `resume`, `hasProgress`, `totalParts`, `filledParts`, `combo`, `completed`, `Stage`.
- `CostReadout` `CostWord = "free" | "barely grows" | "scales" | "usually free"` (`CostReadout.tsx:11`). Heaps uses **`free`, `barely grows`, `scales`**; **never `usually free`** (Arrays-only, per `lesson-design.md` §3).
- `FeedbackFooter` (`FeedbackFooter.tsx:17`) takes an optional `canCheck`; default gate is `selected != null`. **Heaps needs no override** (no drag). Pass `hideFailHint` (D1 SR-only fail copy) like the Hash/Arrays stages.
- `AnswerCard` (`AnswerCard.tsx`) emits `data-answer="1"` (DEV) when `answerMarker` is set. The e2e winner hook. The `fail`+`showWhy` paint rule (selected→red, answer→green only after Why) is wired in `arrays/Stage.tsx`/`hashTables/Stage.tsx`: copy it.
- Reference engine/stage to mirror: `hashTablesEngine.ts` (curated parts + bins + verdicts) and `arraysEngine.ts` (const-tuple `PARTS`, copied seeded `rngNext/rngInt/shuffle`, MCQ recipe: **correct-first → deterministic distractors → de-dupe → seed-shuffle**). Stages: `hashTables/Stage.tsx` (intro/locate/MCQ routing, `BinHeader`, cost-on-correct, `hideFailHint`) and `arrays/Stage.tsx` (`AnswerCard` paint states, `ArrayRow`).
- `ArrayRow` (`arrays/ArrayRow.tsx`): horizontal `flex` of `motion.button` cells (`cells: string[]`, value on top + index beneath), a single `highlight` index, optional `onTap(i)`. Lilac `border-lilac-strong bg-lilac-soft` on highlight. **Numbers must be mapped to strings.**
- `useReducedMotion` precedent: `linkedLists/NodeGraph.tsx`, `linkedLists/PlaylistQueue.tsx`, `stacksQueues/Stage.tsx`, `stacksQueues/cell.tsx`. The global reduced-motion CSS only neutralizes CSS transitions, so JS/`motion` animation must guard with `useReducedMotion()` → snap.
- Test infra: `vitest` node project (`src/**/*.test.ts`) + dom project (`src/**/*.test.tsx`, jsdom + Testing Library). Figure dom-test precedent: `hashTables/HashBox.test.tsx` (render with a constructed question, assert structure + interaction). Emulator round-trip: `firestoreProgressRepository.emulator.test.ts` (S&Q + LL + **Hash** cases to copy. The `hana` case is the template). Single Playwright tracer: `e2e/tracer.spec.ts`.
- The current playable registry is already at four lessons (`lessons.ts`: S&Q, Arrays, Linked Lists, **Hash Tables**); `catalog.ts` has **no `load`** for the first four.

### Grounding corrections: stale assumptions that are wrong against the code / spec body

1. **`d3-hierarchy` is STALE: the grilling decision overrides the spec body.** `heaps.md` body says "lazy-load `d3-hierarchy` for the tree layout" (lines 218–219, 240–244, 283–285). The **locked grilling decision** (lines 310–311) is **hand-rolled complete-tree layout** (slot `i` → row/position by arithmetic), **no `d3-hierarchy`, no heavy lib.** Consequence chain to honor everywhere: Heaps ships **eager/playable like Arrays** → **no `load` thunk, no dynamic `import()`, no `React.lazy`, no change to `src/lessons/registry.tsx`, no per-lesson chunk.** (`d3-hierarchy@3.1.2` *is* in `package.json` deps, but Heaps must not import it, and neither `@xyflow/react`/`d3-force`/`gsap`.)
2. **Parts model = curated 1:1 (Hash/LL), NOT Arrays' quota-of-identical.** The spec body says "Mirror `arraysEngine.ts`," but `arraysEngine.ts` repeats one part N times to a quota (`SHIFT_QUOTA` etc.). The spec's "fixed curated set of 8 distinct problems (no quota-of-identical)" requires the **Hash Tables** shape: one `const`-tuple part per beat, bins as capped counters. Mirror Arrays only for *file layout, seeded rng, and selector naming.*
3. **`partQuota` → cumulative "n of 8", NOT Hash Tables' per-bin header.** The shipped `partQuotaHash` returns per-bin progress (e.g. "Hash · 1/3"). The spec asks for **"n of 8"**, so define `partQuotaHeaps` to return the cumulative graded count out of 8 (sum of the four capped counters), and let the Stage header show the bin label + "… · n / 8". Do **not** blind-copy `partQuotaHash`.
4. **No `placement` field, no `canCheck` override.** Hash Tables carried `placement` + `canCheckHash` for the key-into-bucket **drag**. Heaps is **tap/MCQ-only**: every commit is `select`, so `selected` is the only working field, the default `selected != null` Check gate suffices, and there is **no `placement`** and **no `rewire` case** in the reducer. Strictly simpler than Hash.
5. **Beat 11 is two graded asks → the engine has 12 parts.** The spec narrates **11 beats**, but beat 11 counts **✓✓** (contrast-placement + same-data). To keep "8 *distinct* graded problems" literal and avoid a quota-of-identical, split beat 11 into two `HEAPS_PARTS` ids (`contrast-place`, `contrast-samedata`). Net: `HEAPS_PARTS.length = 12`, `totalParts = 12` (drives the progress bar), `gate = 8 distinct graded`.
6. **Step transport is NOT a shared component yet (deferred).** `arrays/ArrayRow.tsx:7-9` notes step-scrubbing stays deferred. The spec's "shared step transport" is aspirational. Implement the de-cued **why-replay** as a **lesson-local stepper** over the engine's precomputed sift `path: SwapStep[]` (local `useState` index + Prev/Next/Replay); reduced-motion snaps to end-state. Do **not** build or depend on a shared step-transport seam.
7. **THE BLOCKER: Heaps sits behind the still-preview Trees (L5) in the catalog.** `catalog.ts:64-66` orders `… trees (load) , heaps (load) , graphs (load)`. `isLessonUnlocked("heaps")` (`catalog.ts:99`) requires `progress["trees"]?.completed === true`; Trees is a preview that never completes, so `derivePathNodes` marks **heaps "locked"** even once playable. Then: `CourseDetail.onSelectNode` ignores locked nodes (`CourseDetail.tsx:32-35`), and `Completion`'s next-CTA picks the first `current|available` node (`Completion.tsx:33-35`), after Hash Tables that is **none**, so the CTA reads "Back to course." **So a registered, playable Heaps is unreachable via the in-app course path, and the sequential e2e tracer (which walks "Continue to X" CTAs) cannot reach it, until Trees ships.** (The Gallery lab, unit/dom tests, and the emulator round-trip do **not** depend on the path, so those still fully exercise Heaps.) This is the #1 open question. *(Verified: making Heaps playable-but-locked does **not** regress the existing tracer. Heaps stays locked, so the post–Hash-Tables flow is unchanged.)*
8. **`src/lessons/registry.tsx` needs NO edit**: `FUTURE_LESSONS` is derived from catalog `load` thunks; dropping heaps' thunk auto-removes it from the lazy previews.
9. **Delete only `future/Heaps.tsx`.** `future/_shell.tsx` is shared by `future/Trees.tsx` and `future/Graphs.tsx` (verified): keep it and them.

## Decisions (settled before slicing)

- **Engine location:** `src/features/lesson/heapsEngine.ts` (matches every shipped engine; node-test glob `src/**/*.test.ts`). Stage + figures colocate under `src/lessons/heaps/`. Module wrapper `src/lessons/heaps.tsx`.
- **Parts model:** **12 parts, one per beat** (beat 11 split into `contrast-place`/`contrast-samedata`), advanced linearly via `continue` (intro/teach) / `next` (graded). **Gate counters aggregate by bin** (capped at `BIN_QUOTA = 2`): `siftUpCorrect` / `siftDownCorrect` / `mappingCorrect` / `contrastCorrect`. `isCompleteHeaps = all four ≥ 2`. `totalParts = 12`.

```ts
export const HEAPS_PARTS = [
  "demo",             // 1  intro free-play: tap-insert; lands at next slot+leaf, sifts up; both panels sync
  "teach-array",      // 2  teach: "it secretly lives in an array", 2i+1 / 2i+2 / (i-1)/2 drawn in both
  "teach-rule",       // 3  teach: the heap rule. Parent beats both children, and that's ALL (not a BST)
  "siftup-1",         // 4  H1 insert K → arrangement after sift-up (de-cued)            siftUp     ✓ (RISKIEST)
  "siftup-skin",      // 5  H1 leaderboard: a new score rises to its rank (sift-up)      siftUp     ✓
  "teach-extract",    // 6  teach/demo: extract top. Last→root, sift DOWN, larger child first
  "siftdown-1",       // 7  H2 extract top → arrangement after sift-down (de-cued)       siftDown   ✓
  "siftdown-2",       // 8  H2 extract top → arrangement after sift-down (deeper)        siftDown   ✓
  "map-child",        // 9  H3 slot i's larger child lives at which slot? (tap)          mapping    ✓
  "map-parent",       // 10 H3 slot j. Who's its parent slot? (tap, reverse)            mapping    ✓
  "contrast-place",   // 11a H4 where does K go in a HEAP vs a BST?                       contrast   ✓
  "contrast-samedata",// 11b H4 tree node i ⇔ array cell i ("same data")                 contrast   ✓
] as const
export type HeapsPart = (typeof HEAPS_PARTS)[number]
export const HEAPS_TOTAL_PARTS = HEAPS_PARTS.length   // 12
export const BIN_QUOTA = 2                            // 2 per bin → gate of 8
```

- **Two answer modes, both `select`:** **arrangement** beats (H1/H2/H4) commit the chosen candidate-arrangement card id (`select` with the option id; cards carry `answerMarker` for the e2e). **slot** beats (H3) commit a tapped slot id `"slot-<i>"` (`select` with the slot id; the array strip's slot buttons fire `dispatch({type:"select", letter:"slot-"+i})`, and the synced tree node lights). **No `rewire`, no `placement`, no `canCheck`.**
- **Max-heap, fixed; distinct integer keys; one pinned op on a *given* heap.** insert sifts **up**; extract-top moves the **last** element to the root and sifts **down, larger child first**. Build-heap / arbitrary re-heapify are **CUT**. Every generated heap is a complete tree (unambiguous packing).
- **Sift `path` is precomputed in the engine** (`SwapStep[]`) so the why-replay is a pure render over data; the local stepper is verdict-irrelevant local UI state (like LL's `cursor`), never persisted, never affecting the verdict.
- **Cost words:** peek = `{word:"free", count:1, unit:"jump to the top"}`; sift = `{word:"barely grows", count:<swaps>, unit:"swaps to sift"}`; full sort = `{word:"scales", count:<n>, unit:"items sorted"}`. Shown paired (sift `barely grows` vs sort `scales`; peek `free`) on correct sift/teach beats. **No halving visual** (Trees-only). Matches the retired preview (`future/Heaps.tsx` used `barely grows`, count 2, "swaps to sift").
- **No new `LessonAction`, no new shared widget, no heavy libs.** Plain React + `motion`; hand-rolled SVG tree; `ArrayRow`-styled strip.

### Proposed engine shapes (for the executor)

```ts
import { gradeAnswer, type Feedback, type LessonAction, type LessonProgress } from "@/features/lesson/engine"
import type { CostWord } from "@/components/willow/CostReadout"

/* pure heap helpers (max-heap; distinct integer keys) */
export const parentIndex = (i: number) => (i - 1) >> 1
export const leftIndex  = (i: number) => 2 * i + 1
export const rightIndex = (i: number) => 2 * i + 2
/** index of the larger existing child of i, or -1 if i is a leaf. */
export function largerChildIndex(heap: number[], i: number): number {
  const l = leftIndex(i), r = rightIndex(i)
  if (l >= heap.length) return -1
  if (r >= heap.length) return l
  return heap[l] > heap[r] ? l : r       // distinct keys ⇒ never a tie
}
export interface SwapStep { a: number; b: number }   // indices swapped, in order

/** insert: append, then swap up the parent chain while the child beats its parent. */
export function siftUp(heap: number[], key: number): { result: number[]; path: SwapStep[] } {
  const out = [...heap, key]; const path: SwapStep[] = []
  let i = out.length - 1
  while (i > 0 && out[i] > out[parentIndex(i)]) {
    const p = parentIndex(i)
    ;[out[i], out[p]] = [out[p], out[i]]; path.push({ a: i, b: p }); i = p
  }
  return { result: out, path }
}

/** extract-top: last→root, drop last, swap down the LARGER child while it beats the node. */
export function siftDownExtract(heap: number[]): { extracted: number; result: number[]; path: SwapStep[] } {
  const extracted = heap[0]; const out = heap.slice(); const path: SwapStep[] = []
  const last = out.pop()!
  if (out.length) { out[0] = last; let i = 0, c = largerChildIndex(out, i)
    while (c !== -1 && out[c] > out[i]) { [out[i], out[c]] = [out[c], out[i]]; path.push({ a: i, b: c }); i = c; c = largerChildIndex(out, i) } }
  return { extracted, result: out, path }
}

export const mappingAnswer = (heap: number[], i: number, dir: "largerChild" | "parent") =>
  dir === "parent" ? parentIndex(i) : largerChildIndex(heap, i)

/* invariants the tests assert on every curated/generated heap */
export const hasDistinctKeys = (h: number[]) => new Set(h).size === h.length
export const isMaxHeap = (h: number[]) =>
  h.every((_, i) => i === 0 || h[parentIndex(i)] > h[i])

export type HeapBin = "siftUp" | "siftDown" | "mapping" | "contrast"
export type HeapMode = "intro" | "arrangement" | "slot"

export interface HeapOption { id: string; heap: number[]; label?: string }  // candidate arrangement
export interface HeapCost { word: CostWord; count: number; unit: string }

export interface HeapsQuestion {
  kind: HeapsPart
  bin: HeapBin | null
  mode: HeapMode
  prompt: string
  heap: number[]                 // the GIVEN heap (distinct keys, valid max-heap)
  insertKey: number | null       // H1 / contrast-place
  resultHeap: number[]           // the correct arrangement (sift), answer's heap
  path: SwapStep[]               // ordered swaps for the why-replay stepper
  extracted: number | null       // H2 (== heap[0])
  slotIndex: number | null       // H3 / 11b: the i asked about
  dir: "largerChild" | "parent" | null   // H3
  options: HeapOption[]          // arrangement cards (H1/H2/H4); [] for slot beats
  answer: string                 // winning option id, or "slot-"+index for H3
  leaderboard: boolean           // H1 skin flag (beat 5)
  cost: HeapCost | null
  sortCost: HeapCost | null      // the "scales" full-sort shown paired against the sift
  hint: string; nudge: string; correct: string; why: string
}

export interface HeapsState {
  seed: number; rngState: number; partIndex: number
  siftUpCorrect: number; siftDownCorrect: number; mappingCorrect: number; contrastCorrect: number  // 0..2 each
  attempts: number
  question: HeapsQuestion | null
  selected: string | null        // option id (arrangement) OR "slot-"+i (slot), the only working field
  wrongCount: number; feedback: Feedback; revealed: boolean; showWhy: boolean
  combo: number; completed: boolean
}
```

- **Curated worked-values fixture (illustrative: the build agent pins exact values in `heapsEngine.test.ts`, like Hash's `BEATS`).** All distinct keys, all valid max-heaps, each path unique:

| beat | given heap | op | correct result | seeded distractors (each a named misconception) |
|---|---|---|---|---|
| 4 `siftup-1` | `[7,5,6,3,2]` | insert `8` | `[8,5,7,3,2,6]` (2 swaps) | sorted/BST `[8,7,6,5,3,2]`; off-by-one (stop early) `[7,5,8,3,2,6]`; wrong-direction (appended, no sift) `[7,5,6,3,2,8]` |
| 5 `siftup-skin` | leaderboard heap e.g. `[90,70,60,30,20]` | insert `80` | sift-up result | sorted; off-by-one; wrong-direction |
| 7 `siftdown-1` | `[9,7,6,3,2]` | extract top (9) | `[7,3,6,2]` | smaller-child-first `[6,7,2,3]`; stop-too-early `[7,2,6,3]`; sorted `[7,6,3,2]` |
| 8 `siftdown-2` | `[10,9,5,8,7,4,3]` | extract top (10) | larger-child-first result (deeper) | smaller-child-first; stop-too-early; sorted |
| 9 `map-child` | `[9,7,6,3,2]` | larger child of slot `0` | `slot-1` | `slot-2` (smaller child); `slot-3` (a grandchild); 1-indexed off-by-one |
| 10 `map-parent` | `[9,7,6,3,2]` | parent of slot `4` | `slot-1` | `slot-0`; `slot-3`; 1-indexed off-by-one |
| 11a `contrast-place` | given heap + K | heap final slot (next open → sift-up) | **heap slot** | **BST by-value descent slot** (the headline distractor); next-open-slot-no-sift |
| 11b `contrast-samedata` | given heap, tree node `i` | array **cell i** | `slot-i` | a by-value-sorted cell; an off-by-one cell |

  Distractors built with deterministic helper variants (`siftUp` stop-one-early; a `siftDownSmallerChild` twin; `[...heap,key].sort((a,b)=>b-a)` for the sorted/BST card; "appended-no-sift"), then **correct-first → de-dupe → `shuffle(options, seed)`** (the Arrays/Hash recipe).

- **Selectors:** `currentPartHeaps`, `isTerminalHeaps` (`feedback==="correct"||"fail"`), `filledPartsHeaps` (`completed ? 12 : partIndex`), `partQuotaHeaps` → **cumulative `{done: min(2,siftUp)+…+min(2,contrast), total: 8}`** (null on intro/teach), `isCompleteHeaps`, `hasProgressHeaps`.
- **Persistence:** `toProgressHeaps` → `counters:{ siftUp, siftDown, mapping, contrast, attempts }`, `currentPart`, `completed`; `resumeHeaps` rebuilds at the saved part with clamped counts and a **cold combo** (mirrors `resumeHashTables`).

## The 11-beat → bin → graded → mechanic table (the spec's flow, honored)

| # | Beat | Type · bin | Mechanic | Mode (commit) | Graded |
|---|---|---|---|---|---|
| 1 | Heap demo. Free play in the dual view (tap-insert; lands at next slot+leaf, sifts up; panels sync) | intro | - | play → Continue | - |
| 2 | Teach, "it secretly lives in an array": `2i+1 / 2i+2 / (i-1)/2` drawn in both panels | teach | - | Continue | - |
| 3 | Teach, the heap rule: parent beats both children, and that's **all** (not a BST) | teach | - | Continue | - |
| 4 | "Insert K. Arrangement after sift-up?" (de-cued) | H1 · **siftUp** | Predict-next-state | arrangement card | ✓ |
| 5 | Leaderboard skin. A new score rises to its rank (sift-up, predict) | H1 · **siftUp** | Predict-next-state | arrangement card | ✓ |
| 6 | Teach/demo, extract top: last→root, sift **down**, larger child first | teach | - | Continue | - |
| 7 | "Extract the top. Arrangement after sift-down?" (de-cued) | H2 · **siftDown** | Predict-next-state | arrangement card | ✓ |
| 8 | "Extract the top. Arrangement after sift-down?" (de-cued, deeper) | H2 · **siftDown** | Predict-next-state | arrangement card | ✓ |
| 9 | "Slot i's larger child lives at which slot?" (tap the array; tree lights) | H3 · **mapping** | Locate-the-position | slot tap | ✓ |
| 10 | "Slot j. Who's its parent slot?" (reverse) | H3 · **mapping** | Locate-the-position | slot tap | ✓ |
| 11 | Contrast (synthesis): heap-vs-BST placement (11a) + tree↔array same-data (11b) | H4 · **contrast** ×2 | Locate (distractor-killed Classify) | card / slot tap | ✓✓ |

**Gate (derived, not invented): 8 = 2×4 sub-skills.** Two reps per sub-skill prove the rule, not luck. Behind the until-correct wall; **revealed/failed never count.** Flame/combo spans the 8 (consecutive correct; breaks only on a full fail). Two **idea-bearing** mechanics only (sift predict + index-map locate); the contrast is killed by a sorted/BST distractor inside H4, not by a third mechanic.

## Tracer-bullet slices, Part A: NEW disjoint files (build subagent; do NOT touch shared seams)

Each Part-A slice is full-stack within the new files and validated with a **targeted** `npx vitest run` of just its own test files (+ `npx tsc -b` + `npm run lint`). **Build the riskiest beat first** (the de-cued sift-up predict (beat 4)) because it exercises the whole signature figure (hand-rolled tree layout + synced array + drawn connectors + synchronous swap + reduced-motion + step-replay) and the predict mechanic at once.

### Slice A1, De-risking tracer: the de-cued sift-up predict (beats 1–4)
**Engine (`heapsEngine.ts`):** the pure helpers (`parentIndex`/`largerChildIndex`/`siftUp` + `isMaxHeap`/`hasDistinctKeys`); `HEAPS_PARTS`; `createHeaps`/`enterPart`/reducer for `demo`/`teach-array`/`teach-rule`/`siftup-1`; the H1 maker (correct via `siftUp` + the three seeded distractors, de-duped + seed-shuffled); `select`+`check` grading the `siftUp` bin; selectors (`currentPartHeaps`/`isTerminalHeaps`/`partQuotaHeaps`); cost `barely grows` + paired `scales`.
**Figure (`heaps/HeapDualView.tsx`): the biggest risk:** hand-rolled complete-tree layout (`depth=floor(log2(i+1))`, `posInRow=i-(2^depth-1)`, `x=(posInRow+0.5)/2^depth`, `y=depth·rowH`) → SVG circles + parent→child edges + value + faint index + **`TOP` marker on slot 0**; `ArrayRow`-styled index strip beneath; **drawn connectors** to `2i+1/2i+2/(i-1)/2` in **both** panels for the active/selected slot; **synchronous swap** lift of the two nodes + two cells; `useReducedMotion()` → snap (no lift/connector-draw/step). A small **local step-replay** (Prev/Next/Replay over `question.path`). DEV-only `data-answer` flows through `AnswerCard`; for slot beats add a DEV `data-heap-correct-slot` hook (used in A3).
**Stage (`heaps/Stage.tsx`):** routes `demo`/`teach-*` (Continue) + an `ArrangementPart` (the dual view + candidate `AnswerCard`s, each rendering a compact arrangement; `hideFailHint`, default `selected` gate, cost-on-correct). Colocated `heaps/HeapDualView.test.tsx`.
**Targeted validation:** `npx vitest run src/features/lesson/heapsEngine.test.ts src/lessons/heaps/HeapDualView.test.tsx` + `npx tsc -b` + `npm run lint`.
**Acceptance:** `siftUp` correct **and unique** for the curated case; result is a valid max-heap with distinct keys; the three distractors are distinct + all wrong; beat-4 correct → combo+1, `siftUpCorrect=1`; wrong → nudge → **fail at `WRONG_LIMIT=2`**, counter untouched on fail; same seed → identical question/options/path; connectors render for the active slot; **reduced-motion snaps** (dom test); the answer card carries `data-answer` in DEV.

### Slice A2: Sift-down extract (beats 5–8)
**Engine:** `siftDownExtract` (+ a `siftDownSmallerChild` twin for the distractor); makers for `siftup-skin` (leaderboard flag), `teach-extract`, `siftdown-1`, `siftdown-2`; assert `extracted === heap[0]`; bump `siftDown`.
**Figure/Stage:** reuse `HeapDualView` + `ArrangementPart`; the why-replay steps the **down** path (larger-child-first) one swap at a time; leaderboard skin = a light token-scoped wrapper (à la LL's Spotify wrapper) over the same dual view.
**Acceptance:** extract correct + unique (larger-child-first); `extracted==heap[0]`; smaller-child-first / stop-too-early / sorted distractors distinct + wrong; deeper case travels ≥2 levels; `siftDownCorrect` caps at 2; reduced-motion snaps.

### Slice A3: Index-map locate (beats 9–10)
**Engine:** `mappingAnswer`; makers for `map-child` (largerChild) / `map-parent` (parent); answer = `"slot-"+index`; `select` records `"slot-i"`; bump `mapping`.
**Figure/Stage:** a `SlotLocatePart`, the array strip's slot buttons tap-commit (`select`), the synced tree node lights, connectors draw `2i+1/2i+2/(i-1)/2`; DEV `data-heap-correct-slot` on the winning slot for the tracer; SR announces the map ("slot 1's children are slots 3 and 4; its parent is slot 0").
**Acceptance:** `child=2i+1/2i+2`, `parent=(i-1)>>1` for in-range `i`; child-asks only on nodes that have the child; tap commits the slot; correct slot exposes the DEV hook; `mappingCorrect` caps at 2.

### Slice A4: Contrast synthesis (beats 11a/11b) + module
**Engine:** makers for `contrast-place` (heap final-slot vs BST by-value descent distractor) and `contrast-samedata` (cell i vs sorted-cell distractor); bump `contrast`; the last part's `next` sets `completed:true`; `isCompleteHeaps`/`toProgressHeaps`/`resumeHeaps`/`hasProgressHeaps`.
**Module (`src/lessons/heaps.tsx`):** export `heapsModule: LessonModule<HeapsState>` (`id:"heaps"`, `totalParts:12`), mirroring `arrays.tsx`/`hashTables.tsx`.
**Acceptance:** H4 heap-attach = `length` (and post-sift slot) while the BST distractor differs; same-data answer = cell i; `isCompleteHeaps` flips **only** after 2/2/2/2; happy path reaches `completed` with `combo=8`; failed/revealed never count; `resumeHeaps` lands on the saved part with cold combo; full targeted suite + `npx tsc -b` + `npm run lint` green.

## Part B: Shared-seam integration (orchestrator only; sequential)

> The build subagent must NOT do any of these. Run lint + tsc + test after each.

1. **Register:** `src/features/lesson/lessons.ts`, `import { heapsModule } from "@/lessons/heaps"` and add `[heapsModule.id]: heapsModule,` to `LESSONS`.
2. **Make playable:** `src/lessons/catalog.ts`, remove `load: () => import("@/lessons/future/Heaps")` from the `heaps` entry (line 65). Flips `isLessonPlayable("heaps")` true and **auto-drops** it from `FUTURE_LESSONS` (no `registry.tsx` edit).
3. **Retire the preview:** delete `src/lessons/future/Heaps.tsx` **only** (keep `future/_shell.tsx`, `future/Trees.tsx`, `future/Graphs.tsx`).
4. **Gallery:** `src/dev/GalleryApp.tsx`, add a `HEAPS_PRESETS: Preset<HeapsState>[]` (one per part + key feedback states, using `resumeHeaps({counters:{}, currentPart, completed:false}, SEED)` + reduced action application, mirroring `HT_PRESETS`), extend the `Selection` union + `LABS` array + the render ternary with a `"heaps"` lab.
5. **Emulator case:** `src/features/progress/firestoreProgressRepository.emulator.test.ts`, add a Heaps round-trip mirroring the `hana` case: e.g. `counters:{ siftUp:2, siftDown:1, mapping:0, contrast:0, attempts:5 }`, `currentPart:"siftdown-2"`, resumes on the same beat with `counters.siftUp===2`.
6. **E2E leg (CONDITIONAL: see open question #1):** *if and only if* Heaps is reachable (Trees shipped, or a deep-link/test affordance added), extend `e2e/tracer.spec.ts` to continue into Heaps after the prior lesson, play all 12 parts to completion (arrangement beats via `data-answer`; slot beats via a new `answerHeapSlot` helper reading `data-heap-correct-slot`; assert each graded beat gates and the reduced-motion path snaps), and assert "You mastered Heaps." **Default (Trees still a preview): DO NOT extend the tracer**, leave a TODO; Heaps is proven by A1–A4 + the emulator case + the Gallery.
7. *(Optional polish)* `src/screens/Completion.tsx` `COMPLETION_CHECKS` has entries only for `stacks-and-queues`/`arrays` (LL + Hash already ship without). Adding `heaps: ["Sift", "Mapping", "Contrast"]` is a 1-line nicety. Consistent to skip.

## Stories → slices matrix

| Beat (flow #) | Type · bin | Graded? | Commit | Slice |
|---|---|---|---|---|
| 1 demo · 2 teach-array · 3 teach-rule | intro/teach | - | play / Continue | A1 |
| 4 insert→sift-up | H1 · siftUp | ✓ | arrangement card | **A1 (de-risking tracer)** |
| 5 leaderboard sift-up | H1 · siftUp | ✓ | arrangement card | A2 |
| 6 teach-extract | teach | - | Continue | A2 |
| 7 extract→sift-down · 8 deeper | H2 · siftDown | ✓✓ | arrangement card | A2 |
| 9 larger child · 10 parent | H3 · mapping | ✓✓ | slot tap | A3 |
| 11a heap-vs-BST · 11b same-data | H4 · contrast | ✓✓ | card / slot tap | A4 |
| module wrapper | - | - | - | A4 |
| register · catalog · delete preview · gallery · emulator · (e2e) | - | - | - | **B** |

## Risks & mitigations

- **(Blocker) Heaps unreachable behind preview Trees (highest).** Sequential unlock + Completion CTA + CoursePath locking gate Heaps on `trees.completed`, which never happens. → **Open question #1.** Default: ship playable + registered + gallery + unit/dom/emulator; **defer the e2e leg.** Heaps still fully exercised off-path. *(Verified no regression to the existing tracer.)*
- **`d3-hierarchy` temptation (high).** The spec body repeatedly says lazy-load it. → **Hand-rolled arithmetic layout only**; assert in review that `heaps/*` imports neither `d3-hierarchy` nor `@xyflow/react`/`d3-force`/`gsap`, and that `catalog.ts` has **no** `load` for heaps (eager).
- **The signature figure is the real complexity** (synced tree+array, drawn connectors in both panels, synchronous swap, step-replay, reduced-motion). → Build it **first** (A1) against beat 4; one `HeapDualView` reused by every graded part; every `motion` animation gated behind `useReducedMotion()` → snap; a dom test pins the reduced-motion + connector + slot-tap contract.
- **Arrangement cards busy on 390px** (rendering a full mini dual-view per candidate). → **Open question #4**: recommend compact **array-row chips** for candidates beneath the single shared dual view, not four mini tree+array figures.
- **Step transport doesn't exist as a shared seam.** → Lesson-local stepper over the precomputed `path`; reduced-motion snaps; no shared step-engine dependency (deferred extraction).
- **Distractor determinism.** Sorted/BST, off-by-one, wrong-direction, smaller-child-first, stop-too-early are deterministic helper variants → correct-first, de-dupe, seed-shuffle; tests assert distinct + all-wrong + stable per seed.
- **`partQuota` divergence from Hash.** Don't copy `partQuotaHash`; implement cumulative "n of 8" (open question #2).
- **Persistence keys.** `siftUp`/`siftDown`/`mapping`/`contrast` ride the generic `counters` map (no migration) → add the emulator round-trip; notify the persistence/analytics owner so dashboards expect them.

## Test contract mapping (the three seams + determinism)

- **Engine unit (node): `src/features/lesson/heapsEngine.test.ts`** (mirror `arraysEngine.test.ts` + `hashTablesEngine` coverage): worked-values fixture; `siftUp` correct **and unique** (parent chain); `siftDownExtract` correct **and unique** (larger-child-first) with `extracted===heap[0]`; `mappingAnswer` child/parent for in-range `i`; H4 heap-attach=`length`/post-sift slot ≠ BST distractor; distractor sets distinct + all wrong + stable per seed; `gradeAnswer` nudge→fail at `WRONG_LIMIT`; gate flips **only** at 2/2/2/2; flame breaks **only** on a full fail; **determinism + structure guards**, same seed → identical heaps/paths/options/verdicts, and **every** generated heap satisfies `hasDistinctKeys` && `isMaxHeap` with a **single pinned op** (no model calls).
- **Figure (dom): `src/lessons/heaps/HeapDualView.test.tsx`** (mirror `HashBox.test.tsx`): tree nodes + array cells render for a constructed question; a slot tap fires `select("slot-i")`; connectors draw for the active slot; **reduced-motion snaps** (mock `useReducedMotion`); registry/StrictMode idempotent.
- **Repository (emulator): Heaps case in `firestoreProgressRepository.emulator.test.ts`**: `{ siftUp, siftDown, mapping, contrast, attempts }` + `currentPart` + `completed` round-trip and resume-on-same-beat; reconcile (anon → account) unchanged.
- **One Playwright leg: `e2e/tracer.spec.ts` (conditional, open question #1)**: play all 12 parts to completion; **tap-only** commits (arrangement card via `data-answer`; slot via `data-heap-correct-slot`); assert each graded beat gates and the reduced-motion path snaps; assert no rewire/drag surface mounts.

## Coordination notes

- **Shared-seam stability:** import (never edit) `gradeAnswer`/`LessonAction`/`LessonProgress`/`Feedback` (`engine.ts`), `LessonModule` (`lessonModule.ts`), `CostWord` (`CostReadout.tsx`), `FeedbackFooter`/`AnswerCard`. The four counter keys are lesson-shaped on the generic `counters` map → **no migration** (Heaps newly playable).
- **No drag coupling:** Heaps mounts **no** `rewire/*` and emits no `{type:"rewire"}`, safe to build alongside any LL/Hash/Graphs rewire work.
- **Tree-renderer reuse vs Trees (L5):** the dual view's tree half overlaps a future Trees layout. Since Trees isn't shipped and the decision is hand-rolled, **build the node-link tree once here** and factor it (a pure layout fn + a presentational tree) so L5 can consume it later; if L5 lands first, consume its layout instead. Don't edit L3's `NodeGraph`/`graphLayout`.
- **Heavy libs:** none added. Proto bundle unchanged.

## Recommended build order & green baseline

**Baseline (verify first):** `npm run lint && npx tsc -b && npm run test` pass (four lessons shipped). If red, fix the baseline before A1.
**Order:** A1 (beat 4 first as the de-risking tracer → demo/teach) → A2 (sift-down) → A3 (mapping) → A4 (contrast + module). Targeted `npx vitest run` after each. Then **B** sequentially (register → catalog → delete preview → gallery → emulator → e2e-if-reachable). Re-run the full set (`lint`, `tsc -b`, `test`, `test:emulator`, and `e2e` if extended) before declaring done. Delegate to `verifier`/`test-runner`.

## Open questions for the human (resolve before slicing)

1. **(Decision-blocking) Heaps is gated behind the still-preview Trees (L5).** Once playable, Heaps shows **locked** on the path (unlock needs `trees.completed`), the Completion CTA after Hash Tables reads "Back to course," and the **sequential e2e tracer cannot reach Heaps.** Pick one: **(A)** ship Trees (L5) first (clean, but out of this build's scope); **(B, recommended)** ship Heaps playable + registered + gallery + unit/dom/emulator now and **defer the e2e leg** until Trees lands (Heaps stays correctly off-path; no regression); **(C)** add a deep-link/test affordance (e.g. URL-seeded initial `Screen`) so the e2e can drive Heaps directly, but that edits shared navigation and needs sign-off.
2. **`partQuota` header:** cumulative **"n of 8"** (per the spec instruction, recommended) vs Hash Tables' per-bin "n of 2."
3. **Beat-11 modeling:** **12 engine parts** (split 11a/11b. Keeps "8 distinct problems," recommended) vs 11 parts with an internal 2-quota on the contrast part (reintroduces quota-of-identical).
4. **Arrangement-card rendering:** compact **array-row chips** beneath one shared dual view (recommended for a 390px phone) vs a full mini tree+array per candidate (faithful but busy).
5. **Leaderboard skin fidelity (beat 5):** light **token-scoped** high-score wrapper (recommended, à la LL's Spotify skin) vs a fuller styled board. *(Spec "Still open.")*
6. **Step-replay scope:** a full local **Prev/Next/Replay** stepper over the sift path (recommended, the de-cued correction is core) vs a single one-shot animated replay on "Why?".
