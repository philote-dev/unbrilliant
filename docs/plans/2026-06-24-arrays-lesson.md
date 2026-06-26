# Arrays / Dynamic Arrays redesign: build plan

> Planner pass, Jun 24 2026. Binding spec: `docs/lessons/arrays.md`. Principles:
> `docs/lesson-design.md`. Visual: `docs/design/design-system.md`. Exemplar: Linked
> Lists (`linkedListsEngine.ts`, `linkedLists/Stage.tsx`, `NodeGraph.tsx`,
> `graphLayout.ts`, `PlaylistQueue.tsx`). Construct precedent: S&Q
> (`stacksQueuesEngine.ts` construct beat).

## 0. Spec vs code mismatches (read before building)

Places where `arrays.md` disagrees with the codebase as it exists, each with a
recommended resolution folded into the plan.

1. "Arrays is the infra's first downstream consumer" is false now. The rewire
   infra (`RewireSurface` / `useRewireNode`) is already consumed by Linked Lists,
   Hash Tables, Trees, and Graphs. Arrays is the last consumer. Upside: the infra
   is battle-proven, there is no L0-coupling left to factor out, and the
   keyboard/tap/SR fallbacks already pass in E2E. Treat the infra as frozen and
   consume it.
2. Engine path. The spec says `src/lessons/arrays/arraysEngine.ts`; every other
   lesson lives at `src/features/lesson/<name>Engine.ts`. Use the convention path
   `src/features/lesson/arraysEngine.ts` as the final home, developed temporarily
   under `src/lessons/arrays/` during the parallel build (see section 5).
3. A5 "end-append (+ at most one middle insert)" is not uniquely orderable when
   mixed. Recommend shipping A5 as prefix + end-appends (one unique order = the
   target order). See 2.7 and Q3.
4. Persisting "backing capacity" (spec test contract): do not persist it. Resume
   is "same beat, fresh seeded instance" for every lesson, so A6 capacity is
   reseeded. Durable slice stays the 8 counters + `currentPart` + `completed` +
   `attempts`. See Q4.
5. `partQuota` semantics. Current returns per-part 3/3/2; spec wants a single
   "n of 8". New selector returns `{ done: gradedCleared, total: 8 }`.
6. `ArrayRow` is shared: Linked Lists imports it (`linkedLists/Stage.tsx`,
   `ContrastPart`). It cannot be deleted blindly. The new `ArrayStrip` supersedes
   it; migrate LL's one usage at cutover (fallback: keep `ArrayRow` for LL).
7. There is no separate "count" beat anymore. The old `cost` part (grade the
   moved-count as a number) has no spec beat; cost is taught visually as ripple
   length and folded into A2's reveal. The 8 graded beats are the A1 to A6 set,
   not the old 3 shift + 3 cost + 2 resize.
8. The emulator suite has no Arrays round-trip (it covers S&Q/LL/HT/Trees/Heaps/
   Graphs). The spec requires one, so we add it.
9. Beat 11 is two graded checks: one part with two sub-questions (grow-predict,
   then "was it cheap?"). Precedent: S&Q's compare beat.

## 1. Goal + scope

