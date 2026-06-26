# Arrays lesson redesign: design (a quiz becomes a lesson)

> Status: design agreed in the Jun 25, 2026 brainstorming, ready for an implementation plan.
> Problem: the shipped Arrays lesson reads as an 8-question quiz wrapped in static
> slides, not a lesson. This redesign rebuilds it as one deep "do, then see" build, to
> the Stacks & Queues (Lesson 1) bar.
> Scope: the Arrays lesson (engine + Stage + figures) and a tactile upgrade to the
> shared rewire drag infra it consumes. Out of scope: other lessons (an S&Q migration
> onto the shared drag engine is optional and later), the course-path "purple trail",
> and the broader Bucket B visual polish, all tracked separately.
> Binding parents: `docs/lesson-design.md` (principles), `docs/lessons/arrays.md` (the
> idea + determinism this keeps and the execution it supersedes), `docs/architecture.md`
> (the `LessonModule` seam).

## What we are building

The same lesson idea, delivered as a lesson instead of a quiz. The pedagogy in
`docs/lessons/arrays.md` is sound; the execution is not. Today four of eleven beats are
static read-only slides (the "tap any cell" demo is not even tappable), the graded beats
are mostly multiple choice, and every consequence (the jump arc, the scan, the ripple,
the doubling copy) plays only as a post-answer reveal. The result is a slideshow around a
quiz.

The fix is one structural rule applied to every graded beat: **predict, then act, then
watch the consequence you caused.** The learner manipulates the strip and the engine
animates the real result of that manipulation, rather than animating an outcome at a
learner who has already guessed from four options.

## The one idea (unchanged)

Contiguity is the whole story: one unbroken block buys instant indexing (a jump, not a
scan) and charges a shift on every middle insert/delete; the end is cheap, except when a
full block must double and copy. Misconception killed: "every array operation costs the
same." Cost is taught by feel via the locked house words (`free` / `scales` /
`usually free`), never as Big-O. This is carried over verbatim from the current spec.

## Why the current lesson fails (the gap to S&Q)

Stacks & Queues (the bar) is a lesson because every beat makes you do something and then
shows the consequence: live `Push`/`Pop` buttons, a structure that builds itself in cell
by cell, a predict beat where the cell actually leaves on reveal (with a step scrubber for
`after-k`), full-bleed real-world scenes, and a genuine drag construct that drains so you
watch the exit order.

