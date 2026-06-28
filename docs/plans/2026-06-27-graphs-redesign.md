# Graphs Redesign Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Single source of truth for the updated Graphs lesson, consolidating the lesson review (Jun 28) with the cross-cutting buckets and the shared baseline. New segments welcome; saved-progress migration is not a concern (owner direction). Poly is deferred (no Poly hints). Keep the current metro skin; the focus is the question types and the edge-creation mechanic.

**Goal:** Graphs is the most mechanically varied of the five and already rotates variants, so it needs the least structural help. Sharpen it: make read-path an active trace (teaching traversal), add a build-the-line synthesis, grow the practice, and revamp the edge-creation interaction, while keeping the metro skin.

**Architecture:** Pure-engine-first. Every verdict stays a pure function of the symmetric adjacency (positions never decide anything; that property is the lesson). The trace reuses the pure `reachable` / `pathExists`; build-the-line reuses the rewire infra + `addEdge` over the `METRO_PLAN` ghost data and grades on `sameGraph(working, plan)`. Animation reuses the shared `FrameSequence`. Must meet `2026-06-27-lesson-revamp-baseline.md`.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Concepts taught: 9 -> ~11

Existing: adjacency is the data / picture is decoration; not a tree (no root, cycles); connection list; degree; path exists; match list to picture; draw the missing edge; same graph despite layout; tree vs general graph. **Added:** traversal (you walk the edges to find a path); building/planning a network (route multiple edges toward a plan).

## Updated segment map (proposed; counts gallery-tunable)

Current: 12 segments, 8 graded (read 4 / draw 2 / same 2). Updated: ~13-14 segments, **~10-11 graded** (read 4 / draw 2 / build 1-2 / same 2).

1. `demo` (free play) - drag a node; the data does not move.
2. `teach` - adjacency is the data; not a tree. [Baseline: glow + animated teaching.]
3. `read-list` (Read 1) - multi-select.
4. `read-degree` (Read 2) - multi-select.
5. `read-path` -> **trace** (Read 3) - **REVAMPED:** walk the edges node to node to find the path, then answer. Teaches traversal and shows the flow (no longer a passive yes/no). [Revamped question type.]
6. `match-list` (Read 4) - MCQ.
7. `draw-demo` (free play) - **REVAMPED edge creation:** the improved draw interaction.
8. `draw-edge` (Draw 1) - draw the missing edge. [Revamped edge creation + draw-on animation.]
9. `draw-transit` (Draw 2) - metro skin draw. [Revamped edge creation; keep skin.]
10. `build-the-line` (Build, graded) - **NEW synthesis:** draw several missing edges to grow the active network toward the greyed-out PLAN (the `METRO_PLAN` ghost). The Graphs analog of the LL playlist / Heaps ER synthesis. (1-2 reps, gallery-tunable.)
11. `redraw-demo` (teach) - layout morph; the list never moves.
12. `same-graph` (Same 1) - classify (rotates same/different).
13. `tree-or-not` (Same 2) - classify (rotates tree/graph). Clears the gate.

Proposed gate: read 4 + draw 2 + build 1 + same 2 = 9; add a second build or trace rep for ~10-11. Tune at the gate.

## Decisions locked (lesson review, Jun 28)

- read-path becomes an interactive **trace** (walk edges to find the path; teaches traversal).
- Add the **build-the-line synthesis** (multi-edge, ghost network) AND keep the simpler single-edge draw improvement; **both are in scope**, and both need gallery demoing to get right.
- Grow practice to ~10-12.
- Keep the current metro skin (polish-only: clean the draw-on animation + reading baseline). The energy goes to the question types and the edge-creation mechanic, not a visual reskin.
- Animation: Graphs is 4th in the rollout (broader). Baseline applies. Replay: Graphs already rotates variants; keep curated, no generator needed.

## Constraints (baked in)