Replace the old 4-part MCQ Arrays engine (`access` / `shift` / `cost` / `resize`,
skinned as an aerial parking lot) with the spec's 11-beat curated lesson: a
free-play demo, then a name-the-rule teach, then graded questions ("do, name,
test"), across an Access face (A1 de-cued access, A3 access-vs-search), a Mutation
face (A2 shift-predict, A2 spreadsheet skin, A4 classify-by-position, A5
construct-to-target), and a Growth synthesis (A6 grow-predict + amortized
verdict). Mastery = clear all 8 graded beats behind the existing until-correct
wall. The visual language becomes the contiguous strip + address ruler + ripple
(jump-arc vs scan) and the capacity frame (double-and-copy). The `LessonModule`
seam, `arraysModule` export shape, `gradeAnswer` and flame, the `LessonProgress`
boundary, and the catalog wiring stay stable; Arrays stays live as lesson 2; the
S&Q -> Arrays -> LL E2E chain stays green; every dependent test is rewritten,
never weakened.

Kept (reused): the shared seam + feedback machine (`gradeAnswer`,
`FeedbackFooter`, `AnswerCard`, `CostReadout`), the rewire infra
(`RewireSurface` / `RewireSource` / `RewireTarget` / `useRewireNode` / `core.ts`),
the deterministic `rngNext` / `rngInt` / `shuffle` / `splice` helpers, and the
strong reusable bits: the pure `shiftFrames` and `resizeFrames` selectors
(staggered one-slot ripple; doubling/copy frames; final frame = end-state for
reduced motion). These map onto the spec's ripple discipline and capacity frame
and are already unit-tested.

Replaced (deleted): the parking-lot skin and metaphor.
`src/lessons/arrays/ParkingLot.tsx`, `src/lessons/arrays/parkingData.ts`, the
`LotScene` / `DriveAisle` / `SignButton` / parking theme in `Stage.tsx`, and the
old engine parts and question-makers (`makeAccess` / `makeShift` / `makeCost` /
`makeResize`, the `accessed` field, `ARRAYS_PARTS = [access,shift,cost,resize]`).
The parking lot obscures contiguity and "index = address" (the load-bearing
facts) and is not the spec's vocabulary.

## 2. Engine design (`src/features/lesson/arraysEngine.ts`)

### 2.1 Parts: the 11-beat flow

```ts
export const ARRAYS_PARTS = [
  "demo",          // 1 free play: tap to read, watch the ruler (intro)
  "teach-access",  // 2 name "instant access" - a jump, not a scan (teach)
  "a1-access",     // 3 A1 de-cued "value at index k?" (graded)
  "a3-contrast",   // 4 A3 index-jump vs value-scan (two asks, one gate) (graded)
  "shift-demo",    // 5 free play: insert/delete, watch the ripple (intro)
  "teach-shift",   // 6 name "the shift cascade" (contiguity forbids gaps) (teach)
  "a2-shift",      // 7 A2 predict the resulting row (graded)
  "a2-skin",       // 8 A2 spreadsheet row-insert (real-world) (graded)
  "a4-classify",   // 9 A4 front / middle / end: cheapest? (graded)
  "a5-construct",  // 10 A5 construct-to-target (append-pinned, drag) (graded)
  "a6-grow",       // 11 A6 grow-predict + "was that append cheap?" (graded x2)
] as const
export type ArraysPart = (typeof ARRAYS_PARTS)[number]
export const ARRAYS_TOTAL_PARTS = ARRAYS_PARTS.length // 11
```

The 8 graded counters: `a1, a3, a2, a2Skin, a4, a5, a6Grow, a6Cheap`. (Beats 3,
4, 7, 8, 9, 10 = 6 single-counter beats; beat 11 = 2. A3's two asks share one
counter; A6's two checks are two counters. Total 8, matching the spec gate.)

### 2.2 State shape

```ts
interface ArraysState {
  seed: number; rngState: number; partIndex: number; attempts: number
  combo: number; completed: boolean
  // graded counters (each 0 | 1)
  a1: number; a3: number; a2: number; a2Skin: number
  a4: number; a5: number; a6Grow: number; a6Cheap: number
  question: ArraysQuestion | null
  selected: string | null               // MCQ id OR de-cued tapped index (stringified)
  construct: { loose: string[]; placed: string[] } | null  // A5 working state
  step: number                          // sub-step for two-ask beats (a3, a6): 0 | 1
  wrongCount: number; feedback: Feedback; revealed: boolean; showWhy: boolean
}
```

`ArraysQuestion` is one discriminated record carrying everything each beat's
figure + grader needs (keep `ArrayOp` / `ArrayResize` / `ArraysOption`; they feed
`shiftFrames` / `resizeFrames`):

```ts
type AskA1 = "value-at-k" | "last-element" | "first-element"
interface ArraysQuestion {
  kind: ArraysPart
  prompt: string
  cells: string[]                 // the strip contents
  ask?: AskA1 | "index" | "value" // A1 ask variant; A3 sub-ask
  k?: number                      // index in question (A1, A3-index)
  value?: string                  // searched value (A3-value); MUST be unique in cells
  answerIndex?: number            // de-cued tap answer = a cell index (A1, A3)
  op?: ArrayOp                    // A2 / A2-skin -> drives shiftFrames ripple
  options?: ArraysOption[]        // A2/A2-skin/A4/A6 MCQ
  answer?: string                 // winning option id (MCQ beats)
  target?: string[]; partial?: string[]; correctOps?: string[]  // A5
  resize?: ArrayResize            // A6 -> drives resizeFrames doubling
  cost: { word: CostWord; count: number; unit: string }  // locked house word
  hint: string; nudge: string; correct: string; why: string
}
```

### 2.3 Per-type seeded question makers (A1 to A6)

All deterministic (`seed -> next`), authored as seedable parameters (n, k, value,
capacity) so the curated 8 ship now and randomized retries are a parameter swap.

- `makeIntro(kind)` for `demo`, `teach-access`, `shift-demo`, `teach-shift`.
  Read-only strip(s); no options.
- `makeA1(seed)` (beat 3, de-cued access). `cells = LETTERS.slice(0, 5..6)`. Pick
  `ask in {value-at-k, last-element, first-element}`; `k` accordingly. `answerIndex
  = k`. De-cue is presentational (no lit cell). `cost = { "free", 1, "step" }`.
  "index of value" stays out of A1 (Q2).
- `makeA3(seed)` (beat 4, two asks, one gate). Step 0 `ask:"index"`, `k` random,
  `answerIndex = k` (index -> value, one jump). Step 1 `ask:"value"`, pick a unique
  `value`, `answerIndex = cells.indexOf(value)` (value -> first-match index, by
  scan). Guard: when the value-ask is present, `cells` has no duplicates.
- `makeA2(seed)` (beat 7, predict the row). Reuse the current `makeShift` body:
  `len 4..5`, insert at `1..len-1` or delete at `1..len-2` (always a real shift),
  build the resulting-row MCQ from the existing distractor set. `answer` = the true
  row; `op` stored for the post-verdict ripple; `cost = { "scales", n-k, "elements
  moved" }`. End-insert variant (index = n) ripples nothing (legal distinct
  instance).
- `makeA2Skin(seed)` (beat 8, spreadsheet). `makeA2(seed)`, then re-skin copy +
  `kind:"a2-skin"`. Same op, same verdict, themed figure.
- `makeA4(seed)` (beat 9, classify). `n >= 3`. Three distinct positions: front
  (cost n), middle (cost n-k), end (cost 0). Options `front | middle | end`,
  `answer = "end"`. Curate so no tie. Reveal surfaces all three ripple lengths.
- `makeA5(seed)` (beat 10, construct). `target = LETTERS.slice(0, 4..5)`; split
  `p in 1..n-1`; `partial = target.slice(0, p)` (a true prefix), `loose =
  shuffle(target.slice(p))`, `correctOps = target.slice(p)` (unique append order).
  Seeds `state.construct = { loose, placed: [] }`. `cost = { "free", 0, "" }` per
  append-with-room. (See 2.7 and Q3.)
- `makeA6(seed)` (beat 11, grow). Seed full so the synthesis always doubles+copies:
  `capacity in {4,8}`, `size = capacity`, `resizes = true`. Step 0 grow-predict
  MCQ -> `answer = "grow"`; distractors "add in place" / "grow by one, copy one".
  Step 1 "was that append cheap?" -> `answer = "expensive"`. `cost = { "usually
  free", size, "items copied" }`; gloss in `why` only (chip stays the bare enum
  word; existing tests pin this).

### 2.4 Reducer cases

- `continue`: demo/teach beats only -> `enterPart(next index)`. Graded beats
  advance via `next`.
- `select`: MCQ + de-cued tap (`selected = action.letter`, idle); ignore while
  `construct != null` (A5 uses `rewire`) and when terminal. De-cued A1/A3 store the
  stringified tapped cell index.
- `rewire` (A5 append): append `from` to `construct.placed` if `from in loose`,
  `to === "end"`, and a loose cell remains; remove from `loose`; feedback idle.
- `check`: grade per beat through `gradeAnswer` (unchanged):
  - MCQ beats (a2, a2Skin, a4, a6-step): `correct = selected === answer`.
  - de-cued beats (a1, a3-step): `correct = Number(selected) === answerIndex`.
  - A5: `correct = constructReady && placed deep-equals correctOps`. On wrong,
    reset the bin (`loose = [...placed, ...loose]; placed = []`).
  - On correct, bump the beat counter (a3 step0: no bump, unlock step1; a6 step0 ->
    `a6Grow=1`; a6 step1 -> `a6Cheap=1`; a3 step1 -> `a3=1`). `attempts++` always.
- `reveal`: `showWhy = true` (fires the why-animation: jump arc / scan / ripple /
  copy).
- `reattempt`: re-roll a fresh seeded instance (refill A5 bin; reset `step`).
  Pristine-idle only.
- `next` on `feedback === "correct"`:
  - `a3` step0 -> load step1 (value ask), `step=1`, FRESH (keep `cells`); step1 ->
    `enterPart(shift-demo)`.
  - `a6` step0 -> load step1 (cheap MCQ), `step=1`; step1 -> `{ completed: true }`.
  - other graded beats -> `enterPart(next index)`.

`enterPart` builds the part question + resets `FRESH` (and seeds `construct`/`step`
for a5/a3/a6), like the current `enterPart` and LL's.

### 2.5 Selectors

```ts
currentPartArrays(s)   // ARRAYS_PARTS[s.partIndex] (keep name)
isTerminalA(s)         // feedback === "correct" | "fail" (keep name)
filledPartsArrays(s)   // s.completed ? 11 : s.partIndex
gradedCleared(s)       // a1+a3+a2+a2Skin+a4+a5+a6Grow+a6Cheap (0..8)
partQuotaArrays(s)     // graded part ? { done: gradedCleared(s), total: 8 } : null
isCompleteArrays(s)    // all 8 counters === 1
hasProgressArrays(s)   // partIndex > 0 || gradedCleared(s) > 0
legalTargetsArrays(s)  // A5: construct.loose.length ? new Set(["end"]) : new Set()
constructReadyA(s)     // !!construct && construct.loose.length === 0
```

Keep the pure view selectors `shiftFrames(cells, op)` and `resizeFrames(resize)`
unchanged (re-skinned by `ArrayStrip` / `CapacityFrame`). New geometry lives in
`arrayStripLayout.ts` (section 3).

### 2.6 toProgress / resume / hasProgress (durable shape + migration)

```ts
toProgressArrays(s): LessonProgress = {
  counters: { a1, a3, a2, a2Skin, a4, a5, a6Grow, a6Cheap, attempts },
  currentPart: currentPartArrays(s),
  completed: s.completed || isCompleteArrays(s),
}
```

`resumeArrays(progress, seed)`: reseed a fresh run, restore each counter via
`clamp(c.<key> ?? 0, 1)`, `attempts = c.attempts ?? 0`, `partIndex = max(0,
ARRAYS_PARTS.indexOf(progress.currentPart))`, `step = 0`, `completed` preserved
(cold combo, fresh question).

Migration (cutover day): a learner mid-old-Arrays has `{ shiftPredict / costCount /
resizePredict, currentPart: "shift"|"cost"|"resize" }`. Under the new resume,
every new key reads `?? 0`, and `indexOf("shift")` -> `-1` -> `partIndex 0`
(restart at the demo). Completed old runs keep `completed: true`, so Linked Lists
stays unlocked and no one is hard-broken. Document it in the engine header.

### 2.7 A5 construct grading (the order question)

Same model as S&Q's `gradeConstruct` (`stacksQueuesEngine.ts`), retargeted to a
growing strip:

- The loose cells are `RewireSource`s; the strip's end is a single `RewireTarget`
  (`id:"end"`). Each commit dispatches `rewire { from: cellId, to: "end" }`, which
  appends to `placed`.
- `correctOps` = the target's left-to-right order of the loose cells (since
  `partial` is a true prefix, this is append-in-target-order, uniquely determined
  by the target row).
- `gradeConstruct(work, q) = work.placed.length === q.correctOps.length &&
  work.placed.every((id,i) => id === q.correctOps[i])`.
- Check is gated by `constructReadyA` (all loose placed); a wrong order resets the
  bin and grades through `gradeAnswer` (nudge, then full fail), so the flame breaks
  only on a full fail.

Reuses the proven rewire path (keyboard/tap/drag/SR for free) and pins the op set
so there is exactly one correct answer (Q3 explains why the mixed middle-insert is
dropped from the curated instance).

## 3. Figures

All under `src/lessons/arrays/`. Tokens only (light/dark), `useReducedMotion`
everywhere, >=44px taps, focus rings, SR live regions, color never the sole
signal.

### 3.1 `arrayStripLayout.ts` (pure geometry, node-unit-tested)

Mirror `graphLayout.ts`'s discipline (jsdom zeroes `getBoundingClientRect`, so
routing math lives here). Constants `CELL_W` / `CELL_H` / `GAP=0` (cells touch:
contiguity is load-bearing), `RULER_H`. Functions:

