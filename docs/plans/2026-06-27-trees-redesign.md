# Trees Redesign Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Single source of truth for the updated Trees lesson, consolidating the lesson review (Jun 28) with the cross-cutting buckets and the shared baseline. New segments are welcome; saved-progress migration is not a concern (owner direction). Poly is deferred (no Poly hints).

**Goal:** Trees is the most pedagogically complete of the five, but under-practiced and too easy. Add a build-the-BST synthesis arc (watched build + graded builds), more reps, and real challenge (bigger/varied trees), then apply the buckets (de-cue the compare MCQ, wire RebalanceBracket, frontier-gate the sequence) and the shared revamp baseline.

**Architecture:** Pure-engine-first. Every verdict is a pure function of the given tree (`descendPath` / `insertSlot` / `inorder`); the new build-the-BST grades by descending each key to its slot (reusing `descendPath` / `insertSlot`). Bigger/varied trees come from the replay-variety work (generated or pooled within tuned constraints). Tap-only stays (no drag); challenge comes from size and reps, not a new input. Animation reuses the shared `FrameSequence`. Must meet `2026-06-27-lesson-revamp-baseline.md`.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Concepts taught: 9 (unchanged), now properly practiced

descend by compare; each step halves; search hit; miss = the empty slot proves absence; insert lands in that slot; in-order recovers sorted order; same keys + different shape = same order, different cost; balanced halves vs stick walks; branching is the difference vs a sorted list.

## Updated segment map (single source of truth)

Current: 11 segments, 8 graded (Locate 4 / Sequence 2 / Comparison 2). Updated: **16 segments, 12 graded** (Locate 5 / Sequence 3 / **Build 2** / Comparison 2).

1. `demo` (free play) - tap to descend; opposite subtree drops.
2. `teach-descend` - compare, drop a half. [Baseline: glow + animated teaching.]
3. `find-hit` (Locate 1) - descend to 10.
4. `find-miss` (Locate 2) - empty slot proves absence.
5. `insert` (Locate 3) - descend to the empty slot.
6. `watched-build` (teach, ungraded) - **NEW:** watch a BST built from scratch, key by key (animated). [The "see it built once" you asked for.]
7. `build-bst-1` (Build 1) - **NEW:** insert a sequence of keys to grow the tree yourself.
8. `build-bst-2` (Build 2) - **NEW:** a second build, different keys/shape.
9. `find-big` (Locate 4) - **NEW challenge:** find a value in a large/varied tree, where halving visibly pays off (deep path). [Replay variety provides the big tree.]
10. `teach-inorder` - left, node, right. [Baseline.]
11. `sequence-a` (Sequence 1) - in-order tap, **frontier-gated** now (only the next correct node tappable). [Bucket 4.]
12. `sequence-b` (Sequence 2) - in-order on the zigzag.
13. `sequence-c` (Sequence 3) - **NEW:** in-order on a new/larger shape.
14. `realworld` (Locate 5) - tournament bracket skin.
15. `compare-shape` (Comparison 1) - **de-cued** options [Bucket 2]; on correct, the stick **rebalances into the balanced tree** (RebalanceBracket) [Bucket 3].
16. `contrast-list` (Comparison 2) - list walk vs tree descend race. Clears the gate.

Gate = Locate 5 + Sequence 3 + Build 2 + Comparison 2 = **12**.

## Decisions locked (lesson review, Jun 28)

- Build-the-BST: a watched build (teach) + **2 graded** build reps (insert a sequence to grow the tree). Placed after find/insert.
- Grow the gate from 8 to **12**: add the Build bin (2), +1 Locate (`find-big`), +1 Sequence (`sequence-c`).
- Challenge: bigger/varied trees + deeper targets via replay variety (generated/pooled), including a "find in a large tree" rep. This makes Trees variety REQUIRED, not just a candidate.
- Tap-only stays; the harder feel comes from size + reps, not a new input mechanic.
- Buckets still apply: de-cue compare-shape, wire RebalanceBracket, frontier-gate the sequence, animate (Trees is 2nd in the animation rollout), shared baseline.

