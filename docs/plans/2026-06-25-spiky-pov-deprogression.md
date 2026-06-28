# Spiky-POV Deprogression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make inactivity fade a learner's shown mastery (soft deprogression) by deriving a per-lesson "retention + needs-review" view on top of the spaced-repetition chat's per-concept memory substrate, with no new persistence.

**Architecture:** A pure, dependency-injected selector module (`retention.ts`) owns the policy (weakest-link min, the rusty threshold, decayed mastery). A thin adapter bridges the substrate's per-concept `strength()` into that module. Surfacing reads the result on the Progress tab and the course path, signed-in and completed lessons only. Everything is a pure function of substrate state plus an injectable `now`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (unit), Playwright (e2e). Path alias `@/* -> src/*`.

---

## Dependency and phasing (read first)

This feature consumes a shared substrate **owned by the sibling spaced-repetition slice** (see `docs/plans/specs/2026-06-25-spiky-pov-deprogression-design.md` and the retrieval spec). The substrate provides, in a neutral module `src/features/progress/conceptReview.ts`:

```ts
// PROVIDED BY THE RETRIEVAL SLICE. Do not define here; import it.
export interface ConceptReview {
  conceptId: string
  level: number
  correctStreak: number
  lapses: number
  lastSeenAt: number
  dueAt: number
  graduated: boolean
}
// 0..1 retrievability, derived-on-read (forgetting curve; half-life from level)
export function strength(review: ConceptReview, now: number): number
// concept taxonomy; `retrievable` marks load-bearing sub-skills
export function conceptsForLesson(lessonId: string): { id: string; retrievable: boolean }[]
```

- **Phase 1 (Task 1) is buildable now** with zero substrate dependency: the core selectors are decoupled (they take already-computed strengths), so they unit-test against fixtures today.
- **Phase 2 (Tasks 2-6) is GATED** on `conceptReview.ts` and on `CourseProgressProvider` exposing the per-user `reviews` map. Each gated task says so at the top. Build Phase 1 first; start Phase 2 once the substrate is merged into `main`.

## File Structure