- `stripCellX(i)`, `cellBox(i)`, `rulerTickX(i)`: contiguous cells over a ruler
  beneath.
- `jumpArcPath(k)`: a single arc from ruler tick k to cell k's rim (the O(1) hop).
- `scanPath(0..k)`: sequential cell-center polyline (the O(n) walk).
- `capacitySlots(capacity)`, `doubledLayout(capacity)`: filled/empty slot boxes;
  the 2x frame + copy-source-to-dest mapping.
- `stripExtent(n)`: total drawing surface (+ ruler).

### 3.2 `ArrayStrip.tsx`

Three modes:

- read: contiguous cells, ruler beneath, de-cued (no pre-highlight). Tappable for
  A1/A3-index. On reveal: `jumpArcPath(k)` for index asks, `scanPath` for value
  asks; SR announces the hop/step count.
- predict (ripple): renders `shiftFrames(cells, op)` as staggered one-slot
  translations (end-insert moves nothing); final frame = end-state so reduced
  motion snaps. Post-verdict only.
- construct: the growing placed prefix as a contiguous strip + a highlighted empty
  "next slot" (`RewireTarget id:"end"`); loose cells render below as
  `RewireSource`s.

Dev-only tracer hooks: `data-answer="1"` on the correct cell in read mode; on
construct sources, an sr-only span with `data-write-order` (index in `correctOps`)
+ `data-rewire-correct-target="end"`, so the existing `rewireInOrder` tracer helper
drives A5 unchanged.

