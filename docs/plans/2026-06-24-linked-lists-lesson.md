# Plan: Willow (Linked Lists Lesson (L3) rebuild) literal-arrow `NodeGraph` + write-order rewire

> Source of truth: `docs/lessons/linked-lists.md`, and specifically its **locked** bottom sections ("Grilling decisions & build-state", "Arrow/interaction architecture (LOCKED)", "Content decisions. LOCKED"), which **override** the spec body where they conflict (7 graded / gate beats 3–9, *not* 8 / 3–10). Binding parents: `docs/lesson-design.md` (closed mechanic menu, cost-by-feel/no-Big-O, learn-by-doing, mastery gate, tap-first/gesture-where-it-teaches) and `docs/design/design-system.md` (visual language; reduced-motion bar §7/§14). Structure modeled on `docs/plans/2026-06-24-drag-rewire-infra.md`.
>
> This supersedes the prior slice-1 plan that lived at this path (built to the old PRD).
>
> Constraints (verified in `package.json`): lint `oxlint` (`npm run lint`), unit `vitest run` (`npm run test`, node + dom projects), build `tsc -b` (`npm run build`), emulator `npm run test:emulator`, e2e `npm run e2e`. Strict TS: `import type` (verbatimModuleSyntax), no enums/namespaces (erasableSyntaxOnly), `noUnusedLocals/Parameters`. Don't touch git.

## Goal

Rebuild **Linked Lists** as the third playable `LessonModule`, replacing the slice-1 implementation (built to the old PRD) with the locked design: a **literal-arrow `NodeGraph`** figure (tidy-but-draggable nodes, each showing its `next` arrow; rewire by dragging an arrowhead) graded on **pointer-write order** enforced by an **honest, blocking orphan** (unsafe order makes the tail drift away, grey out, become un-grabbable). Ten beats; **7 graded** (beats 3–9) behind the until-correct wall; beat 10 (doubly-linked) is a generous **ungraded** teaching coda. Reuse the shared feedback machine + flame, cost readout, answer card, and the pure rewire `core.ts`; keep `LessonModule` / `LessonAction` / `LessonProgress` **stable** (no shared-engine edit required). Wire it live (register → make catalog entry playable → delete the preview).

## Grounding in the repo (verified)

**The `rewire` action already exists on the shared union** (`src/features/lesson/engine.ts`, lines ~76–78): no `engine.ts` change needed:

```
// Shared, cross-lesson rewire gesture (drag/tap/keyboard "connect from → to").
// Carries opaque source/target ids; the consuming engine decides correctness.
| { type: "rewire"; from: string; to: string }
```

**Shared, stable seams to build on (do not edit):**
- `gradeAnswer` (`engine.ts`): nudge on first wrong, fail at `WRONG_LIMIT` (2), combo climbs on correct and breaks only on a full fail. Only "which counter to bump" is lesson-specific.
- `LessonProgress` / `ResumeProgress` (`engine.ts`): durable slice = `counters: Record<string, number>` + `currentPart: string` + `completed`. **Counters are numbers only**, load-bearing for resolved open question 1 (working-state is NOT persisted).
- The module contract to implement (`lessonModule.ts:16-31`): `create`, `reducer`, `toProgress`, `resume`, `hasProgress`, `totalParts`, `filledParts`, `combo`, `completed`, `Stage`.
- The pure rewire core (`src/components/rewire/core.ts`): `isWithin` / `resolveDropTarget` / `resolveIntent` / `cycleTarget`, reuse for hit-testing + keyboard cycling. The React surface (`RewireSurface`/`RewireSource`/`RewireTarget`) already does registry + pointer-drag + tap + keyboard + one `aria-live` region + DEV hooks (`data-rewire-source/target`, DEV-only `data-rewire-legal`).
- Reference engine/stage to mirror: `arraysEngine.ts` (`const`-tuple parts, copied seeded RNG `rngNext/rngInt/shuffle`, MCQ recipe: correct-first → deterministic distractors → de-dupe → seed-shuffle) and `arrays/Stage.tsx` (quota header → figure → `AnswerCard` → `CostReadout` on correct → `FeedbackFooter`). `CostWord` is the locked union `"free" | "barely grows" | "scales" | "usually free"`; LL uses only **`scales`** (walk/reach) and **`free`** (rewire/insert).
- Test infra is ready: `vitest.config.ts` has a **node** project (`src/**/*.test.ts`) and a **dom** project (`src/**/*.test.tsx`, jsdom + Testing Library, `src/test/setup.ts`); devDeps include `jsdom`, `@testing-library/*`, `@playwright/test`. Emulator round-trip pattern lives in `firestoreProgressRepository.emulator.test.ts`; the single Playwright tracer is `e2e/tracer.spec.ts` (S&Q → Arrays today). Global reduced-motion CSS already neutralizes CSS animation/transition (`src/index.css:279`), so only JS/`motion` animation needs a `useReducedMotion()` guard.

