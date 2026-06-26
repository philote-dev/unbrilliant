# Spaced-repetition retrieval (Type 1) design

- Date: 2026-06-25
- Branch: `feat/spaced-repetition-retrieval`
- Status: proposed (defaults locked after user approval; cross-chat contracts aligned with the deprogression/spiky-POV and mastery-question chats)

## Goal

Add deterministic, no-AI spaced-repetition retrieval to Willow. When a returning,
signed-in learner enters their next lesson, occasionally surface a short (1-3
question) reworded drill on a load-bearing sub-skill from an already-completed
lesson, then continue into the lesson they chose. Drills build long-term memory
(Cepeda 2008 spacing; Bjork desirable difficulties) and maintain a shared
per-concept memory model that the deprogression and mastery-question systems also
read. Retrieval never gates the course path.

## Scope and boundaries

- **Mine, end-to-end (Type 1 pure retrieval):** the scheduler (due-selection,
  cooldowns, gap windows), session assembly from the existing per-lesson seeded
  generators, the pre-lesson drill experience, and the per-concept scheduling
  fields. Plus the "is a Type 2 checkpoint due?" decision (catalog-driven).
- **Co-designed (shared contracts, below):** the concept taxonomy, the
  item-provider registry, and the per-concept review substrate + its persistence.
- **Not mine:** Type 2 checkpoint content and grading (the mastery-question
  chat's scenario pool and gate threshold); the mastery-tree visuals (they read
  the shared `strength()` signal). I only decide when a checkpoint appears.
- **Cut for now:** anonymous (signed-out) scheduling; gestural/visual retrieval
  items (rewire, draw-edge, tree taps) so the drill needs only one tap-renderer;
  within-drill interleaving (dialable later); any change to lesson engine rules.

## Decisions (locked)

1. **Signed-in only.** Durable schedule via Firestore behind the persistence
   seam. Anonymous learners never see drills; their rows are seeded from
   carried-up progress on sign-in.
2. **Mandatory attempt, non-blocking.** The learner answers the 1-3 items (no
   skip) and sees the correction either way, then always proceeds to the lesson.
   A Type 1 drill never blocks the course path.
3. **Expanding-interval ladder + derived strength.** A Leitner-style ladder drives
   scheduling; `strength()` is a derived-on-read retrievability curve (the single
   shared memory-over-time signal). No stored/mutated strength field.
4. **Due-based trigger, no RNG.** At lesson entry, if at least one concept is due,
   show one drill; otherwise nothing. The ladder is the throttle.
5. **Single-topic drills, interleaved across sessions.** Each drill is the single
   most-overdue concept (default one reworded question). Interleaving emerges
   across entries because the most-overdue concept rotates.
6. **Neutral shared substrate** under `src/features/progress/` so deprogression and
   mastery read it without importing `retrieval/`.
7. **Recovery-hook owner: `LessonRunProvider`.** Normal in-lesson correct answers
   refresh/promote a concept through the one write path, so re-practicing a rusty
   lesson restores it.

## Shared contracts (with the deprogression + mastery chats)

### Contract 1: concept taxonomy (neutral) - `src/features/progress/concepts.ts`

A stable id per retrievable sub-skill, `"${lessonId}:${subSkill}"`.

```ts
export type ConceptId = string // e.g. "stacks-and-queues:pop", "arrays:shift-count"

export interface Concept {
  id: ConceptId
  lessonId: string
  courseId: string
  label: string          // for tiles/debug; never shown as a recall prompt
  retrievable: boolean   // only load-bearing sub-skills enter the SR deck
}

export function conceptsForLesson(lessonId: string): Concept[]

// counterKey -> conceptId per lesson; the recovery hook maps a correct-counter
// delta to the concept it advanced. Keyed off each engine's existing counters.
export const COUNTER_CONCEPT: Record<string /*lessonId*/, Record<string /*counterKey*/, ConceptId>>
```

- `retrievable` honors "not everything has the same importance" (notes.md): only
  load-bearing sub-skills (e.g. `pop`, `dequeue`, the stack-vs-queue `classify`)
  enter the deck; build/scaffolding steps do not.
- Catalog-driven so Algorithms/Probability extend it without engine edits.

### Contract 2: item-provider registry (retrieval-only) - `src/features/retrieval/itemProvider.ts`

Wraps each lesson's existing seeded generator + grader so retrieval renders/grades
any concept without importing seven engines at call sites.

```ts
export interface RetrievalItem {
  conceptId: ConceptId
  prompt: string                          // reworded per encounter
  options: { id: string; label: string }[]
  answerId: string
  why: string                             // teaches the principle, not just right/wrong
}

// pure: same (conceptId, seed, encounter) always yields the same item
export type ItemProvider = (seed: number, encounter: number) => RetrievalItem
export const ITEM_PROVIDERS: Record<ConceptId, ItemProvider>
```

- `encounter` drives varied surface/phrasing (Bjork). Seed derived from
  `(conceptId, encounter, userSeed)` for stable replay, where `userSeed` is a stable
  per-user value hashed from the uid. We wire only tap-gradeable concepts for now;
  gestural concepts are deferred.