### 3.3 `CapacityFrame.tsx`

A frame sized to capacity (filled vs empty slots visible); on overflow renders
`resizeFrames(resize)`: allocate the 2x frame, copy every item across (the big
ripple), drop the new item. Reduced motion snaps to the doubled end-state. Drives
A6's figure.

### 3.4 `SpreadsheetInsert.tsx` (real-world skin, beat 8)

A themed vertical figure (header row, row numbers = indices) reusing the same A2
`op` + `shiftFrames`: inserting a row shifts the rows below down. Mirrors
`PlaylistQueue`'s "themed figure reusing the same engine op." (Q1.)

### 3.5 Reuse / delete

- Reuse: `shiftFrames`, `resizeFrames` (pure, tested); `CostReadout` (locked
  words); `AnswerCard`; `FeedbackFooter` (with `hideFailHint` for SR-only fail
  copy); the rewire primitives.
- Delete: `ParkingLot.tsx`, `parkingData.ts`.
- `ArrayRow.tsx`: supersede with `ArrayStrip`, migrate LL's one usage at cutover,
  then delete. Fallback: keep `ArrayRow` for LL.

## 4. Stage (`src/lessons/arrays/Stage.tsx`, rewritten)

A `switch (currentPartArrays(state))` over all 11 beats (mirrors
`LinkedListsStage`). All verdict UX through `FeedbackFooter` (`hideFailHint`, so no
fail sentence; Why?/Reattempt + an SR-only status carry it). Quota chip reads
`partQuotaArrays` -> "n of 8" on graded beats.

