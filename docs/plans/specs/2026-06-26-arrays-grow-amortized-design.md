# Arrays "grow" rework: teach memory, reframe the choice, show the average

Date: 2026-06-26
Status: approved (brainstorm), pending spec review

## Context

The dynamic-array section (beats 9-10) currently teaches the doubling mechanic but
never closes the amortized loop. It asserts "usually free, occasional big reshuffle"
without showing why the average stays cheap, and it never justifies doubling over
growing one slot at a time (the exact intuition a learner brings in). Today:

- `teach-grow` (beat 9): a static reading page with a full `CapacityFrame`.
- `grow` (beat 10, graded, two sub-steps): step 0 predicts "what happens?" (double +
  copy); step 1 `growVerdict` asks "was that append cheap?" (expensive).

We want the learner to (1) understand that real memory is a fixed-size block, (2) feel
why growing by one is wasteful, (3) choose doubling as the clean fix, and (4) see, in
plain language, that the average append is basically free.

## Goal

Rework the grow section into three beats: an animated memory teach, a reframed
"cleanest solution" question with a teachable wrong answer (live Poly hint + a
repetitive-copy animation), and a new average-cost summary that contrasts doubling
with grow-by-one.

## Non-goals

- No "amortization" / Big-O jargon in learner-facing copy.
- No changes to the other arrays beats (access, scan, insert, delete, place, realworld).
- Not adding new graded skills; the net graded count goes down by one (verdict removed).

## New beat arc

Total parts 10 -> 11. Graded skills 8 -> 7 (`growVerdict` removed).

| # | Beat (`part`) | Type | Graded skill |
|---|---|---|---|
| 9 | `teach-grow` (upgraded) | teach, animated | none (intro) |
| 10 | `grow` (reframed, single ask) | graded MCQ | `grow` |
| 11 | `grow-summary` (new) | teach/summary | none (intro) |

## Beat 9: memory teach (upgrade `teach-grow`)

Keep the `Eyebrow` + heading + `.concept` highlight style. New flow:

1. Framing prose: real memory hands you one fixed-size block up front; it only holds so
   many cells. "Start thinking: how would you make room for one more?"
2. Animation (the new part): a full block (4 of 4). A new `X` approaches and tries to
   drop in, but there is no slot, so it is rejected (shake + brief red), repeated once.
3. Resolve on the line: "so a new, bigger block has to be made." It sets up the question
   without revealing the answer (no doubling shown yet).

New view-only component `FullBlockReject` (or a `reject` mode on `CapacityFrame`),
deterministic, honoring `prefers-reduced-motion` (snap to the rejected end-state).

## Beat 10: reframed `grow` question

Prompt: "The block is full. What's the cleanest way to make room for one more?" Three
deterministic, seed-shuffled options (same ids as today), reframed as solutions:

- `inplace` "Drop it in the next slot" -> wrong: there is no next slot. A small shake +
  the existing nudge. No Poly hint.
- `growone` "Make a block one bigger and copy everything over" -> wrong but teachable:
  - plays a **repetitive-copy animation**: grow-by-one then copy, a few times, so the
    learner feels that every future append repeats the copy;
  - fires a **live Poly hint** (see "Live Poly" below);
  - then the learner retries.
- `grow` "Make a block twice as big and copy everything over" -> correct: the existing
  double-and-copy `CapacityFrame` reveal + `CostReadout`.

The renderer (`GrowPart`) branches on the selected option, so the wrong-answer treatment
is a pure function of `selected` (fully deterministic). The repetitive-copy visual is a
new deterministic component (e.g. `GrowByOneLoop`, or a mode on `CapacityFrame`).

## Beat 11: average-cost summary (new `grow-summary`)

A non-graded teach page; finishing it completes the lesson. Two stacked parts:

1. **Tally:** a run of ~8 appends into a block that doubles (copies at sizes 1, 2, 4, 8).
   Most appends are instant; a few trigger a copy. Plain-language landing: "8 appends,
   only a few had to copy. Spread out, that is about one step each."
2. **Doubling vs grow-by-one:** side by side over the same run. Doubling copies ~7 items
   total; grow-by-one copies ~28 (every append). The contrast makes "why double" obvious.
   Show the running totals, no Big-O.

New component `GrowSummary` (likely its own file). The numbers are a deterministic
function of a fixed capacity/run, computed by a small pure helper so they can be unit
tested. May reveal/animate in; honors reduced motion.

## Engine and state changes (`src/features/lesson/arraysEngine.ts`)

- `ARRAYS_PARTS`: insert `grow-summary` after `grow`.
- `ARRAYS_SKILLS`: remove `growVerdict` (now 7 skills).
- `ARRAYS_TOTAL_PARTS`: 10 -> 11.
- Non-graded/intro set: add `grow-summary` (and confirm `teach-grow` stays).
- `makeGrow`: reframe `prompt` and option `label`s (ids unchanged: `grow`, `inplace`,
  `growone`); keep the seeded shuffle and `resize` (`{ size: 4, capacity: 4, resizes:
  true }`).