### Contract 3: per-concept review substrate (neutral) - `src/features/progress/conceptReview.ts`

The single source of truth for memory-over-time. Deprogression aggregates a
lesson's concept strengths; it adds nothing to `LessonProgress`.

```ts
export interface ConceptReview {
  conceptId: ConceptId
  level: number          // ladder position (scheduling)
  correctStreak: number  // consecutive spaced-correct reps (mastery)
  lapses: number         // wrong reveals, all-time
  seen: number           // total encounters (drives reword encounter index)
  lastSeenAt: number     // epoch ms
  dueAt: number          // = lastSeenAt + gap(level)
  graduated: boolean      // reached top of ladder
}

export const DAY = 86_400_000
export const GAP_LADDER_MS = [DAY, 3 * DAY, 7 * DAY, 21 * DAY] // levels 0..3
export const MAX_LEVEL = GAP_LADDER_MS.length                  // graduate at 4 spaced reps
export const MIN_GAP_MS = 20 * 60 * 60 * 1000                  // 20h floor: never same/next-session

export function newReview(conceptId: ConceptId, at: number): ConceptReview

// strength is DERIVED, never stored: a forgetting curve whose half-life is the
// current ladder gap. One shared 0..1 signal for the mastery tree + deprogression.
export function strength(r: ConceptReview, now: number): number // 2^(-elapsed / gap(level))

// The ONE write path. Drills, normal lesson play, and Type 2 checkpoints all call it.
export function applyReview(r: ConceptReview, ev: { correct: boolean; at: number }): ConceptReview
```

`applyReview` rules:

- **Correct + spaced** (`elapsed >= gap(level)`): promote a level, `correctStreak++`,
  `seen++`, `dueAt = at + gap(newLevel)`, `graduated = newLevel >= MAX_LEVEL`.
- **Correct + massed** (`elapsed < gap(level)`): hold level (no inflation), `seen++`,
  refresh `lastSeenAt`, `dueAt = at + gap(level)`.
- **Wrong:** demote one level (min 0), `correctStreak = 0`, `lapses++`, `seen++`,
  `dueAt = at + MIN_GAP_MS` (re-test soon, never same session).

`gap(level)` clamps to the top rung (21d) once `level` reaches `MAX_LEVEL`, so a
graduated row keeps a well-defined gap and half-life.

Out of this substrate by design (they belong to deprogression, read-side): bands,
thresholds, "needs review", and never-relock rules.

### Neutral cache + single write path - `src/features/progress/ConceptReviewProvider.tsx`

Sits below `AuthProvider`, above `LessonRunProvider` (next to `CourseProgressProvider`).

```ts
interface ConceptReviewValue {
  reviews: ConceptReview[]
  recordReview(conceptId: ConceptId, correct: boolean): void // applyReview + optimistic persist + cache update
}
```

- Loads `getConceptReviews(uid)` once per signed-in user; seeds level-0 rows for
  already-completed lessons that lack rows.
- `recordReview` is the only mutator; retrieval's scheduler and deprogression read
  `reviews` (and `strength()`); neither imports the other.

## Scheduler policy (the "when") - `src/features/retrieval/selectDrill.ts`

```ts
export interface DueDrill { conceptId: ConceptId; items: RetrievalItem[] }
export function selectDueDrill(
  reviews: ConceptReview[],
  ctx: { completedLessonIds: Set<string>; now: number; userSeed: number },
): DueDrill | null
```

- **Deck / eligibility:** `retrievable` concepts whose lesson is completed and whose
  row is due (`dueAt <= now`). Rows seed lazily at level 0 (due ~tomorrow) on lesson
  completion, so a just-finished lesson never surfaces the same session.
- **Cooldown (the small-deck core problem):** the gap ladder *is* the cooldown;
  nothing resurfaces before `dueAt`, with a hard `MIN_GAP_MS` floor on lapses.
  This is the "never right after exit/re-entry" guarantee.
- **Selection:** the single most-overdue concept (`max(now - dueAt)`); ties broken
  by lowest `strength(now)`, then oldest `lastSeenAt`.
- **Assembly:** one concept x N reworded items (default `N = 1`, max 3) using
  `encounter = seen`. Interleaving lives across sessions (the most-overdue concept
  rotates), not within a drill.
- **Frequency:** at most one drill per lesson-entry and one per app session.
- **Graduation:** a graduated concept's `dueAt` is far out, so it naturally stops
  surfacing; `strength()` stays readable for the tree/deprogression.

## The drill (Type 1) - `src/features/retrieval/`

A small dedicated reducer (`retrievalSession.ts`) + a shared tap-question view,
reusing `gradeAnswer`, `FeedbackFooter`, and the on-fire combo so feedback and
flame are identical to a lesson (no full `LessonModule` needed for tap items).

Flow: interstitial ("Quick warm-up: a question from Stacks & Queues") -> item (tap
an option -> check -> correct/nudge/fail + why) -> after the items -> "Continue to
<next lesson>". Mandatory attempt, non-blocking. Each answer calls `recordReview`.