- `demo` / `shift-demo`: free-play `ArrayStrip`, `Continue` (`continue`). Play
  optional, not gated.
- `teach-access` / `teach-shift`: `ArrayStrip` + copy naming instant access (a
  jump, not a scan) / the shift cascade (contiguity forbids gaps), `Continue`.
- `a1-access`: `ArrayStrip` read mode, de-cued; tap a cell -> `select`; jump-arc +
  `free, 1 step` on reveal.
- `a3-contrast`: two steps; index ask (jump-arc on reveal) then value ask (scan on
  reveal); `a3` clears on step-1 correct.
- `a2-shift`: `ArrayStrip` predict mode; resulting-row `AnswerCard` MCQ
  (`answerMarker`); ripple + `scales, n-k` on reveal.
- `a2-skin`: `SpreadsheetInsert`; same MCQ.
- `a4-classify`: front/middle/end MCQ; reveal shows the three ripple lengths.
- `a5-construct`: `RewireSurface` (legal target = `end` while loose remain)
  wrapping `ArrayStrip` construct mode; `FeedbackFooter` with
  `canCheck={constructReadyA(state)}`.
- `a6-grow`: `CapacityFrame`; two steps (grow-predict MCQ, then cheap/expensive
  MCQ); copy animation + `usually free` on reveal.

