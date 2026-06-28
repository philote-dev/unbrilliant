# Linked Lists Redesign Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. This is the single source of truth for the updated Linked Lists lesson. It consolidates the LL-specific decisions from the lesson review (Jun 28) and references the cross-cutting bucket plans for shared mechanics. New segments are welcome; saved-progress migration is not a concern (owner direction). Poly is deferred, so the updated lesson ships with NO Poly hints.

**Goal:** Bring Linked Lists to reference tier: force the walk, animate the pointer writes and the orphaning, replace the redundant playlist with a real multi-operation synthesis segment, turn the binary contrasts into pick -> why-MCQ checks, and grow the doubly coda into a real interactive, graded segment with practice.

**Architecture:** Pure-engine-first. Reachability grading (the existing model) stays. New mechanics grade in `linkedListsEngine.ts` with tests; animation is view-only and reuses the shared `FrameSequence` primitive from the Animation Depth plan.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Updated segment map (single source of truth)

Current: 10 segments, 7 graded. Updated: **12 segments, 9 graded** (recommended gate = 9).

1. `node-demo` (free play) - unchanged.
2. `teach` - unchanged.
3. `traverse` (graded) - **forced walk** (only the next hop tappable) + path animation. [Rigor: `2026-06-27-trees-heaps-interaction.md`. Animation: `2026-06-27-lesson-animation-depth.md`.]
4. `rewire-insert` (graded) - animated save-first splice. [Animation plan.]
5. `rewire-delete` (graded) - animated bypass. [Animation plan.]
6. `predict` (graded) - **animated orphaning** on reveal (the tail detaches), not a static MCQ. [Animation plan.]
7. `playlist` synthesis (graded) - **multi-step: insert -> delete -> reorder**, reorder = unlink (bypass delete) + relink (save-first insert). Spotify skin. [Repurpose: `2026-06-27-repurpose-redundant-segments.md`.]
8. `contrast-insert` (graded) - **two-step pick -> why-MCQ**. [De-cuing: `2026-06-27-decuing-sweep.md`.]
9. `contrast-reach` (graded) - **two-step pick -> why-MCQ**. [De-cuing plan.]
10. `doubly-demo` (free play) - **NEW**: a two-way-arrows sandbox ("what if there are two arrows now").
11. `doubly-splice` (graded) - **NEW**: a both-ways splice (4 ordered writes).
12. `doubly-walk` (graded) - **NEW**: a backward walk from the tail.

The 9 graded skills: traverse, insert, delete, predict, playlist-synthesis, contrast-insert, contrast-reach, doubly-splice, doubly-walk. (Open gate decision: playlist synthesis as one slot vs three; recommend one.)

## Decisions locked (lesson review, Jun 28)

- Playlist becomes the synthesis segment (insert -> delete -> reorder = unlink+relink); not a plain delete repeat.
- Contrasts become two-step (pick, then a why-MCQ); the why-MCQ is the real check. Prototype framings; decide at the gate whether the pick is also graded.
- Doubly grows from an ungraded teaser into a real segment: a free-play demo + 2 graded problems, both part of the mastery gate.
- Scope is moderate: the above, no extra reps on the core skills.
- Poly is deferred: no Poly hints in this lesson for now.

## Constraints (baked in)

- **A. No seam / persistence change.** New segments/skills grade through the existing engine + `LessonAction`; the `LessonProgress` shape is untouched. (Adding segments and gate slots is fine; migration is not a concern per the owner.)
- **D. Gallery + screenshots.** Prototype the playlist synthesis, the contrast why-MCQs, and the doubly segment in the gallery; phone-screenshot review before promote. Several framings are explicitly "decide at the gate."
- House rules: no em dashes; no Big-O; house cost words only.

---

## File structure

