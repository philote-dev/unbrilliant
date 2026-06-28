# Lesson Animation Depth Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. This plan is pilot-first: fully build and gallery-validate the Heaps pilot, pass the review gate, then roll out weakest-first. Do not start a rollout lesson before the pilot is signed off.

**Goal:** Raise the five newer lessons (Heaps, Linked Lists, Trees, Hash Tables, Graphs) to the reference bar on animation fluidity, where animation is a teaching tool (played-over-time, deterministic, reduced-motion-safe), not decoration. Pilot the pattern on Heaps, then roll out.

**Architecture (locked):** Mix. Pure deterministic frame-sequence functions live in the engine (`*Engine.ts`) for the must-be-correct teaching replays (Heaps already does this with `SwapStep[]` from `siftUp` / `siftDownExtract`); component-local motion handles incidental polish (entrances, hovers, shakes). Player is hybrid: extract ONE shared stepper primitive (generalize Heaps' `StepReplay`) for discrete-frame replays, keep bespoke components for continuous morphs (e.g. the subway route `d` morph). Every animated path honors `prefers-reduced-motion` with a snap-to-final fallback.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest (node + jsdom) + Testing Library, Playwright (gallery screenshots), oxlint.

---

## Decisions locked (from planning Q&A)

- **Pilot:** Heaps, at **broader** depth.
- **Heaps signature:** replace the current "lift + instant value-swap" with a **traveling-node sift**: the two swapping nodes physically trade slots, **synced across the tree view and the array view**, on sift-up, sift-down, and extract replays.
- **Heaps broader scope:** also animate the mapping segments, the contrast segments, and the demo inserts; close reduced-motion gaps.
- **Player:** hybrid. Generalize `StepReplay` into a shared frame-player primitive; keep bespoke for continuous morphs.
- **Rollout order:** weakest-first, **Linked Lists -> Trees -> Hash Tables -> Graphs**, each at **broader** depth.
- **Cross-references:** Trees' animation here is the "show the flow" work that pairs with Bucket 4 (its one build-from-scratch moment is a watched animation). Graphs' animation here is the draw-on / draw-mechanic improvement that pairs with Bucket 3 (keep the current transit skin).

## Constraints (baked in)

- **A. No seam / persistence change.** Do not alter the `LessonModule` interface or the durable `LessonProgress` shape. Animation is view-only; engine frame functions are pure selectors, never part of grading.
- **D. Gallery + screenshots.** Every new/changed animated state gets a gallery preset and a phone-viewport screenshot review before it is considered done.
- House rules: no em dashes; no Big-O; house cost words only (`free` / `scales` / `barely grows` / `usually free`).
- Reduced-motion parity is a hard requirement on every path (snap-to-final, no stranded timers).

---

## File structure

**Shared primitive (new)**
- Create `src/components/willow/lesson/FrameSequence.tsx`: a reusable stepper that takes `frames`, optional `autoPlayMs`, optional manual controls (Back/Next/Replay), a per-frame render child, and a `reduced` flag (snaps to the last frame). Generalized from `src/lessons/heaps/Stage.tsx`'s `StepReplay`.
- Create `src/components/willow/lesson/FrameSequence.test.tsx`: stepping, autoplay cap, reduced-motion snap.

**Heaps pilot**
- Modify `src/features/lesson/heapsEngine.ts`: keep `SwapStep[]`; add a pure `siftFrames`-style selector that expresses each swap as a per-node slot transition (the data a traveling-node animation needs), plus mapping/contrast frame data where useful. Add tests in `heapsEngine.test.ts`.
- Modify `src/lessons/heaps/HeapDualView.tsx`: give each node a stable `layoutId` keyed by value identity so a swap animates the node traveling between slots in BOTH the tree and the array (shared layout), not a value flip. Reduced-motion snaps.
- Modify `src/lessons/heaps/ERTriageBoard.tsx`: same geometry/identity treatment for the ER skin.
- Modify `src/lessons/heaps/Stage.tsx`: replace local `StepReplay` usage with the shared `FrameSequence`; wire mapping/contrast/demo animation; pass `reduced` everywhere.
- Modify `src/lessons/heaps/MonitorChrome.tsx`: gate the `animate-pulse` Live dot on reduced-motion (close the known gap).
- Modify `src/lessons/heaps/Stage.test.tsx` and the relevant `*.test.tsx` for new states.

**Rollout (one section per lesson, executed after the gate)**
- Linked Lists: `linkedListsEngine.ts` (frame selectors for the rewire repoint and the `predict` orphaning), `NodeGraph.tsx`, `PlaylistQueue.tsx`, `Stage.tsx`. Signature: animate the pointer repoint on insert/delete and the tail-orphaning on `predict`.
- Trees: `treeLayout.ts` / `TreeFigure.tsx` (use the existing `straighten` for an animated in-order flow; wire `DisplayTree` motion), `Stage.tsx`. Signature: the watched build-from-scratch (Bucket 4) + descend-prune flow.
- Hash Tables: `BucketChain.tsx` / `HashBox.tsx` / `Stage.tsx`. Signature: the hash fly-to-bucket + chain-append played over time. (Note: `HashBox` reveal wiring is owned by Bucket 3; here, polish its motion.)
- Graphs: `GraphCanvas.tsx` / `SubwayMap.tsx` / `Stage.tsx`. Signature: improved edge draw-on + (Bucket 3) draw-mechanic. Keep the current transit skin.

**Gallery**
- Modify `src/dev/GalleryApp.tsx`: presets for each new animated state (pilot first, then per rollout lesson).

---

## Phase 1: Shared `FrameSequence` primitive

- [ ] **Step 1 (test-first):** Write `FrameSequence.test.tsx`: it renders frame 0, auto-advances to the last frame on a timer, caps at the last frame, exposes Back/Next/Replay when controls are on, and (with `reduced`) renders the final frame immediately with no timer.
- [ ] **Step 2:** Extract the logic from Heaps' `StepReplay` into `FrameSequence.tsx` (generic over a `frames: T[]` + `children: (frame: T, index: number) => ReactNode`). Keep `StepReplay`'s pacing defaults.
- [ ] **Step 3:** Make Heaps' `Stage.tsx` consume `FrameSequence` (no behavior change yet). Run Heaps tests green.
- [ ] **Step 4:** `npx tsc -b` + `npm run lint` clean. Verify in gallery the Heaps replays are unchanged.

## Phase 2: Heaps pilot (traveling-node sift, synced views)

- [ ] **Step 1 (engine, test-first):** In `heapsEngine.test.ts`, assert a pure per-node frame selector: each swap step yields, per node value, its slot before/after, marking the moving pair. Cover sift-up, sift-down, and the extract intro (root leaves, last -> root).
- [ ] **Step 2:** Implement that selector in `heapsEngine.ts` (pure, view-only; reuse the existing `SwapStep` path so the answer logic is untouched).
- [ ] **Step 3:** In `HeapDualView.tsx`, key each node with a stable `layoutId` by value identity so a swap animates the node traveling between slots; the array cell and tree node for the same value share the identity so they move together. Spring transition; `reduced` snaps.
- [ ] **Step 4:** Mirror in `ERTriageBoard.tsx`.
- [ ] **Step 5:** Animate the mapping segments, contrast segments, and demo inserts (component-local motion where not a teaching replay).
- [ ] **Step 6:** Close the `MonitorChrome` reduced-motion gap.
- [ ] **Step 7:** DOM tests for the new states (including a reduced-motion render that asserts the final arrangement with no intermediate timers).
- [ ] **Step 8:** `npx tsc -b`, `npm run test`, `npm run lint` clean.

## Phase 3: Heaps review gate (D)

- [ ] **Step 1:** Add gallery presets for: sift-up travel, sift-down travel, extract intro, a mapping segment, a contrast segment, a demo insert, and each in reduced-motion.
- [ ] **Step 2:** Capture phone-viewport screenshots to `docs/reference/` (kebab-case, e.g. `heaps-siftup-travel.png`), view them, critique against the reference bar (does the node visibly travel, synced across both views, settle cleanly?).
- [ ] **Step 3:** Present to the owner. **Do not start Phase 4 until the pilot is signed off.** Capture any pacing/spring adjustments here.

## Phase 4: Rollout (weakest-first, broader each)

For each of Linked Lists, then Trees, then Hash Tables, then Graphs, in order:
- [ ] Identify the lesson's signature played-over-time moment (see File structure) and any incidental motion to add.
- [ ] Engine frame selectors (test-first) for the must-be-correct replays; component-local for incidental.
- [ ] Reuse `FrameSequence` for discrete replays; bespoke for continuous morphs.
- [ ] Reduced-motion parity on every new path.
- [ ] Gallery presets + screenshot review gate before moving to the next lesson.
- [ ] `tsc -b` + tests + lint clean; commit per lesson.

---

## Risks / open items (resolve at the review gate)

- Shared-layout (`layoutId`) travel across two separate figures (tree + array) is the riskiest technique; if the synced travel reads poorly, fall back to a bespoke synced spring keyed off the engine frame slots. Decide from the Phase 3 screenshots.
- Pacing: the broader scope risks over-animating. If a segment feels busy, demote incidental motion to entrance-only. Owner decides at the gate.
- Trees and Graphs overlap Buckets 4 and 3 respectively; sequence those rollout sections after their sibling-bucket mechanics land to avoid rework.

## Self-review

- Pilot (Heaps, broader, traveling-node synced): Phases 1-3. Covered.
- Mix architecture (engine frame selectors + component-local incidental): Phases 1, 2, 4. Covered.
- Hybrid player (shared `FrameSequence` + bespoke morphs): Phase 1, reused in 2 and 4. Covered.
- Reduced-motion parity + the known `MonitorChrome` gap: Phase 2. Covered.
- Rollout weakest-first at broader depth with gates: Phase 4. Covered.
- Constraints A + D, no em dashes/Big-O: stated and enforced per phase. Covered.