De-cued discipline: no pre-highlight on access; predict-before-motion (ripple/copy/
arc/scan all gated to `reveal`).

## 5. Tracer-bullet slices (de-risk A5 + ripple first; main stays green every slice)

Arrays is the only live lesson exercised by the single whole-chain E2E, so it
cannot be half-migrated in place. Slices 1 to 4 are purely additive (new engine +
figures developed at `src/lessons/arrays/arraysEngine.ts`, wired to a temporary
gallery-only `arraysModuleNext` + an "Arrays new" gallery entry); the live
`arraysModule`, the tracer, and existing tests stay untouched and green, while
every slice is unit-tested and visually checkpointable. Slice 5 is the single
atomic cutover (flip the module, relocate the engine to the convention path,
rewrite dependent tests, delete the old skin).

### Slice 1: Tracer bullet, `ArrayStrip` + geometry + A5 construct (riskiest)

- Files (new): `arrays/arrayStripLayout.ts` (+ `.test.ts`), `arrays/ArrayStrip.tsx`,
  `arrays/arraysEngine.ts` (full 11-part skeleton; fully implements `demo` /
  `teach-access` / `a5-construct` + keeps `shiftFrames` / `resizeFrames`), temp
  `arraysNext.tsx` (`arraysModuleNext`) + an "Arrays new" gallery entry.
- Engine: `state.construct`, `legalTargetsArrays`, `constructReadyA`,
  `gradeConstruct`, `rewire` append case, `makeA5` (prefix+append, unique order),
  `makeIntro`.
- Figure: contiguous cells + ruler; ripple frames (staggered one-slot,
  reduced-motion snap) proven via a gallery preview; construct mode.
- Tests: geometry (cells strictly increasing & touching gap 0; ruler ticks centered;
  jump-arc endpoints; scan visits 0..k); engine A5 (correct order clears, wrong
  resets + nudge->fail, `constructReadyA` gate, determinism); a DOM test that append
  commits via tap + keyboard through the rewire surface.
- Gallery: A5 presets (idle / placing / correct / wrong-reset / fail+why) + a
  ripple-from-(op,k) preview.

### Slice 2: Access face, A1 + A3 + demo/teach-access

- Engine: `makeA1` (ask variants), `makeA3` (two-step, unique-value guard),
  select/check/next, `a1` / `a3` counters.
- Figure: `ArrayStrip` read mode (de-cued); jump-arc (A1, A3-index) and scan
  (A3-value) on reveal; SR step counts.
- Tests: A1 answer = cell at k under each ask; A3 index->value-at-k,
  value->first-match index, uniqueness guard, `a3` clears only when both steps pass;
  failed/revealed never count; DOM (no lit cell pre-tap; arc/scan post-verdict only).
- Gallery: A1/A3 presets.

### Slice 3: Mutation predicts, shift-demo + teach-shift + A2 + A2-skin

- Engine: `makeA2` (resulting-row MCQ, op stored), `makeA2Skin` (re-skin),
  `a2` / `a2Skin`, shift-demo/teach-shift.
- Figure: `ArrayStrip` predict mode (ripple gated to reveal; end-insert ripples
  nothing); `SpreadsheetInsert.tsx`.
- Tests: A2 resulting row + moved-count n-k for insert (ripple-right) / delete
  (ripple-left); end-insert moves 0; A2-skin same op/verdict; distractors distinct;
  DOM (ripple post-verdict; rows shift; `scales` chip).
- Gallery: A2 + A2-skin presets.

### Slice 4: Classify + Grow synthesis, A4 + A6 (completes the new engine)