Arrays does almost none of that. The demos and teaches are static; access / shift /
classify / grow are mostly multiple choice; the construct beat "drags" to a single drop
target, so the gesture encodes nothing (it violates Principle 7 and is the "feels like tap
to move" the user flagged).

## The new arc: one deep build, three movements

Arrays is a single-idea lesson, so per Principle 6 it gets one continuous build, not S&Q's
twin halves. Nine beats: two interactive free-play intros plus seven graded beats across
eight graded sub-skills.

| # | Beat (`part` id) | What the learner DOES (the verb) | Graded skill |
|---|---|---|---|
| 1 | `play-access` | Tap cells to read; use a "go to index k" stepper that fires the jump arc | none (live intro) |
| 2 | `jump` | De-cued "go to index k" (varied: index k / first / last): tap straight to it, the arc fires ruler to cell | `accessIndex` |
| 3 | `scan` | Same row, "find value v": walk a cursor cell by cell from 0, commit when found. Steps taken = the cost | `accessScan` |
| 4 | `play-mutate` | Drag the new cell into any gap and watch the ripple; tap a cell to delete and watch the close | none (live intro) |
| 5 | `insert` | "Insert X at index k: how many cells move?" Predict the count, then the ripple plays/scrubs to confirm | `insertCount` |
| 6 | `delete` | "Delete index k: how many move?" Predict, then the tail ripples left to close | `deleteCount` |
| 7 | `place-cheapest` | "Add one cell with the fewest shifts. Drop it where it costs least." Drag to a gap; the end is free, a middle drop ripples | `placeCheapest` |
| 8 | `realworld` | Spreadsheet row insert/delete: the same shift in a concrete world (the transfer beat) | `realworld` |
| 9 | `grow` | Append into a capacity frame: free, free, free, then burst (double + copy). Predict "grow? copies?" then "was it cheap?" | `grow` + `growVerdict` |

The standalone construct-to-target beat is removed. Construction now lives inside the
mutation movement: placing a cell at the end is just the zero-ripple case of an insert, so
the fake "append to end" drag disappears and the meaningful drag (choosing among gaps)
takes its place.

## The three signature interactions (the spine)

1. **Walk the scan** (`scan`): the learner advances a cursor one cell at a time until the
   value matches. Doing one action for an index versus n actions for a value is the
   O(1)-vs-O(n) asymmetry felt in the fingers, not read in copy. Rows stay short (n = 6) so
   the scan is at most six steps.
2. **Place the insert** (`play-mutate`, `place-cheapest`): the strip exposes a drop target
   at every gap. Where you drop decides how much ripples, so the gesture finally encodes
   the concept (Principle 7). This is the one place drag is used, and it is genuinely
   multi-target.
3. **Append until it bursts** (`grow`): the learner taps append and feels the rhythm free,
   free, free, BIG. Amortization without the word.

Each graded beat resolves by replaying the motion the learner caused: the jump arc, the
scan walk, the ripple wave, the double-and-copy. This is the existing "why" animation, but
now it is the consequence of the learner's own action rather than a reveal.

## Mechanics and determinism (no-AI, pure of visible state)

Every verdict stays a pure function of visible state. The five-mechanic menu is unchanged:
this lesson uses Predict-the-cost/count (primary), Predict-next-state, and
Classify/spot-the-invariant (the cheapest-position call).

- `accessIndex`: de-cued ask resolves to a cell index. `last` = n - 1, `first` = 0,
  `value-at-k` = k. Pure consequence of 0-indexed addressing; the de-cue is presentational.
- `accessScan`: searched value v is guaranteed unique in the row. The learner's committed
  cursor index must equal index(v); cost = steps = index(v) + 1.
- `insertCount`: insert at index k moves `n - k` (everything from k slides right). Resulting
  row = splice. k curated in range, occasionally k = n to show the end is free.
- `deleteCount`: delete index k moves `n - 1 - k` (everything after k slides left).
- `placeCheapest`: the chosen gap's cost = `n - gap`; correct = the end (gap n, cost 0).
  Curated so the end is strictly cheapest. A middle drop is a real, costed choice, not a
  miss: its ripple plays so the mistake teaches.
- `realworld`: the spreadsheet insert/delete uses the same `n - k` / `n - 1 - k` count over
  a row of named guests; the verdict is the count.
- `grow`: a full block (size = capacity) appends, so it grows: new capacity = 2 * capacity,
  copies = size, landing index = size. The doubling factor is fixed at x2 so the answer is
  unique.
- `growVerdict`: expensive iff this append triggered a grow; cheap otherwise.

Structure guards (inherited): k in range; one op or target at a time; no duplicate values
when an "index of value" or scan ask is present; classify curated so no tie.

## The drag engine decision (the one call to confirm)

Today there are two drag systems: the shared rewire infra (`src/components/rewire/`, used by
Arrays A5 and Linked Lists) arms a source and highlights targets but does not let the cell
follow the finger; Stacks & Queues uses a bespoke `DraggableCard` that physically follows
the finger and glides back on a miss. The arm-then-choose model is what reads as "tap to
move."

Decision: unify on the shared rewire infra, upgraded once to feel tactile. Port the
drag-follow feel from `DraggableCard` into `RewireSource` (the cell tracks the pointer while
dragging; glide-back on a miss), keep the infra's multi-target registry, keyboard path, and
tap fallback, and have the Arrays insert register a drop target at every gap. This answers
"is it the same engine as Lesson 1" with "yes, the shared one, now upgraded so it finally
feels like S&Q," and fixes the feel at the root rather than per lesson. The infra is shared,
so this is coordinated as a shared-engine change (it also touches Linked Lists); migrating
S&Q onto it is optional and out of scope here.

## Mastery gate and persistence

Eight graded sub-skills, mastery = all eight cleared, behind the existing until-correct wall
(`gradeAnswer` + flame unchanged; a beat locks on correct/fail; revealed/failed never count).
The gate count is unchanged, so `LessonProgress` shape, the "n / 8" quota line, reconcile,
and the flame all carry over.

Resume migration: the counter keys change. Map an old run's counters
(`a1 -> accessIndex`, `a3 -> accessScan`, `a2 -> insertCount`, `a2Skin -> realworld`,
`a4 -> placeCheapest`, `a6Grow -> grow`, `a6Cheap -> growVerdict`); `a5` (the removed
construct) is dropped, and the new `deleteCount` starts at 0 (an old run re-earns it). A run
already `completed` stays completed so the next lesson stays unlocked. This mirrors the
forward-compatible resume note already in `arraysEngine.ts`.

## What is reused vs new

- Reuse: `gradeAnswer` + flame + gate; `CostReadout`, `FeedbackFooter`, `StageLayout`; the
  pure `shiftFrames` and `resizeFrames` selectors (now driven forward from the learner's
  action, not as a post-verdict reveal); the address-ruler `ArrayStrip` and `CapacityFrame`
  and `SpreadsheetInsert` figures.
- New: an interactive `play` mode and an `insert` (gap-drop) mode on `ArrayStrip` (tap-read,
  jump stepper, scan cursor, per-gap drop targets, live ripple); an append loop on
  `CapacityFrame`; engine actions for walk-scan, place-at-gap, and append; the tactile
  upgrade to `RewireSource`.

## Accessibility and reduced motion

Tap and keyboard fallbacks for every interaction (the rewire infra already provides
arm/arrow/Enter/Escape; the scan walk and append are plain buttons). Tap targets >= 44px,
visible lilac focus. Feedback pairs icon + text + an SR-only status; the scan and ripple are
announced as step counts. `prefers-reduced-motion` snaps every animation (jump arc, scan,
ripple, copy) to its end state via `useReducedMotion`.

## Test contract (the three seams + determinism)

- Engine unit: `accessIndex` resolves under each ask; `accessScan` returns first-match and v
  is unique; `insertCount` = n - k and the resulting row is correct (ripple right);
  `deleteCount` = n - 1 - k (ripple left); `placeCheapest` end is strictly cheapest (no tie);
  `grow` doubling / copy-count / landing-index and the amortized cheap/expensive verdict;
  the gate flips to complete only after all eight; flame breaks only on a full fail.
- Repository integration: progress (eight counters + currentPart + backing capacity)
  round-trips and resumes on the same beat; the old -> new counter migration maps correctly;
  reconcile (anon -> account) unchanged.
- One E2E tracer: play the nine beats to completion; assert each graded beat gates, the scan
  walk commits, the gap-drop insert lands (with keyboard fallback), and the grow burst plays.
- Per-mechanic determinism: same seed yields the same questions, rows, exits, and verdicts;
  no model calls.

## What this amends

- `docs/lessons/arrays.md`: the idea, determinism, and house words are kept; the beat list,
  question types, and interaction model are superseded by this document. The old A5
  construct-to-target beat is retired.
- The shared drag/rewire infra: gains a tactile drag-follow on `RewireSource`; Arrays becomes
  the first consumer of the multi-gap drop pattern.

## Open questions

- Whether `insert` / `delete` should also let the learner drag-to-place (in addition to
  `place-cheapest`), or stay predict-the-count with a ripple scrubber. Leaning: keep them
  predict-the-count so each beat tests one thing and drag stays the signature of
  `place-cheapest`.
- Real-world skin fidelity (spreadsheet row-insert vs playlist reorder), mirroring the
  printer/browser-Back question from S&Q.
- Whether to teach amortized analysis explicitly or keep `grow` qualitative ("sometimes the
  append copies everything").
- Whether to migrate S&Q onto the upgraded shared drag engine for consistency, or leave its
  bespoke `DraggableCard` (which already feels right).
