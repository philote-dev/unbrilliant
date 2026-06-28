# Heaps Redesign Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Single source of truth for the updated Heaps lesson, consolidating the lesson review (Jun 28) with the cross-cutting buckets and the shared baseline. Heaps is the PILOT for both the animation depth and the replay-variety buckets. New segments welcome; saved-progress migration is not a concern (owner direction). Poly is deferred (no Poly hints). The ER visual redesign MUST use the frontend-design skill.

**Goal:** Turn Heaps from the most passive of the five into an active, well-practiced lesson: make every sift active (do-the-sift), add a build-a-heap arc, grow the practice, turn the ER real-world into a complex multi-step synthesis, and give the ER its own hospital aesthetic. It is also where the animation pattern (traveling-node sift) and the replay-variety pattern are piloted.

**Architecture:** Pure-engine-first. Sift verdicts already live in the engine (`siftUp` / `siftDownExtract` give the correct swap line); do-the-sift validates each learner swap against that line. Build-a-heap chains inserts. The multi-step ER problem sequences admit/discharge/re-triage ops over the same pure model. Bigger/varied heaps come from the replay-variety pilot. Animation reuses the shared `FrameSequence`. The ER skin is a theme-aware brand takeover built with frontend-design. Must meet `2026-06-27-lesson-revamp-baseline.md`.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Concepts taught: 8 (unchanged), now active and well-practiced

top-only guarantee; lives in a flat array; index math (2i+1 / 2i+2 / (i-1)/2); the heap rule (parent beats both children, siblings unordered, not a BST); insert = append + sift up; extract = last-to-root + sift down (larger child first); tree and array are the same data; sift/peek barely grows vs full sort scales.

## Updated segment map (proposed; several counts are gallery-tunable)

Current: 12 segments, 8 graded (2/2/2/2). Updated: ~15 segments, **~10-11 graded** across siftUp / build / siftDown / mapping / contrast / synthesis.

1. `demo` -> **upgraded to a real free-play insert sandbox** (build a heap by inserting freely; tree + array sync). No longer 2 scripted inserts.
2. `teach-array` - it lives in a flat row; index math. [Baseline: glow + animated teaching.]
3. `teach-rule` - parent beats both children; not a BST.
4. `siftup-1` (siftUp 1) - **do-the-sift** (perform the swaps up). [Bucket 4.]
5. `siftup-2` (siftUp 2) - **NEW** do-the-sift rep on a bigger heap.
6. `watched-build` (teach) - **NEW** watch a heap built by repeated insert + sift.
7. `build-a-heap` (build, graded) - **NEW** insert a sequence to build a valid heap yourself. (1-2 reps, gallery-tunable.)
8. `teach-extract` - last-to-root, sift down, larger child first. [ER monitor showpiece.]
9. `siftdown-1` (siftDown 1) - **do-the-sift** (perform the swaps down).
10. `siftdown-2` (siftDown 2) - do-the-sift, deeper (7-node).
11. `map-child` (mapping 1) - tap the larger child's slot.
12. `map-parent` (mapping 2) - tap the parent's slot.
13. `contrast-place` (contrast 1) - heap vs BST placement.
14. `contrast-samedata` (contrast 2) - tree node to array cell.
15. `er-synthesis` (synthesis, graded) - **NEW complex multi-step ER problem:** admit a patient (insert + sift up), discharge the most urgent (extract + sift down), and re-triage (re-prioritize) -- a sequence of ops on the revamped ER board. Analog of the Linked Lists playlist synthesis.

Proposed gate: siftUp 2 + build 1 + siftDown 2 + mapping 2 + contrast 2 + synthesis 1 = **10** (build could be 2 -> 11). Tune from playthroughs.

## Decisions locked (lesson review, Jun 28)

- Grow practice (do-the-sift active segments + reps + bigger heaps) to ~10-12 graded.
- Build-a-heap arc: a real free-play insert sandbox + a watched build + a graded build-a-heap.
- The ER real-world becomes a complex multi-step problem (admit + discharge + re-triage), like the LL playlist synthesis. Exact ops gallery-tunable.
- ER visual redesign (heavy emphasis, frontend-design, deserves dedicated gallery demo pages).
- Heaps is the animation pilot (traveling-node sift) and the replay-variety pilot (generated heaps).
- Baseline applies.

## ER visual redesign (frontend-design + gallery ideation)