## Constraints (baked in)

- **A. No seam / persistence change.** New segments/skills grade through the existing engine; `LessonProgress` shape untouched. (Adding segments + the Build bin is fine; migration not a concern.)
- **D. Gallery + screenshots.** Prototype build-the-BST, the watched build, find-big on a large tree, and the frontier-gated sequence; screenshot review before promote.
- Baseline + house rules: `2026-06-27-lesson-revamp-baseline.md`; no em dashes; no Big-O; house cost words.

---

## File structure

- Modify `src/features/lesson/treesEngine.ts` (+ `treesEngine.test.ts`): add `watched-build`, `build-bst-1/2`, `find-big`, `sequence-c`; the build-the-BST model (descend each key in the sequence to its `insertSlot`, grade the resulting tree); frontier-gate the sequence (expose only the next correct in-order id as tappable); generated/pooled larger trees for `find-big` (and variety elsewhere); update `TREES_PARTS`, the bins/quotas, `isCompleteTrees` to the 12 gate.
- Modify `src/lessons/trees/Stage.tsx`: the watched-build animation, the build-the-BST interaction (insert a sequence, descend+place each), `find-big` on a big tree, the frontier-gated sequence; reuse `FrameSequence`; apply glow + reading baseline; the Stage currently imports no motion, so this is also where the baseline animation lands.
- Modify `src/lessons/trees/TreeFigure.tsx` / `Arena.tsx` / `ContrastRace.tsx` / `HalvingMeter.tsx`: animate descend prune, the build, the straighten, the race; wire `RebalanceBracket` into `compare-shape`; clean all motion; reduced-motion parity; animate `DisplayTree` (static today).
- Modify `src/dev/GalleryApp.tsx`: presets for the watched build, build-the-BST (mid-sequence), find-big (large tree), frontier-gated sequence, compare-shape rebalance, plus a seed-sample view for the generated trees.

---

## Phases

- [ ] **Phase 1 (baseline + buckets for Trees):** apply the shared baseline (clean all animations, glow, animation teaching, reading); de-cue compare-shape (Bucket 2); wire RebalanceBracket (Bucket 3); frontier-gate the sequence (Bucket 4); animate descend/halving/straighten/race (Bucket 1, Trees is 2nd in rollout).
- [ ] **Phase 2 (build-the-BST arc, engine-first):**
  - [ ] Test-first: the build model (insert a key sequence; each key descends to its `insertSlot`; the resulting tree is graded); 2 graded reps; the watched build is ungraded.
  - [ ] Implement the engine model + the watched build + the two graded builds; slot the Build bin into the gate.
  - [ ] UI: the watched build animation; the build interaction (descend + place each key); concept copy with glow.
  - [ ] DOM tests; gallery presets; screenshots.
- [ ] **Phase 3 (more reps + challenge):**
  - [ ] Add `find-big` (Locate) and `sequence-c` (Sequence).
  - [ ] Bigger/varied trees via replay variety (see `2026-06-27-replay-variety.md`); ensure `find-big` shows a deep path where halving pays off.
  - [ ] Determinism + invariant tests for generated trees; seed-sample gallery review.
- [ ] **Phase 4 (verify + gate):** `tsc -b` + tests + lint clean; full phone-viewport playthrough screenshots; owner sign-off on the 16-segment / 12-gate flow.

---

## Open items for the gate

- Exact tree sizes for `find-big` (big enough to feel halving, small enough for a phone).
- Whether `sequence-c` uses a generated shape or a third curated one.
- Confirm 12 is the right gate after a playthrough (the owner wanted "more"; tune up if it still feels light).

## Self-review

- More + harder practice (gate 8 -> 12; build bin; find-big; bigger trees): segment map + Phases 2-3. Covered.
- Build-the-BST defined (descend + place a sequence) with watched build first: Phase 2. Covered.
- Buckets (de-cue, RebalanceBracket, frontier-gate, animate) + baseline: Phase 1. Covered.
- Replay variety now required for the challenge; Poly deferred; constraints A + D: stated. Covered.