- Engine: `makeA4` (n>=3, no tie, cheapest=end), `makeA6` (seeded full;
  grow-predict + cheap two-step), `a4` / `a6Grow` / `a6Cheap`, `partQuotaArrays`
  ("n of 8"), `isCompleteArrays`, completion on all 8.
- Figure: `CapacityFrame.tsx`; A4 reveal shows three ripple lengths.
- Tests: A4 cheapest=end, no tie; A6 new_cap=2C, copies=count, landing=count,
  expensive-iff-grew; gate flips complete only after all 8; flame breaks only on
  full fail; combo spans the 8; full happy-path completes; DOM.
- Gallery: A4 + A6 presets; the new Stage is fully walkable end-to-end.

### Slice 5: Cutover (atomic) + wiring + dependent tests + cleanup

- Relocate the new engine to `src/features/lesson/arraysEngine.ts` (overwrite old).
- Point `src/lessons/arrays.tsx` (`arraysModule`) at the new engine + new
  `arrays/Stage.tsx` (id "arrays", `LessonModule` interface unchanged -> `lessons.ts`,
  `catalog.ts`, `registry.tsx` need no change).
- Delete `ParkingLot.tsx`, `parkingData.ts`, the temp `arraysNext.tsx` + temp
  gallery entry; migrate LL's `ArrayRow` usage to `ArrayStrip`, delete `ArrayRow.tsx`
  (or keep, see 0-6).
- Rewrite (not weaken) the dependents in sections 6/7.
- Run `npm test`, `npm run test:emulator`, `npm run e2e`; walk the gallery.

## 6. Test contract

Engine unit (`arraysEngine.test.ts`, node):

- A1: value/cell correct under each ask (value@k, last, first); de-cue is
  presentational.
- A2: moved-count = n-k and resulting row correct for insert (ripple-right) and
  delete (ripple-left); end-insert moves 0.
- A3: index-ask -> value at k (one jump); value-ask -> first-match index by scan;
  searched value unique; beat clears only when both asks correct.
- A4: single cheapest = end, no tie (n>=3, three distinct positions).
- A5: op-order uniqueness under append-pinning; correct order clears; wrong order
  resets the bin and grades nudge->fail; `constructReadyA` gate.
- A6: new_capacity = 2*capacity, copies = count, landing_index = count; amortized
  verdict expensive iff this append grew (seeded full -> expensive); chip = `usually
  free`, gloss in `why` only.
- Gate: flips to complete only after all 8; flame/combo breaks only on full fail;
  combo spans the 8; full happy-path -> completed.
- Resume/progress: `toProgress` squashes to the 8 keys + `attempts`; `resume`
  restores counts + part with cold combo; completion preserved; migration (old
  keys/parts -> restart at `demo`, completion preserved).
- Determinism: same seed -> identical questions/rows/verdicts; reattempt re-rolls
  deterministically.
- Keep the existing `shiftFrames` / `resizeFrames` selector tests.

Geometry unit (`arrayStripLayout.test.ts`, node): contiguous cell x's (gap 0);
ruler ticks centered; jump-arc endpoints (tick k -> cell k rim); scan visits
centers 0..k in order; capacity slot count; doubled layout width = 2x and copy map
0..C-1; extents.

Component DOM (`arrays/Stage.test.tsx`, jsdom, reduced motion forced): `ArrayStrip`
de-cued (no highlight pre-tap); ripple/arc/scan/copy only post-verdict; locked
house words rendered verbatim; A5 append via tap and keyboard parity; A6 two-step +
`CapacityFrame` doubling; SR-only fail copy.

Emulator round-trip (add to `firestoreProgressRepository.emulator.test.ts`): an
Arrays test mirroring the LL/HT ones; save `{ counters: { a1:1, a3:1, a2:0,
a2Skin:0, a4:0, a5:0, a6Grow:0, a6Cheap:0, attempts:n }, currentPart:"a2-shift",
completed:false }`, read back equal, resume on the same beat; reconcile unchanged.

E2E tracer (`e2e/tracer.spec.ts`): rewrite the `answerArrays` leg into the 11-beat
sequence and assert "You mastered Arrays." -> "Continue to Linked Lists." (section
7).

Determinism: per-mechanic same-seed checks; grep confirms no model calls.

## 7. Wiring (keep Arrays live, dependents green)