A theme-aware hospital ER brand takeover (it adapts to app light/dark, unlike the fixed Spotify/metro skins, because the owner finds the ER feel reads better with white present in both):
- **Light mode:** white + red, with white dominant (clean clinical).
- **Dark mode:** black + red, still with white present.
- **Accent palette to explore:** bandaid tones (beige / tan / soft pink), hospital-gown tones (pale blue / green / teal), ambulance motif (white + red body, yellow/amber stripe + lights).
- **Motifs:** the ambulance, the triage monitor (existing `MonitorChrome` / ECG), severity as heap key.
- This is an ideation surface: build several **gallery demo pages** for the ER look and the multi-step board, screenshot, iterate with the owner before promoting. Spend boldness on one signature (the triage board / ambulance), keep the rest quiet; stay in Willow identity (do not swap the type system).

## Constraints (baked in)

- **A. No seam / persistence change.** New segments/skills grade through the existing engine; `LessonProgress` shape untouched. (Adding segments/bins is fine; migration not a concern.)
- **D. Gallery + screenshots.** The ER redesign and the multi-step synthesis explicitly get dedicated gallery demo pages; nothing promotes without screenshot review.
- Baseline + house rules: `2026-06-27-lesson-revamp-baseline.md`; no em dashes; no Big-O; house cost words.

---

## File structure

- Modify `src/features/lesson/heapsEngine.ts` (+ `heapsEngine.test.ts`): do-the-sift validators (accept the correct swap from the `siftUp` / `siftDownExtract` line, reject others); the free-play insert sandbox model; build-a-heap (chain inserts, grade the resulting heap); the multi-step `er-synthesis` (sequence admit/discharge/re-triage ops with a per-step verdict); generated valid heaps for variety + bigger sizes; update `HEAPS_PARTS`, bins/quotas, `isCompleteHeaps`.
- Modify `src/lessons/heaps/Stage.tsx`: do-the-sift UI (tap a node then its parent/child to swap), the insert sandbox, the watched build, build-a-heap, the multi-step ER synthesis; reuse `FrameSequence`; baseline glow + reading.
- Modify `src/lessons/heaps/HeapDualView.tsx`: traveling-node sift synced across tree + array (the animation pilot signature); reduced-motion parity.
- Modify `src/lessons/heaps/ERTriageBoard.tsx` + `MonitorChrome.tsx`: the hospital ER redesign (theme-aware palette above), the ambulance motif, the multi-step board; frontend-design pass.
- Modify `src/dev/GalleryApp.tsx`: presets for do-the-sift (idle/mid/wrong/solved), the insert sandbox, the watched build, build-a-heap, the ER synthesis steps, a seed-sample view for generated heaps, AND dedicated ER-look demo pages (palette/layout variants for ideation).

---

## Phases

- [ ] **Phase 1 (animation + variety pilots, do-the-sift):** the Heaps work from `2026-06-27-lesson-animation-depth.md` (traveling-node sift, shared `FrameSequence`, reduced-motion, baseline) and `2026-06-27-replay-variety.md` (generated valid heaps); plus do-the-sift active segments (Bucket 4). This is the pattern other lessons inherit, so get it right here first. Review gate.
- [ ] **Phase 2 (build-a-heap arc):** free-play insert sandbox (upgrade demo); watched build; graded build-a-heap (1-2 reps). Engine-first with tests; gallery presets; screenshots.
- [ ] **Phase 3 (more reps + bigger heaps):** add `siftup-2`; ensure sift segments use bigger/varied generated heaps so it stops feeling baby. Determinism + invariant tests.
- [ ] **Phase 4 (ER synthesis + visual redesign):** the multi-step ER problem (admit/discharge/re-triage) engine + UI; the hospital ER redesign via frontend-design; dedicated gallery demo pages; iterate with the owner on the look + the ops before promoting.
- [ ] **Phase 5 (verify + gate):** `tsc -b` + tests + lint clean; full phone-viewport playthrough; owner sign-off on the segment map, the gate count, the ER look, and the synthesis ops.

---

## Open items for the gate (ideation / tuning)

- Exact build-a-heap rep count (1 vs 2) and final gate (~10-12).
- The ER synthesis ops: admit + discharge + re-triage, or a different mix; re-triage's exact mechanic (remove + reinsert, or change-key + re-sift).
- The ER palette + layout (the dedicated demo-pages exploration).
- Bigger-heap sizes for the sift/build segments (legible on a phone).

## Self-review

- Active (do-the-sift) + grown practice (~10-12) + bigger heaps: segment map + Phases 1-3. Covered.
- Build-a-heap arc (sandbox + watched + graded): Phase 2. Covered.
- Complex multi-step ER synthesis (admit/discharge/re-triage): segment 15 + Phase 4. Covered.
- ER hospital redesign with the specified theme-aware palette, frontend-design, dedicated demo pages: ER section + Phase 4. Covered.
- Animation + variety pilots here; baseline; Poly deferred; constraints A + D: stated. Covered.