- **A. No seam / persistence change.** New segments/skills grade through the existing engine; `LessonProgress` shape untouched. (Adding the build bin is fine; migration not a concern.)
- **D. Gallery + screenshots.** The trace, the revamped edge creation, the single-edge draw improvement, and the build-the-line synthesis all get gallery prototypes + screenshot review; the draw-vs-build work is explicitly "demo to get right."
- Baseline + house rules: `2026-06-27-lesson-revamp-baseline.md`; no em dashes; no Big-O; house cost words. (Graphs has no cost readout; N/A there.)

---

## File structure

- Modify `src/features/lesson/graphsEngine.ts` (+ `graphsEngine.test.ts`): the trace model for read-path (the learner walks edges; the verdict still reads `pathExists`, but the walk is required and gated to adjacent nodes); the `build-the-line` segment over `METRO_PLAN_ADJ` / `METRO_ACTIVE_ADJ` (graded on `sameGraph(working, plan)` after several `addEdge`s); grow the read/build counts; update `GRAPHS_PARTS`, bins/quotas, `isCompleteGraphs`.
- Modify `src/lessons/graphs/Stage.tsx` + `GraphCanvas.tsx` + `SubwayMap.tsx`: the trace interaction (tap adjacent nodes to walk); the revamped edge-creation gesture (clearer armed/legal/hover affordances, snappier draw-on); the build-the-line UI using `SubwayMap`'s `ghost` prop; reuse `FrameSequence`; baseline glow + reading.
- Modify `src/lessons/graphs/AdjacencyPanel.tsx`: keep it the primary data view; light up the row as the trace walks.
- Modify `src/dev/GalleryApp.tsx`: presets for the trace (mid-walk), the revamped single-edge draw, the build-the-line (mid-build, toward the ghost), and the read/same segments.

---

## Phases

- [ ] **Phase 1 (baseline + animation for Graphs):** apply the shared baseline (clean animations, glow, animation teaching, reading); animate edge draw-on + route morph (Bucket 1, Graphs 4th in rollout). Keep the metro skin.
- [ ] **Phase 2 (revamp read-path -> trace, engine-first):**
  - [ ] Test-first: the trace requires walking adjacent nodes from the start; only neighbors of the current node are tappable; the verdict matches `pathExists`; reaching the target (or exhausting) resolves it.
  - [ ] Implement; UI walks the edges and lights the adjacency row; animate the walk.
  - [ ] DOM tests; gallery preset; screenshots.
- [ ] **Phase 3 (edge-creation revamp + single-edge draw improvement):** sharpen the rewire-to-draw gesture (affordances, draw-on); apply to draw-demo / draw-edge / draw-transit. Gallery prototype; screenshot; owner review (this is one half of the "demo to get right").
- [ ] **Phase 4 (build-the-line synthesis, engine-first):**
  - [ ] Test-first: from `METRO_ACTIVE_ADJ`, drawing the missing edges reaches `METRO_PLAN_ADJ`; graded on `sameGraph`; partial builds are not complete.
  - [ ] Implement the segment using the ghost data + `SubwayMap` ghost rendering; 1-2 reps.
  - [ ] Gallery prototype (the other half of "demo to get right"); screenshots; owner review of the build-the-line vs the single-edge draw, keep both, tune.
- [ ] **Phase 5 (more reps + verify):** add the read/build rep(s) to hit ~10-11; `tsc -b` + tests + lint clean; full phone-viewport playthrough; owner sign-off on the segment map + gate.

---

## Open items for the gate (demo to get right)

- The build-the-line mechanic: how many edges, how the ghost plan reads, 1 vs 2 reps.
- The single-edge draw improvement vs the build-the-line: keep both (decided), but tune where each sits and the edge-creation gesture feel.
- The trace: how strictly to gate the walk (only neighbors) vs allow exploration; how to show a dead end.
- Final gate count (~10-11).

## Self-review

- read-path -> interactive trace (teaches traversal, show-the-flow): Phase 2. Covered.
- Build-the-line synthesis (ghost network) AND single-edge draw improvement, both in, demo to get right: Phases 3-4. Covered.
- Grow practice ~10-12; revamp question types + edge creation; keep metro skin (polish only): segment map + Phases 1-5. Covered.
- Animation (4th rollout), baseline, curated variants kept, Poly deferred, constraints A + D: stated. Covered.
