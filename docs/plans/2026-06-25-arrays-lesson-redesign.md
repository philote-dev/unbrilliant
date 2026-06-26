# Arrays Lesson Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline)
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Arrays lesson as a "predict, then act, then see the consequence"
build to the Stacks & Queues bar, replacing static demo/teach slides and the single-target
construct drag.

**Architecture:** Pure engine (`arraysEngine.ts`) drives a 9-beat flow (2 live intros + 7
graded beats across 8 sub-skills). The new interactions reuse the existing `LessonAction`
vocabulary, so the scan "walk" and grow "burst" are local Stage state and only committed
results are graded. Drag uses the shared rewire infra with a drop target at every gap.

**Tech Stack:** React 19, TypeScript, Vitest (jsdom), motion, the shared `LessonModule`
seam + `gradeAnswer` flame/gate.

**Spec:** `docs/plans/specs/2026-06-25-arrays-lesson-redesign-design.md`

---

## File structure

- Modify: `src/features/lesson/arraysEngine.ts` (rewrite: parts, skills, makers, reducer,
  selectors, resume migration; keep `shiftFrames` / `resizeFrames` as-is).
- Modify: `src/features/lesson/arraysEngine.test.ts` (rewrite for the new design).
- Modify: `src/lessons/arrays/ArrayStrip.tsx` (add `play` interactive + `insert` gap-drop +
  scan-cursor rendering).
- Modify: `src/lessons/arrays/arrayStripLayout.ts` (+ `.test.ts`) (gap geometry helpers).
- Modify: `src/lessons/arrays/CapacityFrame.tsx` (append/burst on a tap).
- Modify: `src/lessons/arrays/Stage.tsx` (+ `Stage.test.tsx`) (9 beats wired to engine).
- Modify: `src/lessons/arrays.tsx` (module: `totalParts` is now 9; combo/completed/filled).
- Modify: `src/components/rewire/RewireSource.tsx` (tactile drag-follow; additive).
- Modify: `e2e/*arrays*` tracer if present (play the 9 beats).

## New engine API (the contract)

```ts
export const ARRAYS_PARTS = [
  "play-access", "jump", "scan",
  "play-mutate", "insert", "delete", "place-cheapest", "realworld",
  "grow",
] as const
export const ARRAYS_SKILLS = [
  "accessIndex", "accessScan", "insertCount", "deleteCount",
  "placeCheapest", "realworld", "grow", "growVerdict",
] as const // gate = 8
// INTRO_PARTS = { "play-access", "play-mutate" }
```

- `jump` (skill `accessIndex`): de-cued ask in {value-at-k, first, last}; `answerIndex`;
  graded on tapped index. `cost free`.
- `scan` (skill `accessScan`): unique-value row; value `v` at idx (2..n-1); `answerIndex=idx`;
  the walk is local Stage state, engine grades the committed index. `cost scales`, count `idx+1`.
- `insert` (skill `insertCount`): row len 5..6; insert at k; `moved = len - k`; MCQ count
  options; `answer = n{moved}`; `op` drives the post-verdict ripple. `cost scales`.
- `delete` (skill `deleteCount`): `moved = len - 1 - k`; MCQ count; `op`; `cost scales`.
- `place-cheapest` (skill `placeCheapest`): row n; gap targets `gap-0..gap-n`; correct =
  `gap-{n}` (the end, cost 0); drop via `rewire` sets `selected`; graded on `check`. `cost free`.
- `realworld` (skill `realworld`): spreadsheet insert/delete at k; MCQ count; reuses
  `SpreadsheetInsert`. `cost scales`.
- `grow` (skills `grow` then `growVerdict`): full block (cap 4); step 0 MCQ "what happens?"
  answer `grow`; step 1 MCQ "was it cheap?" answer `expensive`. `cost usually free`.

State additions: none required beyond the existing shape minus `construct`. Reuse `selected`
for the MCQ id / tapped index / chosen gap id; keep `step` (0|1) for the `grow` two-asker.

Selectors: `currentPartArrays`, `isTerminalA`, `filledPartsArrays`, `gradedCleared`,
`partQuotaArrays`, `isCompleteArrays`, `hasProgressArrays`, and new `gapTargetsArrays(state)`
returning `{gap-0..gap-n}` on `place-cheapest` while not terminal. Drop `constructReadyA` /
`legalTargetsArrays` (construct beat removed).

Resume migration in `resumeArrays`: map old counters
(`a1->accessIndex`, `a3->accessScan`, `a2->insertCount`, `a2Skin->realworld`,
`a4->placeCheapest`, `a6Grow->grow`, `a6Cheap->growVerdict`); `a5` dropped; `deleteCount`
defaults 0; preserve `completed`. `toProgressArrays` writes the new keys.

## Tasks (TDD; commit per logical slice that stays green)

### Task 1: Engine rewrite
- [ ] Rewrite `arraysEngine.test.ts` for the new flow/skills/makers/determinism; run, watch fail.
- [ ] Rewrite `arraysEngine.ts` to green; keep `shiftFrames`/`resizeFrames`.
- [ ] `npm test src/features/lesson/arraysEngine.test.ts` green.

### Task 2: Figures
- [ ] `arrayStripLayout.test.ts`: gap-center geometry; run, fail; add helper; green.
- [ ] `ArrayStrip` `play` + `insert` (gap RewireTargets) + scan-cursor; `CapacityFrame` burst-on-tap.

### Task 3: Stage + module
- [ ] Rewrite `Stage.tsx` (9 beats) + `Stage.test.tsx`; update `arrays.tsx` (`totalParts`).
- [ ] `npm test` (full) green.

### Task 4: Rewire tactile upgrade (additive)
- [ ] Add drag-follow to `RewireSource` (pointer-tracked transform; glide back on miss);
      keep arm/keyboard/tap; existing rewire tests green.

### Task 5: Wiring + verification
- [ ] Update the e2e arrays tracer to the 9 beats.
- [ ] `npm test` + `npm run lint` + `npm run build` all green; fix fallout.

## Determinism checks (must hold)

Same seed yields identical questions/rows/verdicts; `insertCount = len-k`,
`deleteCount = len-1-k`, `place-cheapest` end strictly cheapest, `grow` doubles/copies=size,
verdict expensive iff it grew; gate flips only after all 8; flame breaks only on a full fail.
