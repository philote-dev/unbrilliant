# Trees and Heaps Interaction Variety Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Engine verdicts are the test surface: any new active mechanic must grade in the pure engine with tests before the UI is built. New segments are welcome; saved-progress migration is not a concern (owner direction).

**Goal:** Lift the two tap-only lessons. Heaps gains an active "do the sift" mechanic (perform the operation, not pick the end-state). Trees gains a single watched build-from-scratch moment plus better "show the flow" animation, and tighter rigor so learners perform the method instead of shortcutting.

**Architecture:** Pure-engine-first. Heaps' do-the-sift validates each swap in `heapsEngine.ts` (reusing the existing `SwapStep` correct-line). Trees' build-from-scratch is a watched animation (view-only, leaning on the Animation Depth plan). Rigor (frontier-gating) is a small selector tweak in the engines. All animation aligns with `2026-06-27-lesson-animation-depth.md`.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Decisions locked (from planning Q&A)

- **Heaps:** add a **do-the-sift** active mechanic: the learner performs the swaps (tap/drag a node against its parent on insert, or against its larger child on extract) until the heap property holds; the engine validates each swap. **Upgrade/replace** the weak passive arrangement-select segments with this active mechanic; add a new segment only where a genuinely new skill emerges.
- **Trees:** the learner should **watch** a tree get built from scratch **exactly once** (an animated, non-graded teach moment); the **rest stay tap-based** with better "show the flow" animation (no new tap-everywhere drag mechanic).
- **Rigor (prototype for review):** frontier-gate the **Trees sequence** segment (only the next correct node tappable) and make the **Linked Lists traverse** segment a **forced hop-walk** (only the next hop tappable). Prototype both and decide at the review gate (the owner may prefer "show the flow" animation over hard gating).
- New segments allowed; migration not a concern.

## Constraints (baked in)

- **A. No seam / persistence change.** New mechanics grade through the existing `LessonAction` / engine; do not change the `LessonModule` interface or `LessonProgress` shape. Adding/replacing segments is fine.
- **D. Gallery + screenshots.** Prototype the do-the-sift, the watched build, and the rigor changes in the gallery; screenshot review before promote.
- House rules: no em dashes; no Big-O; house cost words only.

---

## File structure

**Heaps do-the-sift**
- Modify `src/features/lesson/heapsEngine.ts` (+ `heapsEngine.test.ts`): a per-swap validator over the existing correct sift line (accept the correct swap, reject others), driving an interactive segment instead of arrangement-select. Replace the passive `siftup-1` / `siftdown-1` / `siftdown-2` answer model with the active one (keep the bins/gate counts).
- Modify `src/lessons/heaps/Stage.tsx`: the active sift UI (tap/drag a node against its parent/child); reuse `HeapDualView` + the traveling-node animation from the Animation Depth plan.
- Modify `src/lessons/heaps/Stage.test.tsx`: a correct swap advances the sift; a wrong swap nudges; completing the sift clears the segment.

**Trees watched build + flow + rigor**
- Modify `src/lessons/trees/Stage.tsx` + `TreeFigure.tsx`: a single watched build-from-scratch teach segment (animated insert sequence). Reference the Animation Depth plan for the motion.
- Modify `src/features/lesson/treesEngine.ts` (+ `treesEngine.test.ts`): frontier-gate the sequence segment (selector exposes only the next correct in-order node as tappable). Keep the verdict identical; only the tappable set narrows.
- Modify `src/lessons/trees/Stage.tsx` (`SequenceFigure`): honor the frontier set.

**Linked Lists traverse rigor**
- Modify `src/features/lesson/linkedListsEngine.ts` (+ test): expose a frontier selector for traverse (only the next hop tappable).
- Modify `src/lessons/linkedLists/Stage.tsx` + `NodeGraph.tsx` (`walk` mode): honor the frontier so the answer cannot be one-tapped.

**Gallery**
- Modify `src/dev/GalleryApp.tsx`: presets for the do-the-sift (idle/mid/solved/wrong), the watched build, and the gated sequence/traverse.

---

## Phase 1: Heaps do-the-sift (engine-first)

- [ ] **Step 1 (test-first):** In `heapsEngine.test.ts`, model the active segment: from a just-inserted (or just-extracted) heap, the only correct action is the valid swap; assert a correct swap advances toward the settled heap, a wrong swap nudges (shared `gradeAnswer`), and reaching the heap property clears the segment and bumps the bin.
- [ ] **Step 2:** Implement the per-swap validator + state in `heapsEngine.ts`, replacing the arrangement-select model for the sift segments (keep bin ids/quotas so the gate total is unchanged).
- [ ] **Step 3:** Engine tests green; `tsc -b`.
- [ ] **Step 4 (UI):** Build the active sift in `Stage.tsx` (tap a node then its parent/child to swap, or drag); reuse the traveling-node animation. DOM tests for correct/wrong/settled.
- [ ] **Step 5:** Tests + lint clean.

## Phase 2: Trees watched build + flow + frontier-gated sequence

- [ ] **Step 1:** Add the single watched build-from-scratch teach segment (animated insert sequence); non-graded. Lean on the Animation Depth plan for the motion primitives.
- [ ] **Step 2 (test-first):** In `treesEngine.test.ts`, assert the sequence segment exposes only the next correct in-order node as tappable (frontier), with the verdict unchanged.
- [ ] **Step 3:** Implement the frontier selector; `SequenceFigure` honors it.
- [ ] **Step 4:** DOM tests: tapping a non-frontier node is a no-op; the in-order walk is forced.

## Phase 3: Linked Lists traverse forced-walk

- [ ] **Step 1 (test-first):** In `linkedListsEngine.test.ts`, assert traverse exposes only the next hop as tappable (no one-tap answer).
- [ ] **Step 2:** Implement the frontier selector; `NodeGraph` `walk` mode honors it; the cost readout counts the hops actually walked.
- [ ] **Step 3:** DOM tests green.

## Phase 4: Review gate (D) and rigor decision

- [ ] **Step 1:** Gallery presets for: Heaps do-the-sift (idle/mid/wrong/solved), Trees watched build, Trees gated sequence, LL forced-walk traverse.
- [ ] **Step 2:** Phone screenshots into `docs/reference/`; review against the bar.
- [ ] **Step 3 (rigor decision):** Present the gated sequence/traverse vs the "show the flow" animation alternative to the owner; keep whichever reads better (gating, animation, or both). Adjust before promote.
- [ ] **Step 4:** `tsc -b` + `npm run test` + lint clean; commit per lesson.

---

## Risks / open items

- The rigor changes (frontier-gating) may feel restrictive; the owner asked to demo them. If gating reads as fiddly, fall back to "show the flow" animation that makes the method obvious without hard-locking taps. Decide at the gate.
- Heaps do-the-sift replaces a passive answer model; ensure the bin/gate totals stay constant so completion and analytics are unaffected (constraint A).
- Heaps animation (traveling-node) is owned by the Animation Depth plan; sequence this after that pilot so the active sift reuses it.

## Self-review

- Heaps do-the-sift (active, engine-validated, replaces passive segments, gate unchanged): Phase 1. Covered.
- Trees: one watched build + flow + frontier-gated sequence: Phase 2. Covered.
- LL traverse forced-walk: Phase 3. Covered.
- Rigor prototyped for owner decision; new segments allowed; constraints A + D, house rules: Phase 4, stated. Covered.