## Integration point - `src/lessons/LessonHost.tsx`

`LessonHost` (which already routes a lessonId to `LessonPlayer`) first calls
`selectDueDrill(reviews, { completedLessonIds, now, userSeed })`. If a drill is due
it renders the retrieval drill with `onDone -> render the lesson`; otherwise it
renders `LessonPlayer` directly. `ConceptReviewProvider` supplies
`reviews`/`recordReview` by context. Which lessons may trigger entry-drills, and
where Type 2 checkpoints sit, are catalog flags (never hardcoded), so it scales to
future courses.

## Recovery hook - `src/features/lesson/useLessonRun.tsx`

A sibling of the existing activity-recording effect (already keyed on the progress
signature, already diffs `answerTallies(counters)`): on a positive delta in a
lesson's correct-counter, map `counterKey -> conceptId` via `COUNTER_CONCEPT` and
call `recordReview(conceptId, true)`. No `LessonModule`/engine change is needed.

- Engines bump correct-counters only on correct answers, so in-lesson **wrong**
  answers are invisible here and never demote (only the scheduled drill calls
  `recordReview(_, false)`). Re-practicing a rusty lesson can only restore it.
- `applyReview`'s spaced-vs-massed rule stops same-session grinding from inflating
  the ladder.

## Type 2 checkpoint hook (my part only)

```ts
export function checkpointDue(
  courseId: string,
  progress: ProgressByLesson,
  reviews: ConceptReview[],
  now: number,
): CheckpointId | null
```

Driven by catalog-declared checkpoint nodes (e.g. a mid-course check after the
linear structures, an end-of-course capstone) and a readiness rule (prior lessons
completed and/or their concepts at sufficient `strength`). The mastery-question
chat owns the checkpoint content, grading, and gate threshold.

## Persistence and carry-up - `src/features/progress/`

`ProgressRepository` gains:

```ts
getConceptReviews(uid: string): Promise<ConceptReview[]>
saveConceptReview(uid: string, review: ConceptReview): Promise<void> // optimistic, fire-and-forget
```

- **Firestore impl:** subcollection `users/{uid}/conceptReviews/{conceptId}`,
  written with merge; mirrors the existing `activity` subcollection pattern.
- **In-memory fake:** same semantics for tests.
- **Carry-up:** scheduling is signed-in only, so there is no anonymous review state
  to merge. At sign-in, reconcile seeds level-0 rows for already-completed lessons
  lacking rows; the recovery hook and drills maintain them thereafter.
- **Security rules:** a learner may read/write only their own
  `users/{uid}/conceptReviews/**`. Audit before shipping.

## Determinism and test contract (the three seams)

- **Engine unit (Vitest):** `applyReview` transitions (promote-on-spaced,
  hold-on-massed, demote-on-wrong, graduate at `MAX_LEVEL`); `strength()` curve;
  `selectDueDrill` ordering, eligibility, cooldown, and `MIN_GAP`; item-provider
  purity (same `seed+encounter` -> same item; reword varies by `encounter`).
- **Repository integration (emulator):** `getConceptReviews`/`saveConceptReview`
  round-trip and sign-in seeding; mirrors `firestoreProgressRepository.emulator.test.ts`.
- **One E2E tracer (Playwright):** complete Stacks & Queues, advance the clock so a
  concept is due, enter Arrays, see the warm-up, answer, proceed; assert the drill
  does not reappear the same session.
- **No-AI gate:** every wired concept's provider is pure and tap-gradeable.

## Out of scope (YAGNI)

- Anonymous/localStorage scheduling.
- Gestural/visual retrieval items (rewire, draw-edge, tree taps).
- Within-drill interleaving (single-topic for now; dialable later).
- Type 2 checkpoint content + grading (mastery-question chat).
- The mastery-tree visualization (consumes `strength()` only).
- Multi-course wiring (catalog-ready; only Data Structures wired now).
- Backfilling schedule history for existing users.

## Risks

- **Small-deck cooldowns:** too-short gaps hurt (Cepeda); `MIN_GAP` + the ladder
  guard this. Tune once observed.
- **Surface pattern-matching:** repeated real-world skins teach "warehouse =
  stack" instead of the principle; rewording per `encounter` + varied distractors
  mitigate.
- **Clock/timezone:** all scheduling is epoch-ms; `Date.now()` is injected at the
  provider so the engine stays pure and tests inject a clock.
- **Double-counting under StrictMode:** the recovery hook derives deltas from the
  monotonic correct-counters (same approach as activity recording), not effect fires.
- **Write contention on the shared row:** all writes funnel through
  `recordReview` -> `applyReview`.
- **Provider order:** `ConceptReviewProvider` must sit below `AuthProvider` and
  above `LessonRunProvider`.

## Defaults to revisit (dials)

1. **Drill composition:** single-topic, `N = 1` item per drill. Alternative:
   within-drill interleaving (1 item each from up to 3 due concepts).
2. **Ladder:** `1d -> 3d -> 7d -> 21d`, graduate at ~4 spaced reps, `MIN_GAP` ~20h.