- `src/lessons/arrays.tsx`: swap imports to the new engine + new Stage; keep
  `id:"arrays"` and the `LessonModule` interface (`totalParts` becomes 11; the rest
  keep signatures). Seam untouched.
- `src/features/lesson/lessons.ts`: no change.
- `src/lessons/catalog.ts`: no change (Arrays stays playable, id "arrays", no
  `load`). `catalog.test.ts` stays green.
- `src/lessons/registry.tsx`: no change.
- `src/dev/GalleryApp.tsx`: rewrite `ARR_PRESETS` / `ARR_SEED` (the old ones
  reference `accessed` + access/shift/cost/resize); remove the temp "Arrays new"
  entry (fold its presets into the real arrays lab). `LessonLab` wiring unchanged.
- `e2e/tracer.spec.ts`: replace the `Continue + 8x answerArrays` block with:
  1. `continueOn` (demo) -> `continueOn` (teach-access)
  2. `answerArraysTap` (A1): new helper, `[data-answer="1"]`.first().click() ->
     Check -> Continue (cell, not a card; like `answerTraverse`)
  3. `answerArraysTap` x2 (A3 index, then A3 value)
  4. `continueOn` (shift-demo) -> `continueOn` (teach-shift)
  5. `answerArrays` (A2) -> `answerArrays` (A2-skin) -> `answerArrays` (A4)
  6. `rewireInOrder` (A5): reuse as-is (sources expose `data-write-order` +
     `data-rewire-correct-target="end"`)
  7. `answerArrays` x2 (A6 grow, A6 cheap)
  - then `expect("You mastered Arrays.")` and `Continue to Linked Lists`.
- `src/features/progress/firestoreProgressRepository.emulator.test.ts`: add the
  Arrays round-trip.
- Config (`package.json`, `vitest.config.ts`, `vitest.emulator.config.ts`,
  `playwright.config.ts`): no changes (new files match existing globs).

## 8. Open questions (recommended defaults)

- Q1 Real-world skin (beat 8): spreadsheet row-insert. Cheap, on-theme, mirrors
  `PlaylistQueue`. Adopt.
- Q2 Amortized analysis (A6): qualitative ("usually free; occasionally copies
  everything"); no numeric averaging; chip = `usually free`, gloss in `why`. Adopt.
- Q3 A5 op set (the one deviation to flag): ship A5 as prefix + end-appends (one
  unique order), not the spec's mixed "end-append (+ at most one middle insert)".
  Mixing appends with a middle insert admits multiple op orders that reach the same
  row (the grading ambiguity the spec names). The middle-ripples idea is already
  taught/graded in A2 and A4. If a middle insert is wanted, use a single-loose-cell
  + single-gap instance (exactly one op). Default: prefix+append for beat 10.
- Q4 Persist "backing capacity"? No. Reseed A6 on resume. Durable slice = 8
  counters + `currentPart` + `completed` + `attempts`. Deliberate deviation from the
  spec's literal test-contract wording.
- Q5 A4 "cheapest? most expensive?": ship one ask (cheapest = end) with the reveal
  contrasting all three positions. Two-ask available if wanted; default single-ask.
- Q6 Engine final home: `src/features/lesson/arraysEngine.ts` (convention).
- Q7 `ArrayRow`: supersede with `ArrayStrip`, migrate LL's single usage, then
  delete. Fallback: keep `ArrayRow` for LL.
- Q8 A6 step-1 instance: beat 11 seeded full so the doubling synthesis always plays
  and "was it cheap?" -> expensive. A has-room (cheap) instance is deferred to a
  randomized retry.

## Acceptance criteria (done = all true)

All 11 beats route and play; the 8 graded beats gate behind the until-correct wall
and completion flips only after all 8; the strip renders contiguous cells over an
address ruler with the jump-arc/scan and the (op,k)-parameterized ripple
(end-insert ripples nothing); the capacity frame doubles + copies; A5 commits via
drag, keyboard, and tap, and grades append order; reduced motion snaps every
animation; fail copy is SR-only; the locked house words render verbatim;
`arraysModule` / seam / catalog unchanged and Arrays stays lesson 2; engine +
geometry + DOM + emulator + the rewritten E2E tracer leg all pass; the gallery
walks every beat.