**Slice-1 status: built to the OLD PRD, now partially superseded.** It is green but **not wired live**: `catalog.ts:62` still points `linked-lists` at the lazy preview, and `lessons.ts` `LESSONS` does **not** include `linkedListsModule`. Disposition:

| Slice-1 artifact | Keep / Rework / Delete |
|---|---|
| RNG helpers, `chainNext`/`followChain`, the seeded-maker shape, the `LessonModule` wrapper (`linkedLists.tsx`), the DEV correctness-hook idea, the test-harness structure | **Keep** (port forward) |
| `WalkChain` learner-driven tap-to-advance behavior (`NodeChain.tsx`) | **Keep** the behavior (re-home into `NodeGraph` or keep as a walk mode) |
| `linkedListsEngine.ts` verdict (`isRewireCorrect` final-adjacency), parts (`walk/rewire-insert/rewire-delete/predict`), quotas (3/3/2), `isCompleteLL`, `toProgress`/`resume` counters | **Rework** → write-order/reachability verdict; 10-beat curated flow; 7 graded; new counters |
| `RewireChain` chip-row presentation (Nodes row + Pointers row) in `NodeChain.tsx` | **Delete/replace** → new `NodeGraph` literal-arrow figure |
| `linkedListsEngine.test.ts` (slice-1 assertions) | **Rework** substantially |
| `src/lessons/future/LinkedLists.tsx` preview + its `load` thunk in `catalog.ts` | **Delete** (wiring slice) |
| Gallery "Linked Lists" lab presets (`GalleryApp.tsx`) | **Rework** to the new beats |

**Build order ≠ flow order.** The UI flow is beats 1→10, but we **build the insert (beat 4) first** as the de-risking tracer, then walk/teach/traverse (1–3), then delete/predict (5–6), then real-world/contrast (7–9), then doubly (10), then gate + wiring.

## Decision: engine file location (settled)

