# Wire Built-but-Dark Features Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Each feature is already built and tested but unused; this plan surfaces it in a real segment. New segments are welcome and saved-progress migration is not a concern (owner direction), so prefer the best placement over the cheapest.

**Goal:** Surface three features that are built and tested but never rendered, so the effort already spent pays off: Trees `RebalanceBracket`, Hash Tables `HashBox` reveal mode, and the Graphs transit draw experience (current skin) with a stronger draw mechanic.

**Architecture:** Each is a view wiring change into an existing (or new) segment. Where a segment needs a graded answer, the verdict stays in the pure engine; the dark component is view-only. Animation polish here aligns with the Animation Depth plan (`2026-06-27-lesson-animation-depth.md`); avoid duplicating that work, reference it.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Decisions locked (from planning Q&A)

- **Trees `RebalanceBracket`:** wire as a **post-correct flourish on `compare-shape`**: after the learner answers correctly, the lopsided "stick" visibly rebalances into the balanced tree. Non-gating; pure view.
- **Hash Tables `HashBox` reveal:** wire into the thin **`teach-hash`** segment to make it interactive: step the letters, show `sum mod B = bucket`, fly the key to its bucket. This also fixes `teach-hash` being non-interactive.
- **Graphs:** keep the **current transit skin** (the one in the gallery; it looks good and was hard to polish). Per the lesson review, **BOTH** of these are now in scope (not either/or), and both need gallery demoing to get right (see `2026-06-27-graphs-redesign.md`, the single source of truth for Graphs):
  1. Improve the existing single-edge `draw-transit` edge-creation mechanic + draw-on animation (keep skin).
  2. A multi-edge "build the line" synthesis segment (the `METRO_PLAN` ghost network), since new segments are welcome.
- New segments allowed; migration not a concern.

## Constraints (baked in)

- **A. No seam / persistence change.** Adding a segment is fine (changes `totalParts`/gate), but do not change the `LessonModule` interface or the `LessonProgress` shape. (Owner: migration is not a concern, so do not spend effort on counter migration.)
- **D. Gallery + screenshots.** Prototype + screenshot each wired feature before promoting; the Graphs "both options" decision happens at the gate.
- House rules: no em dashes; no Big-O; house cost words only.

---

## File structure

**Trees `RebalanceBracket`**
- Modify `src/lessons/trees/Stage.tsx` (`ComparePart`): render `RebalanceBracket` (from `Arena.tsx`) on the post-correct reveal of `compare-shape`.
- Modify `src/lessons/trees/Stage.test.tsx`: assert the rebalance figure mounts only after a correct answer (non-gating).
- `Arena.tsx` already exports + tests `RebalanceBracket`; no change unless props need a `reduced` pass-through.

**Hash Tables `HashBox` reveal**
- Modify `src/lessons/hashTables/Stage.tsx` (`TeachPart` for `teach-hash`): render `HashBox` in its `reveal` mode (step letters -> `sum mod B` -> fly to bucket) instead of the static empty table.
- Modify `src/lessons/hashTables/Stage.test.tsx`: assert the teach segment is now interactive (letters step; the computed bucket is shown) and remains non-graded.
- `HashBox.tsx` already supports `reveal`; no change unless a `reduced` pass-through is needed.

**Graphs draw experience (prototype both)**
- Modify `src/lessons/graphs/Stage.tsx` + `src/lessons/graphs/GraphCanvas.tsx` / `SubwayMap.tsx`: option 1, sharpen the `draw-transit` draw mechanic (clearer armed/legal/hover affordances, snappier draw-on via the existing `pathLength` / `PendingSegment`).
- For option 2 (build-the-line), use `transitData.ts` `METRO_PLAN_*` + `SubwayMap`'s existing `ghost` prop; if chosen, add a new graded segment in `graphsEngine.ts` (+ tests).
- Modify `src/dev/GalleryApp.tsx`: presets for BOTH options.

---

## Phase 1: Trees `RebalanceBracket` on `compare-shape`

- [ ] **Step 1 (test-first):** In `trees/Stage.test.tsx`, assert `RebalanceBracket` is absent at idle and present after a correct `compare-shape` answer; non-gating (completion unaffected).
- [ ] **Step 2:** Wire it into `ComparePart`'s reveal branch; pass `reducedMotion`.
- [ ] **Step 3:** Tests green; `tsc -b` + lint clean.
- [ ] **Step 4:** Gallery preset `trees-compare-rebalance` + reduced variant; screenshot.

## Phase 2: Hash Tables `HashBox` reveal in `teach-hash`

- [ ] **Step 1 (test-first):** In `hashTables/Stage.test.tsx`, assert `teach-hash` renders an interactive `HashBox` (letters can step; `sum mod B = bucket` shows) and stays non-graded (no quota).
- [ ] **Step 2:** Replace the static empty-table teach with `HashBox` in `reveal` mode; pass `reduced`.
- [ ] **Step 3:** Tests green; `tsc -b` + lint clean.
- [ ] **Step 4:** Gallery preset `hash-teach-hashbox` + reduced variant; screenshot.

## Phase 3: Graphs draw experience (prototype BOTH, then gate)

- [ ] **Step 1:** Option 1 prototype: sharpen the existing `draw-transit` mechanic + draw-on animation in the gallery (keep the current skin). No engine change.
- [ ] **Step 2:** Option 2 prototype: a "build the line" segment using `METRO_PLAN_*` + `SubwayMap` `ghost` (draw the missing edges to grow ACTIVE toward the PLAN). Engine segment + verdict behind tests if pursued.
- [ ] **Step 3:** Gallery presets for both; phone screenshots into `docs/reference/` (`graphs-draw-improved.png`, `graphs-build-the-line.png`).
- [ ] **Step 4 (review gate):** Present both to the owner; pick one (or both). Only the chosen option is promoted; delete the rejected prototype's throwaway assets.

## Phase 4: Verify

- [ ] `npx tsc -b`, `npm run test`, `npm run lint` clean.
- [ ] Confirm the dark components are no longer unused (grep shows them rendered in a Stage, not only in tests).
- [ ] Commit per feature.

---

## Risks / open items

- Graphs is intentionally a two-option prototype; do not over-build option 2 before the gate. If option 1 is enough, leave the ghost network unused (acceptable) or note it as a future segment.
- `compare-shape` and `teach-hash` animation polish overlaps the Animation Depth plan; if that plan lands first for these lessons, this bucket only does the wiring, not the motion.

## Self-review

- Trees `RebalanceBracket` -> post-correct `compare-shape` flourish, non-gating: Phase 1. Covered.
- Hash `HashBox` reveal -> interactive `teach-hash`: Phase 2. Covered.
- Graphs: keep skin, improve draw mechanic + animation, prototype both, decide at gate: Phase 3. Covered.
- New segments allowed, no migration effort, constraints A + D, house rules: stated. Covered.