- Modify `src/features/lesson/linkedListsEngine.ts` (+ `linkedListsEngine.test.ts`): add `playlist` multi-step model (insert/delete/reorder sub-steps over the reachability grader), the contrast pick -> why-MCQ two-step, and the doubly model (a both-ways pointer map: each node has `next` and `prev`; splice = 4 ordered writes; backward walk). Update `LL_PARTS`, the graded counters, and `isCompleteLL` to the 9-skill gate.
- Modify `src/lessons/linkedLists/Stage.tsx`: the multi-step playlist UI, the two-step contrast UI, the doubly-demo sandbox + two doubly problems. Reuse `FrameSequence` for replays.
- Modify `src/lessons/linkedLists/NodeGraph.tsx` / `PlaylistQueue.tsx`: render backward arrows for doubly; animate writes/orphaning; honor the traverse frontier.
- Modify `src/dev/GalleryApp.tsx`: presets for the new/changed segments (playlist mid-sequence, contrast pick + why, doubly demo/splice/walk).

---

## Phase 1: Core mechanic upgrades (traverse rigor, animations)

Covered by the cross-cutting plans; execute those for LL first.
- [ ] Traverse forced walk (from `2026-06-27-trees-heaps-interaction.md`).
- [ ] Animations for traverse/insert/delete/predict (from `2026-06-27-lesson-animation-depth.md`, LL is the first rollout after the Heaps pilot).

## Phase 2: Playlist synthesis segment

- [ ] **Step 1 (test-first):** model a multi-step playlist task: required ops insert -> delete -> reorder; reorder is graded as unlink + relink; the whole segment clears when all sub-steps are correct (reachability enforced throughout). Assert it is not a duplicate of `rewire-insert` / `rewire-delete` instances.
- [ ] **Step 2:** implement in the engine; decide one-slot vs three-slot gate (default one).
- [ ] **Step 3 (UI):** the Spotify multi-step interaction; animate each op.
- [ ] **Step 4:** DOM tests; gallery preset; screenshot.

## Phase 3: Contrast pick -> why-MCQ

- [ ] **Step 1 (test-first):** the contrast segment now has a pick step then a why-MCQ; assert the why-MCQ is graded (and the pick per the gate decision); assert no option text leaks the rule (de-cuing).
- [ ] **Step 2:** implement; author 2-3 why-MCQ framings to prototype.
- [ ] **Step 3 (gallery gate):** prototype the framings; owner picks; confirm pick-grading.
- [ ] **Step 4:** DOM tests; screenshots.

## Phase 4: Doubly segment (demo + 2 graded)

- [ ] **Step 1 (test-first):** a both-ways pointer model (each node has `next` + `prev`); a both-ways splice requires 4 ordered writes (graded by reachability in both directions); a backward walk from the tail is graded. Add the two skills to the gate.
- [ ] **Step 2:** implement the engine model + `doubly-demo` free-play (no grading), `doubly-splice`, `doubly-walk`.
- [ ] **Step 3 (UI):** backward arrows in `NodeGraph`; the demo sandbox; the two problems; animate the 4-write splice.
- [ ] **Step 4:** DOM tests; gallery presets; screenshots.

## Phase 5: Verify + review gate

- [ ] `npx tsc -b` + `npm run test` + `npm run lint` clean.
- [ ] Full gallery playthrough at phone viewport; screenshots into `docs/reference/`; owner sign-off on the 12-segment flow and the open gate decisions (playlist slots; contrast pick grading).

---

## Open items for the gate

- Playlist synthesis: one gate slot vs three.
- Contrast: is the pick graded, or only the why-MCQ?
- Doubly: confirm 2 problems is the right amount of practice (could grow to 3).
- Not in scope but noted: "the head is sacred" is taught (segment 2) but still never graded; decide later whether to add a head-loss check or soften the copy.

## Self-review

- Updated 12-segment / 9-graded map as single source of truth: top of doc. Covered.
- Playlist synthesis (insert+delete+reorder): Phase 2. Covered.
- Contrast pick -> why-MCQ, de-cued: Phase 3. Covered.
- Doubly demo + 2 graded, gated: Phase 4. Covered.
- Cross-references to the bucket plans for shared mechanics; Poly deferred; constraints A + D; house rules: stated. Covered.