**Keep the engine at `src/features/lesson/linkedListsEngine.ts`** (do **not** relocate to `src/lessons/linkedLists/linkedListsEngine.ts` as the spec's build-plan loosely suggested). Rationale: every shipped lesson engine already lives in `src/features/lesson/` (`engine.ts`, `arraysEngine.ts`), the node test glob and the existing module import already target it, and relocating is pure churn against the established "engines live together" convention. New **lesson-local pure** modules (e.g. arrow-routing geometry) may live under `src/lessons/linkedLists/` and be node-tested there.

## Open questions: RESOLVED by orchestrator (Jun 24)

1. **Persist mid-question rewire working-state? → NO.** `LessonProgress.counters` is numbers-only; a pointer map can't ride it without changing the shared shape. Working-state stays **transient**: resume = same beat, fresh instance, cold combo (exactly like S&Q/Arrays). The spec's *Test contract* line about "rewire working-state round-trips" is **superseded**, the emulator test asserts the **7 counters + `currentPart` + `completed`** round-trip instead. Keeps `LessonProgress` stable.
2. **Orphan → wrong trigger? → Surface immediately, grade on Check.** The instant an unsafe write orphans the tail, the figure shows the drift/grey-out and the target is un-grabbable (no legal move remains); the wrong is registered via `gradeAnswer` on the next **Check** (reusing the unchanged `FeedbackFooter`). The stuck state must clearly cue that Check/Reattempt is the only path (no silent dead-end). Zero new feedback plumbing.
3. **L1 traverse grading affordance? → MCQ-after-walk.** The learner taps the next node to walk (the felt cost), then answers an `AnswerCard` MCQ for the value-at-k / hop-count (deterministic, reuses the shared answer card). The tap-walk is the cost; the MCQ is the graded verdict.
4. **Spotify theming scope (beat 7)? → Token-scoped to beat 7 only.** A green/black theme wrapper scoped to the playlist beat; must pass the design-system accessibility bar (contrast, lilac/visible focus, reduced-motion) and must not introduce hard-coded colors anywhere else.

## Tracer-bullet slices

Each slice is independently verifiable. Slices 1–5 ship behind the Gallery lab + their node/dom tests (exactly how slice-1 already lives. Built but behind the preview); Slice 6 flips the lesson live and adds the emulator + Playwright proofs.

### Slice 1, The de-risking tracer: `NodeGraph` + write-order insert, end-to-end

Stands up the entire risky figure and the new grading model against **one** beat (insert, beat 4) before any fan-out.

**Scope (engine, pure-first):** rebuild the core of `linkedListsEngine.ts`:
- An **ordered-write** working state: `workingNext: Record<string,string>` **plus** `writes: RewirePair[]` (the ordered log, for replay + determinism).
- Pure helpers (node-testable, no DOM): `reachableFrom(head, next): Set<string>`; `applyRewrite(state, {from,to})` = apply one write, recompute reachability, mark newly-unreachable nodes **orphaned/un-grabbable**; `grabbableSources(state)` / `legalTargets(state)` recomputed as **reachable-from-head**; a verdict selector.
- **Grading via the reachability trap-door** (this is how "order matters" is enforced, truest to the locked decisions): insert X after `prev` (= `B`) into `A→B→C→D` is correct iff the learner reaches `A→B→X→C→D` *without ever orphaning*. The **detach-on-grab** + **un-grabbable-unreachable** rules make an unsafe-first write (`B.next=X` before `X.next=C`) drop `C→D` from the reachable set and make them un-grabbable, so the target is **unrecoverable**, and the question becomes a terminal **stuck/wrong** state. Safe order (`X.next=C` then `B.next=X`) never orphans. Keep `writes` so the Why?-replay can show safe-then-broken.
- Seeded `makeInsert` (chain len 4–6, interior `prev`), `cost: { word: "free", count: 2, unit: "pointers rewired" }`.

**Scope (figure: the biggest risk):** new `src/lessons/linkedLists/NodeGraph.tsx`:
- Render nodes in a **tidy** arrangement + an **SVG arrow layer** for each node's `next`. Arrows **route above/below** so they never cross a node; **straight** only between adjacent nodes (new lesson-local pure module `graphLayout.ts` for the routing/anchor math, node-tested).
- **Arrowhead-drag rewire:** grabbing an arrowhead **detaches it on grab** (source shows no outgoing arrow mid-drag); the arrow **stretches with the cursor**; **reachable** legal targets **hover-glow**; release connects. Hit-testing via the shared `core.ts` (`resolveDropTarget`/`isWithin`); intent emitted as `LessonAction.rewire`.
- **Tap + keyboard fallback** (parity via `core.ts` `cycleTarget`, cycling **reachable** targets in a documented order): pick arrowhead → pick destination.
- **Orphan animation:** orphaned node + tail **drift away, grey out, become un-grabbable**. `useReducedMotion()` → **snap** to end-state (no stretch/drift/glow), announce via the surface's `aria-live`.
- A11y: ≥44px handles/targets, lilac focus rings, icon+text+SR, never color-alone.
- DEV hooks for the tracer: carry forward `data-rewire-correct-target` and add a `data-write-order` (1,2,…) on each source so the tracer can commit in the pinned order.

**Scope (stage + gallery):** a `RewireInsertPart` in `Stage.tsx` rendering `NodeGraph` inside `RewireSurface`; Check enables once a write has been made (reuse the slice-1 "checkReady" signal). Add a Gallery preset (idle / one-write / safe-correct / orphaned-stuck / failed). **Do not** make the catalog entry live yet.

**Files:** rework `src/features/lesson/linkedListsEngine.ts`; add `src/lessons/linkedLists/NodeGraph.tsx`, `src/lessons/linkedLists/graphLayout.ts`; rework `src/lessons/linkedLists/Stage.tsx`; rework `src/features/lesson/linkedListsEngine.test.ts`; add `src/lessons/linkedLists/graphLayout.test.ts` and `src/lessons/linkedLists/NodeGraph.test.tsx` (dom: keyboard-path intent parity + reduced-motion snap); update `GalleryApp.tsx` presets.

**Verify / acceptance:**
- [ ] Safe order (`X.next=C` then `B.next=X`) → `correct`, combo +1, `free` cost = 2, insert counter cleared.
- [ ] Unsafe first write (`B.next=X`) → `C`,`D` leave the reachable set, become un-grabbable; target unrecoverable; state is terminal-wrong → `nudge` then `fail` at `WRONG_LIMIT`; counter untouched.
- [ ] `reachableFrom` / `graphLayout` routing (above/below, straight-when-adjacent) covered by node tests; same seed → same chain + writes.
- [ ] Keyboard-only produces the **same** `(from,to)` intents as drag; reduced-motion snaps (dom test).
- [ ] `npm run test` + `tsc -b` + `npm run lint` green; Gallery preset plays manually (pointer + keyboard).

### Slice 2, Beats 1–3: node demo, teach, traverse (L1)

**Scope:** beat 1 **node demo** (NodeGraph gains **node-body reposition drag**, moving a node re-routes arrows but the list is unchanged; reduced-motion still allows reposition, no animation); beat 2 **teach** (copy: pointers are the structure; the head is sacred); beat 3 **graded traverse**, learner-driven tap-the-next-node walk (port `WalkChain`), hop count = `scales` cost; the two locked L1 asks: **"value at the k-th node"** and **"hops to reach X"** (same walk), graded as an **MCQ-after-walk** (resolved open question 3). Deterministic seeded `makeWalk` verdicts. Beat 3 is graded beat #1 of 7.

**Files:** `linkedListsEngine.ts` (walk makers + verdict, beats 1–3 in `LL_PARTS`); `Stage.tsx` (demo / teach / traverse parts; reuse `AnswerCard` for the graded result, `CostReadout` for hops); `NodeGraph.tsx` (node-body drag + walk-lighting mode); tests.

**Verify:** value-at-k correct for each k; hops-to-X correct; dragging a node leaves `workingNext` unchanged (demo); traverse gates (must clear to advance); only the immediate-next node is tappable (no jump).

### Slice 3, Beats 5–6: delete (L3) + predict-the-break (L4)

**Scope:** beat 5 **delete = one move**, drag `prev`'s arrow from `cur` to `cur.next` (`prev.next = cur.next`); bypassed node auto-drifts off as unreachable (in a pointer world, bypassing *is* deleting); `cost: free, 1 pointer`. Beat 6 **predict-the-break**, MCQ (`AnswerCard`) with the locked choices **{works fine (order doesn't matter) · the rest of the list is lost ✓ · the list loops forever}**; the figure can replay the unsafe order orphaning the tail. Both graded (beats #2 and #3 of 7).

**Files:** `linkedListsEngine.ts` (`makeDelete`, `makePredict` + verdicts); `Stage.tsx` (delete reuses the rewire part; predict reuses the answer-card part); tests.

**Verify:** delete safe move → correct, bypassed node unreachable; predict verdict = `orphaned_tail` for the unsafe order; distractors deterministic; both gate.

### Slice 4, Beats 7–9: real-world playlist + array-vs-list ×2 (L5)

**Scope:** beat 7 **playlist "next track"**, same two-arrow rewire skinned as songs, **Spotify-style green/black theming** (token-scoped to this beat per resolved open question 4); graded. Beat 8 **array-vs-list insert**, show both: array ripple = `scales` (n−k moved, via `ArrayRow`) vs list = `free` (2 writes); graded. Beat 9 **array-vs-list reach**, array `free` (1 jump) vs list `scales` (k hops); graded. Beats #4–#6 of 7. Cost numbers pure: ripple `= n − k`, writes `= 2`, jump `= 1`, hops `= k`.

**Files:** `linkedListsEngine.ts` (real-world + two contrast makers; cost selectors); `Stage.tsx` (playlist theme wrapper; contrast layout reusing `ArrayRow` + `NodeGraph` + dual `CostReadout`); tests.

**Verify:** playlist rewire grades like insert/delete; contrast cost counts exact; the inverse trade reads on one screen; all three gate.

### Slice 5, Beat 10: doubly-linked teaching coda (UNGRADED)

**Scope:** introduce the backward `prev` arrow; the splice grows to **4 ordered writes** (`X.next=B; X.prev=A; A.next=X; B.prev=X`); walk **both directions**. Generous, guided/interactive, **not** behind the mastery wall. `IsComplete` ignores it. `NodeGraph` gains a `prev`-arrow render + bidirectional walk.

**Files:** `linkedListsEngine.ts` (`makeDoubly`, ungraded part, a "seen" flag, **not** a graded counter); `NodeGraph.tsx` (prev arrows + bidirectional walk); `Stage.tsx` (doubly part); tests for the 4-write demo.

**Verify:** the 4-write sequence is demonstrable and order-checked by a node test; beat 10 does **not** affect `isCompleteLL`; reduced-motion path works.

### Slice 6: Gate, flame, wire live, persistence, E2E, determinism

**Scope:**
- **Gate:** `isCompleteLL` = all **7** graded beats cleared (one each); `totalParts` = 10 (progress bar); flame spans the 7 via the shared combo, breaks only on a full fail (free from `gradeAnswer`).
- **Persistence:** `toProgress`/`resume` with **7 numeric counters** (each 0/1 cleared) + `attempts` + `currentPart` + `completed`; resume = same beat, fresh instance, cold combo (matches S&Q/Arrays). Working-state stays **transient** (resolved open question 1).
- **Wire live (exact steps):**
  1. `src/features/lesson/lessons.ts`: `import { linkedListsModule } from "@/lessons/linkedLists"` and add `[linkedListsModule.id]: linkedListsModule,` to `LESSONS`.
  2. `src/lessons/catalog.ts`, remove the `load: () => import("@/lessons/future/LinkedLists")` from the `linked-lists` entry (line ~62). This flips `isLessonPlayable("linked-lists")` to true and auto-drops it from the derived `FUTURE_LESSONS`.
  3. **Delete** `src/lessons/future/LinkedLists.tsx`.
  - No edit to `src/lessons/registry.tsx` (its `FUTURE_LESSONS` is derived from the catalog). `LessonHost` routes via `isLessonPlayable` automatically. Unlock stays sequential (Arrays → Linked Lists). The module id is already `"linked-lists"` (matches the catalog id).
- **Emulator:** add LL cases to a progress emulator test mirroring `firestoreProgressRepository.emulator.test.ts` (mid-beat round-trip + resume + completion; assert the 7 counters + `currentPart` + `completed`).
- **E2E:** extend `e2e/tracer.spec.ts` to continue **into Linked Lists after Arrays completes** (LL unlocks then); play all 10 beats; commit at least one rewire via the **keyboard fallback in the pinned safe order** (using `data-write-order`); assert each graded beat gates.
- **Determinism:** a node test asserting same seed → identical nodes/walks/writes/verdicts; no model calls anywhere.

**Files:** `linkedListsEngine.ts` (gate/progress finalize); `linkedLists.tsx` (totalParts); `lessons.ts` (register); `catalog.ts` (drop `load`); delete `future/LinkedLists.tsx`; new `*.emulator.test.ts`; extend `e2e/tracer.spec.ts`.

**Verify:** `npm run test` (node+dom), `npm run test:emulator`, `npm run e2e`, `tsc -b`, `npm run lint` all green; lesson is playable from the course path; reload resumes a signed-in learner mid-lesson.

## Stories → slices matrix

| Beat (flow #) | Type · bin | Graded? | Slice (build order) |
|---|---|---|---|
| 1 Node demo (drag node, list unchanged) | intro | - | 2 (figure capability from 1) |
| 2 Teach (pointers are structure; head sacred) | teach | - | 2 |
| 3 Traverse. Value-at-k / hops-to-X | **L1 Traverse** | ✓ #1 | 2 |
| 4 Insert X after B | **L2 Rewire** | ✓ #2 | **1 (tracer)** |
| 5 Delete C | **L3 Rewire** | ✓ #3 | 3 |
| 6 Predict-the-break | **L4 Predict** | ✓ #4 | 3 |
| 7 Real-world playlist (Spotify theme) | L1/L2 skin | ✓ #5 | 4 |
| 8 Array-vs-list insert (ripple-N vs 2 writes) | **L5 Contrast** | ✓ #6 | 4 |
| 9 Array-vs-list reach (jump vs walk) | **L5 Contrast** | ✓ #7 | 4 |
| 10 Doubly-linked (4-write splice; walk both ways) | L2 synthesis | **: (taught)** | 5 |
| Gate · flame · wire · persistence · E2E · determinism | - | - | 6 |

5 question types → L1 → S2; L2 → S1; L3 → S3; L4 → S3; L5 → S4.

## Risks & mitigations

- **Arrow routing / geometry (highest):** above/below routing that never crosses a node, straight only when adjacent, anchored to moving node boxes. Mitigate: isolate the math in a **pure `graphLayout.ts`** (node-tested for anchor points, side selection, adjacency); the SVG layer is a thin render over it. jsdom returns zeroed `getBoundingClientRect`, so geometry is **not** jsdom-testable. Keep it pure (node) + prove the rendered DOM via Playwright + Gallery.
- **Reachability-driven legal targets / orphan blocking:** the verdict and "what's grabbable" both depend on `reachableFrom(head, working)`. Mitigate: one pure recompute after every write; `legalTargets`/`grabbableSources` are selectors over it; node tests cover safe vs unsafe vs partial.
- **Drag-stretch + keyboard parity:** the arrowhead-drag must yield the **same** `(from,to)` as tap/keyboard. Mitigate: funnel all three through `core.ts`; dom test asserts keyboard parity (no geometry needed); document the keyboard cycle order (reachable targets, registration order).
- **Reduced-motion:** stretch/drift/glow are JS-driven. Mitigate: gate every `motion` animation behind `useReducedMotion()` → snap to end-state + SR announce; the global CSS block already covers CSS transitions.
- **Persisting the richer rewire working-state:** `LessonProgress.counters` is `Record<string, number>`, it **cannot** hold a pointer map without changing the shared shape. Resolved: **don't** persist working-state (resume = fresh instance, like every shipped lesson).
- **Reuse vs fork of the rewire React surface:** the arrowhead is a non-pill, SVG-anchored handle. Mitigate: keep `RewireSurface` as the registry/keyboard/`aria-live` scaffold and render the arrowhead as a custom `RewireSource` child + node boxes as `RewireTarget`s; if the SVG handle can't ride on `RewireSource`, consume `core.ts` directly inside `NodeGraph` and keep `RewireSurface` only for SR/keyboard. **Do not edit** `src/components/rewire/*` (shared, downstream consumers in Hash Tables/Graphs). New pure geometry goes in a lesson-local module, never in `core.ts`.
- **Heavy libs:** a singly/doubly chain needs **no** graph lib, hand-rolled SVG. Keep `@xyflow/react` / `d3-*` / `gsap` out (design brief §15); the rewire dir's import guard already enforces this for shared code.

## Files to add / modify / delete

**Modify:** `src/features/lesson/linkedListsEngine.ts` (rework engine); `src/features/lesson/linkedListsEngine.test.ts` (rework); `src/lessons/linkedLists/Stage.tsx` (rework to 10 beats); `src/lessons/linkedLists.tsx` (totalParts); `src/lessons/catalog.ts` (drop `linked-lists` `load`); `src/features/lesson/lessons.ts` (register module); `src/dev/GalleryApp.tsx` (new presets); `e2e/tracer.spec.ts` (LL leg).
**Add:** `src/lessons/linkedLists/NodeGraph.tsx`, `src/lessons/linkedLists/graphLayout.ts` (+ `graphLayout.test.ts`), `src/lessons/linkedLists/NodeGraph.test.tsx`, an LL progress `*.emulator.test.ts`.
**Delete:** `src/lessons/future/LinkedLists.tsx`; the slice-1 `RewireChain` presentation in `src/lessons/linkedLists/NodeChain.tsx` (retire the file or reduce it to the kept `WalkChain` if not folded into `NodeGraph`).
**Do NOT touch:** `src/components/rewire/*` (shared), `engine.ts`, `lessonModule.ts`, `useLessonRun.tsx`, `arraysEngine.ts`, `gradeAnswer`/`LessonProgress`.

## Test plan (against the spec's Test contract)

- **Engine unit (node):** L1 walk value correct under each k + hops-to-X; L2 insert + L3 delete **pinned-order** uniqueness and resulting list; L4 **wrong order → `orphaned_tail`** verdict; L5 cost numbers (ripple `n−k` vs `2` writes; `1` jump vs `k` hops); doubly **4-write** demo order; gate flips at **7**; flame breaks only on a full fail (combo via `gradeAnswer`); **determinism** (same seed → same nodes/walks/writes/verdicts).
- **Figure (dom, jsdom):** keyboard-path intent parity with drag; reduced-motion snap; registry idempotent under StrictMode. (Pointer geometry is **not** asserted here. Covered by Playwright + Gallery.)
- **Repository (emulator):** the durable slice (**7 counters + `attempts` + `currentPart` + `completed`**) round-trips and resumes on the same beat with a cold combo; reconcile unchanged. (Working-state is transient by design. Not persisted.)
- **One Playwright tracer:** continue into Linked Lists after Arrays completes; play all 10 beats; commit ≥1 rewire via the **keyboard fallback in the pinned safe order**; assert each graded beat gates; reload resumes.

## Acceptance criteria (mapped to `linked-lists.md`)

- [ ] Figure is the literal-arrow `NodeGraph`: tidy, draggable nodes; each shows its `next`; rewire by dragging an arrowhead with live stretch; reachable targets hover-glow; tap + keyboard parity; arrows route above/below and straight-when-adjacent. *(Arrow/interaction architecture LOCKED)*
- [ ] Grading is **pointer-write order**: insert pinned to `new.next=prev.next` then `prev.next=new`; the reverse orphans the tail. *(Decision A / save-first)*
- [ ] Orphan is honest & blocking: unsafe order makes orphaned node + tail drift, grey out, become un-grabbable (legal targets = reachable-from-head); learner gets stuck → wrong via `gradeAnswer` (nudge; after `WRONG_LIMIT` auto-reveal safe order); Why?-replay shows safe then broken; Reattempt resets. *(Orphan LOCKED)*
- [ ] Detach-on-grab: grabbing an arrowhead immediately removes the old outgoing arrow.
- [ ] Delete is one move (drag `prev`'s arrow from `cur` to `cur.next`); bypassed node drifts off.
- [ ] Walk is learner-driven (only the immediate next node tappable; no jump); hop count = `scales` cost, announced for SR.
- [ ] Beats 7/8/9: playlist real-world with Spotify green/black; array-vs-list insert (ripple-N vs 2 writes) and reach (jump vs walk) on one screen.
- [ ] Beat 10 doubly-linked is taught (4-write splice; walk both ways) and **ungraded**.
- [ ] Gate = **7** graded (beats 3–9); mastery = clear the 7; flame spans the 7, breaks only on a full fail.
- [ ] L4 choices = {works fine · rest of list lost ✓ · loops forever}.
- [ ] Determinism (no-AI verdicts); reduced-motion snaps to end-state; ≥44px targets, lilac focus, icon+text+SR.
- [ ] Wired live: registered, catalog entry playable, preview deleted; unlocks after Arrays.

## Shared-seam coordination

**None required.** `LessonAction.rewire`, `gradeAnswer`, `LessonProgress`, and `LessonModule` are all sufficient as-is; `src/components/rewire/*` is reused unmodified.