- `src/features/progress/retention.ts` (Create, Task 1): pure policy. `REVIEW_THRESHOLD`, `RetentionBand`, `retentionBand`, `lessonRetention` (weakest-link, decoupled), `needsReview`, `currentMastery`. No substrate import.
- `src/features/progress/retention.test.ts` (Create, Task 1): unit tests for the above.
- `src/features/progress/retentionAdapter.ts` (Create, Task 2): the only file that imports the substrate. Bridges `conceptsForLesson` + `strength(review, now)` into `lessonRetention`.
- `src/features/progress/retentionAdapter.test.ts` (Create, Task 2): unit tests with the substrate mocked.
- `src/features/progress/useRetention.ts` (Create, Task 3): a `useLessonRetention()` hook that reads `useConceptReviews()` (from the substrate's `ConceptReviewProvider`) and returns `(lessonId, now?) => number | null` via `lessonRetentionFor`.
- `src/lessons/catalog.ts` + `src/components/willow/CoursePath.tsx` + `src/components/willow/coursePath/node.tsx` (Modify, Task 4): carry an optional `needsReview` on `PathNode` and render a marker.
- `src/features/progress/progressMetrics.ts` + `src/components/willow/progress/OverallMasteryTile.tsx` consumers (Modify, Task 5): show decayed `currentMastery`.
- `e2e/` tracer (Modify, Task 6): a completed lesson reads "needs review" after simulated inactivity.

---

## Task 1: Pure retention/decay selectors (Phase 1, buildable now)

**Files:**
- Create: `src/features/progress/retention.ts`
- Test: `src/features/progress/retention.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/progress/retention.test.ts
import { describe, it, expect } from "vitest"

import {
  REVIEW_THRESHOLD,
  lessonRetention,
  needsReview,
  retentionBand,
  currentMastery,
  type ConceptStrength,
} from "./retention"

const c = (retrievable: boolean, strength: number | null): ConceptStrength => ({
  retrievable,
  strength,
})

describe("lessonRetention (weakest link / min)", () => {
  it("returns the minimum strength across load-bearing concepts", () => {
    expect(lessonRetention([c(true, 0.3), c(true, 0.62), c(true, 0.48)])).toBeCloseTo(0.3)
  })
  it("ignores non-load-bearing concepts", () => {
    expect(lessonRetention([c(false, 0.05), c(true, 0.7)])).toBeCloseTo(0.7)
  })
  it("treats a load-bearing concept with no review as freshly earned (1)", () => {
    expect(lessonRetention([c(true, null), c(true, 0.9)])).toBeCloseTo(0.9)
  })
  it("returns null when there are no load-bearing concepts", () => {
    expect(lessonRetention([c(false, 0.2)])).toBeNull()
    expect(lessonRetention([])).toBeNull()
  })
})

describe("needsReview", () => {
  it("is true strictly below the threshold", () => {
    expect(needsReview(REVIEW_THRESHOLD - 0.01)).toBe(true)
  })
  it("is false at/above the threshold and for null", () => {
    expect(needsReview(REVIEW_THRESHOLD)).toBe(false)
    expect(needsReview(0.9)).toBe(false)
    expect(needsReview(null)).toBe(false)
  })
})

describe("retentionBand", () => {
  it("maps a retention fraction to a band", () => {
    expect(retentionBand(0.95)).toBe("fresh")
    expect(retentionBand(0.6)).toBe("fading")
    expect(retentionBand(0.3)).toBe("rusty")
    expect(retentionBand(0.1)).toBe("lost")
  })
})

describe("currentMastery", () => {
  it("decays earned mastery by retention", () => {
    expect(currentMastery(1, 0.3)).toBeCloseTo(0.3)
    expect(currentMastery(0.8, 0.5)).toBeCloseTo(0.4)
  })
  it("returns earned mastery unchanged when retention is null", () => {
    expect(currentMastery(0.8, null)).toBeCloseTo(0.8)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/progress/retention.test.ts`
Expected: FAIL, "Failed to resolve import ./retention" (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/features/progress/retention.ts

/**
 * Pure deprogression policy: derive a per-lesson "retention + needs-review" view
 * from already-computed per-concept strengths. Decoupled from the spaced-repetition
 * substrate by design (it takes strengths, not reviews), so it is unit-testable on
 * its own and the substrate adapter lives in `retentionAdapter.ts`. See
 * `docs/plans/specs/2026-06-25-spiky-pov-deprogression-design.md`.
 */

/** Below this retention a completed lesson reads "needs review". Tunable. */
export const REVIEW_THRESHOLD = 0.5

export type RetentionBand = "fresh" | "fading" | "rusty" | "lost"

/** Band lower edges, highest first. Tunable; mirrors the spec's bands. */
const BAND_EDGES: { band: RetentionBand; min: number }[] = [
  { band: "fresh", min: 0.8 },
  { band: "fading", min: 0.5 },
  { band: "rusty", min: 0.2 },
  { band: "lost", min: 0 },
]

export interface ConceptStrength {
  /** Whether this sub-skill is load-bearing (enters the deck). */
  retrievable: boolean
  /** 0..1 retrievability for the current time, or null if it has no review row yet. */
  strength: number | null
}

/**
 * Weakest-link retention: the minimum strength across a lesson's load-bearing
 * concepts. `null` means the lesson has no load-bearing concepts to track. A
 * load-bearing concept with no review row falls back to 1 (treat as freshly
 * earned), so a not-started lesson reads fresh and we never flag on missing data.
 */
export function lessonRetention(concepts: ConceptStrength[]): number | null {
  const load = concepts.filter((c) => c.retrievable)
  if (load.length === 0) return null
  return Math.min(...load.map((c) => c.strength ?? 1))
}

/** True only for a real, sub-threshold retention (never for null). */
export function needsReview(retention: number | null): boolean {
  return retention !== null && retention < REVIEW_THRESHOLD
}

/** The band a retention fraction falls in. */
export function retentionBand(retention: number): RetentionBand {
  const hit = BAND_EDGES.find((b) => retention >= b.min)
  return (hit ?? BAND_EDGES[BAND_EDGES.length - 1]).band
}

/**
 * The shown mastery, decayed. `earnedMastery` (the peak record) is left untouched;
 * we multiply by retention for display so the earned record stays honest.
 */
export function currentMastery(
  earnedMastery: number,
  retention: number | null,
): number {
  return retention === null ? earnedMastery : earnedMastery * retention
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/progress/retention.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Lint the new files**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/progress/retention.ts src/features/progress/retention.test.ts
git commit -m "feat: pure per-lesson retention/decay selectors (spiky-POV)"
```

---

## Task 2: Substrate adapter (Phase 2, GATED on `conceptReview.ts`)

> GATED: requires the retrieval slice's `src/features/progress/conceptReview.ts` (the `ConceptReview` type, `strength(review, now)`, `conceptsForLesson(lessonId)`) to exist. Do not start until it is in `main`.

**Files:**
- Create: `src/features/progress/retentionAdapter.ts`
- Test: `src/features/progress/retentionAdapter.test.ts`

- [ ] **Step 1: Write the failing test (substrate mocked)**

```ts
// src/features/progress/retentionAdapter.test.ts
import { describe, it, expect, vi } from "vitest"

import type { ConceptReview } from "./conceptReview"

vi.mock("./conceptReview", () => ({
  // a lesson with two load-bearing concepts and one scaffolding concept
  conceptsForLesson: () => [
    { id: "L:a", retrievable: true },
    { id: "L:b", retrievable: true },
    { id: "L:build", retrievable: false },
  ],
  // deterministic fake: strength is encoded on the review for the test
  strength: (r: ConceptReview) => r.correctStreak / 10,
}))

import { lessonRetentionFor } from "./retentionAdapter"

const review = (conceptId: string, correctStreak: number): ConceptReview => ({
  conceptId,
  level: 0,
  correctStreak,
  lapses: 0,
  lastSeenAt: 0,
  dueAt: 0,
  graduated: false,
})

describe("lessonRetentionFor", () => {
  it("takes the weakest load-bearing concept's strength", () => {
    const reviews = new Map([
      ["L:a", review("L:a", 3)], // 0.3
      ["L:b", review("L:b", 8)], // 0.8
    ])
    expect(lessonRetentionFor("L", reviews, 0)).toBeCloseTo(0.3)
  })

  it("treats a load-bearing concept with no review as fresh", () => {
    const reviews = new Map([["L:a", review("L:a", 9)]]) // 0.9; L:b missing -> 1
    expect(lessonRetentionFor("L", reviews, 0)).toBeCloseTo(0.9)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/progress/retentionAdapter.test.ts`
Expected: FAIL, "Failed to resolve import ./retentionAdapter".

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/features/progress/retentionAdapter.ts
import { conceptsForLesson, strength, type ConceptReview } from "./conceptReview"
import { lessonRetention } from "./retention"

/**
 * Bridge the per-concept substrate into the pure weakest-link policy: look up each
 * load-bearing concept's review, compute its strength for `now`, and reduce. The
 * only file that depends on the substrate, keeping `retention.ts` decoupled.
 */
export function lessonRetentionFor(
  lessonId: string,
  reviews: ReadonlyMap<string, ConceptReview>,
  now: number,
): number | null {
  const concepts = conceptsForLesson(lessonId).map((c) => {
    const review = reviews.get(c.id)
    return { retrievable: c.retrievable, strength: review ? strength(review, now) : null }
  })
  return lessonRetention(concepts)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/progress/retentionAdapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/retentionAdapter.ts src/features/progress/retentionAdapter.test.ts
git commit -m "feat: bridge per-concept strength into per-lesson retention"
```

---

## Task 3: A retention hook over the substrate provider (Phase 2, GATED)

> GATED: requires the substrate slice's `ConceptReviewProvider` exposing `useConceptReviews(): { reviews: ReadonlyMap<ConceptId, ConceptReview>; recordReview }` (per `docs/plans/2026-06-25-concept-memory-substrate.md`). The substrate, not `CourseProgressProvider`, owns the reviews cache and the recovery hook; this task only derives retention from it.

**Files:**
- Create: `src/features/progress/useRetention.ts`

- [ ] **Step 1: Implement the hook**

```tsx
import { useCallback } from "react"

import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { lessonRetentionFor } from "@/features/progress/retentionAdapter"

/** Returns a weakest-link retention reader for any lesson, 0..1 or null. */
export function useLessonRetention(): (lessonId: string, now?: number) => number | null {
  const { reviews } = useConceptReviews()
  return useCallback(
    (lessonId: string, now: number = Date.now()) =>
      lessonRetentionFor(lessonId, reviews, now),
    [reviews],
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/progress/useRetention.ts
git commit -m "feat: useLessonRetention hook over the concept-review substrate"
```

---

## Task 4: "Needs review" marker on the course path (Phase 2, GATED)

> GATED: requires Task 3.

**Files:**
- Modify: `src/components/willow/CoursePath.tsx` (the `PathNode` type)
- Modify: `src/lessons/catalog.ts` (`derivePathNodes`)
- Modify: `src/components/willow/coursePath/node.tsx` (render the marker)
- Test: `src/lessons/catalog.test.ts`

- [ ] **Step 1: Extend the `PathNode` type**

In `src/components/willow/CoursePath.tsx`, add an optional field to `PathNode`:

```ts
/** Set on a completed lesson whose retention has dropped into the rusty band. */
needsReview?: boolean
```

- [ ] **Step 2: Write the failing test for derive enrichment**

Add to `src/lessons/catalog.test.ts`:

```ts
import { derivePathNodes } from "@/lessons/catalog"

it("marks a completed lesson as needsReview when retention is below threshold", () => {
  const progress = { "stacks-and-queues": { counters: {}, currentPart: "scenario", completed: true } }
  const retentionOf = (id: string) => (id === "stacks-and-queues" ? 0.3 : null)
  const nodes = derivePathNodes(progress, retentionOf)
  expect(nodes.find((n) => n.id === "stacks-and-queues")?.needsReview).toBe(true)
})

it("does not mark incomplete or fresh lessons", () => {
  const progress = { "stacks-and-queues": { counters: {}, currentPart: "scenario", completed: true } }
  const retentionOf = () => 0.9
  const nodes = derivePathNodes(progress, retentionOf)
  expect(nodes.find((n) => n.id === "stacks-and-queues")?.needsReview).toBe(false)
})
```

- [ ] **Step 2b: Run it to verify it fails**

Run: `npx vitest run src/lessons/catalog.test.ts`
Expected: FAIL (`derivePathNodes` takes one argument; `needsReview` undefined).

- [ ] **Step 3: Implement the enrichment**

In `src/lessons/catalog.ts`, change `derivePathNodes` to accept an optional retention lookup and set `needsReview` on completed nodes:

```ts
import { needsReview as isRusty } from "@/features/progress/retention"

export function derivePathNodes(
  progress: ProgressByLesson,
  retentionOf: (lessonId: string) => number | null = () => null,
): PathNode[] {
  let currentAssigned = false
  return DATA_STRUCTURES_LESSONS.map(({ id, name }) => {
    const completed = progress[id]?.completed ?? false
    const open = isLessonPlayable(id) && isLessonUnlocked(id, progress)
    let state: PathNodeState
    if (completed) {
      state = "completed"
    } else if (open && !currentAssigned) {
      state = "current"
      currentAssigned = true
    } else if (open) {
      state = "available"
    } else {
      state = "locked"
    }
    const needsReview = completed && isRusty(retentionOf(id))
    return { id, name, state, needsReview }
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lessons/catalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the marker**

In `src/components/willow/coursePath/node.tsx`, inside `PathNodeButton`'s outer `div`, add a small dot when `node.needsReview` (after the `<button>`):

```tsx
{node.needsReview && (
  <span
    aria-label="Needs review"
    className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-amber-500"
  />
)}
```

- [ ] **Step 6: Pass retention into the path where it is rendered**

Wherever `derivePathNodes(progressByLesson)` is called for the course path (the Course detail screen), pass the hook reader: `const lessonRetention = useLessonRetention()` then `derivePathNodes(progressByLesson, (id) => lessonRetention(id))`.

- [ ] **Step 7: Run the focused tests + lint**

Run: `npx vitest run src/lessons/catalog.test.ts src/components/willow/coursePath/coursePath.test.tsx`
Expected: PASS. Run: `npm run lint` (no new errors).

- [ ] **Step 8: Commit**

```bash
git add src/components/willow/CoursePath.tsx src/lessons/catalog.ts src/components/willow/coursePath/node.tsx src/lessons/catalog.test.ts
git commit -m "feat: show a needs-review marker on rusty completed lessons"
```

---

## Task 5: Decayed mastery on the Progress tab (Phase 2, GATED)

> GATED: requires Task 3. Threads retention into the Progress metrics so the shown mastery decays.

**Files:**
- Modify: `src/features/progress/progressMetrics.ts`
- Test: `src/features/progress/progressMetrics.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/progress/progressMetrics.test.ts` a case where a completed lesson with low retention lowers overall mastery vs. the same input with full retention (call `computeProgressMetrics` with a `retentionByLesson` map and assert `overallMastery` drops). Mirror the file's existing fixture style.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/progress/progressMetrics.test.ts`
Expected: FAIL (no `retentionByLesson` parameter / `overallMastery` not decayed).

- [ ] **Step 3: Implement**

In `computeProgressMetrics`, accept an optional `retentionByLesson: Record<string, number | null>` and compute each completed lesson's `currentMastery(earned, retentionByLesson[id] ?? null)` (using `earnedMastery` from `lessonStats`), then aggregate for the overall mastery view-model. Keep the existing `lessonsMastered` count on the honest `completed` flag (a rusty lesson is still completed, just faded).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/progress/progressMetrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `useProgressMetrics`**

In `src/features/progress/progressMetrics.ts`, have the `useProgressMetrics` hook call `useLessonRetention()` and build `retentionByLesson` for the data-structures lessons, passing it into `computeProgressMetrics`.

- [ ] **Step 6: Commit**

```bash
git add src/features/progress/progressMetrics.ts src/features/progress/progressMetrics.test.ts
git commit -m "feat: decay shown mastery by retention on the Progress tab"
```

---

## Task 6: E2E tracer (Phase 2, GATED)

> GATED: requires Tasks 3-5 and the substrate seeding reviews on completion.

**Files:**
- Modify: an existing spec under `e2e/` (follow the existing tracer pattern)

- [ ] **Step 1: Add a tracer**

Complete a lesson, then drive the app with a `now` advanced by N days (inject via the same seam the engine uses for time, or a test clock). Assert the course node shows the "Needs review" marker and the Progress tab mastery has dropped. Then re-practice and assert the marker clears.

- [ ] **Step 2: Run it**

Run: `npm run e2e`
Expected: the new tracer passes (emulator-backed).

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test: e2e tracer for deprogression needs-review + recovery"
```

---

## Self-Review

**1. Spec coverage:**
- Soft deprogression (shown mastery fades, never relock): Task 5 (`currentMastery`) + Task 4 keeps `completed`/unlock untouched. Covered.
- Per-lesson derived from per-concept: Tasks 1-2. Covered.
- Spaced-reinforcement strength: consumed via the substrate `strength()` in Task 2. Covered.
- Weakest link (min): Task 1 `lessonRetention`. Covered.
- No new persistence: no task touches `ProgressRepository`/`LessonProgress` shape. Covered.
- Surfacing on Progress tab + lesson home only, completed + signed-in only: Tasks 4-5; signed-in falls out of the provider only having `reviews` for a signed-in user. Covered.
- Recovery: re-practice updates the substrate review (substrate-owned); our re-derive shows it. The "normal-answer calls applyReview" hook is the substrate's responsibility, flagged in the spec; no task here owns it. Covered (as a dependency, not our code).
- Determinism / injectable `now`: every selector takes strengths or `now`. Covered.

**2. Placeholder scan:** Tasks 5 and 6 describe test intent in prose rather than full code, because they depend on the substrate's final shape and the existing metrics/e2e fixtures; they are explicitly GATED and to be fleshed out when unblocked. Tasks 1-4 contain complete code.

**3. Type consistency:** `ConceptStrength`, `lessonRetention`, `needsReview`, `retentionBand`, `currentMastery`, `lessonRetentionFor`, and `PathNode.needsReview` are used consistently across tasks. The substrate names (`ConceptReview`, `strength`, `conceptsForLesson`) match the spec's contract block.

---

## Execution Handoff

Phase 1 (Task 1) is ready to execute now. Phase 2 (Tasks 2-6) unblocks once the retrieval slice's `conceptReview.ts` substrate is merged.