- Remove `makeGrowVerdict` and the `grow` step-0/1 branching; `grow` is a single ask.
- Add a `grow-summary` teach entry (like `teach-grow`: a prompt, no options; carries the
  capacity/run data the summary needs, or the component derives it from a constant).
- `resumeArrays` migration: stop reading/writing `growVerdict`; a save parked on `grow`
  step 1 resumes onto `grow`; recompute totals against 11 parts. Old counters with
  `growVerdict`/`a6Cheap` are ignored, not errored.

## Live Poly hint integration

The learner chose `growone`; the hint must nudge toward "this repeats forever" without
saying "double". Reuse the existing `polyHint` callable + the withhold/verify guardrails.

Backend (`functions/src/poly/`):

- `rubrics.ts`: add a concept rubric (id `arrays`) with three propositions, each with
  usable tokens (per `rubrics.test.ts`): P1 "a full block has no spare room"; P2 "growing
  by a fixed small amount forces a copy on almost every later append"; P3 "a
  proportionally bigger block makes copies rare". The `growone` answer violates P2 (and
  implicates P3); these are the withheld propositions so the model cannot leak the fix.
- `skillMap.ts`: add `grow: { conceptId: "arrays", propositionIds: ["P2", "P3"] }`.
- `hint.ts`: relax `discipline` to include the arrays case (e.g. add `"array"` or a more
  general field) and add a grow-specific branch in `buildUser` (the learner picked
  "grow the block by one slot"; never state the fix). `verifier.findGiveaway` already
  works generically off the withheld propositions.
- Tests: extend `hint.test.ts`, `skillMap.test.ts`, `rubrics.test.ts`.

Client (`src/lib/ai/`):

- `polyClient.ts` `HintRequest`: relax `discipline`; optionally carry the chosen wrong
  option.
- `usePolyHint.ts`: relax the `discipline` type; reuse the hook. For grow, the
  `wrongAttempt` carries the chosen option id (the existing `learnerOrder: string[]`
  field can hold `["grow by one"]`, or add a small field).
- `arrays/Stage.tsx` `GrowPart`: call `usePolyHint`, fire it only on a `growone` wrong
  attempt, and render the hint via `FeedbackFooter`'s `aiHint` (same treatment as S&Q).

Determinism/tests: production needs a functions deploy for live hints, but unit/DOM tests
inject a fake completer (`hint.test.ts` pattern) and a fake `requestHint` (S&Q client
pattern). The hook's deterministic fallback (null hint) keeps the beat fully usable
offline.

Coordination risk (important): `functions/src/poly/hint.ts` and `hint.test.ts` are under
concurrent edit in the working tree. Implementation must integrate against their latest
state (rebase, do not clobber), and the functions changes may want their own commit.

## Components: new and changed

- New: `FullBlockReject` (beat 9 reject animation), `GrowByOneLoop` (beat 10 repetitive
  copy) - or both as modes on `CapacityFrame` if that stays cohesive; `GrowSummary` (beat
  11) + a pure tally helper.
- Changed: `arrays/Stage.tsx` (`TeachGrowPart`, `GrowPart`, new `GrowSummaryPart`, switch
  cases), `arraysEngine.ts` (parts/skills/total/intro/makeGrow/migration), Poly client +
  functions as above.

## Determinism and testing contract

- Engine unit tests: reframed `grow` (single ask, options, answer `grow`), removal of
  `growVerdict`, new `grow-summary` beat, `ARRAYS_TOTAL_PARTS === 11`, 7 graded skills,
  `resumeArrays` migration from old saves, the pure summary tally helper.
- DOM tests: beat 9 reject animation reaches its end-state; beat 10 `growone` shows the
  Poly hint slot + repetitive-copy caption and lets the learner retry, `grow` reveals the
  double-and-copy; beat 11 renders the tally and the doubling-vs-+1 contrast.
- Backend tests: arrays rubric tokens, `grow` skill mapping, the grow hint prompt path,
  verifier still blocks giveaways.
- Gallery presets for eyeball checks: `teach-grow` (with reject), `grow` idle, `grow`
  growone-picked (hint + loop), `grow` correct (burst), `grow-summary`.

## Mastery gate impact

Graded skills drop from 8 to 7 (`growVerdict` removed). The mastery gate counts graded
beats, so it adjusts automatically; confirm the progress/treedmastery surfaces read the
skill list dynamically (no hardcoded 8).

## Rollout / verification

Pure-engine TDD first, then UI, then the Poly wiring. Run the full arrays test suite +
lint, prototype the three visuals in the live gallery, screenshot for review, then commit
(client + lesson in one commit; functions changes coordinated separately given the
concurrent edits).
