# Concept-memory substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the neutral, shared per-concept memory model (the durable `ConceptReview` substrate, its persistence, a provider with the single write path, and the in-lesson recovery hook) that the spaced-repetition retrieval drill and the spiky-POV deprogression feature both build on.

**Architecture:** A pure substrate (`conceptReview.ts`) and taxonomy (`concepts.ts`) under `src/features/progress/`, persisted through the existing `ProgressRepository` seam (Firestore + in-memory adapters), surfaced by a `ConceptReviewProvider` whose `recordReview` is the only mutator. Normal in-lesson correct answers feed it through a recovery effect in the existing `LessonRunProvider`.

**Tech Stack:** React 19 + TypeScript, Vitest (unit), Firebase emulator (integration). No new dependencies.

This is **Plan 1 of 2** for spaced-repetition retrieval (spec: `docs/plans/specs/2026-06-25-spaced-repetition-retrieval-design.md`). It is the shared dependency the deprogression and mastery-question chats are blocked on; it ships and tests on its own. Plan 2 (the retrieval drill + scheduler + lesson-entry integration) builds on this.

---

## Cross-feature contract (do not drift)

The deprogression chat (`docs/plans/specs/2026-06-25-spiky-pov-deprogression-design.md`) imports, never redefines:

- `ConceptReview` and `strength(review, now)` from `@/features/progress/conceptReview`.
- `conceptsForLesson(lessonId)` from `@/features/progress/concepts`.
- The per-user reviews as a `ReadonlyMap<ConceptId, ConceptReview>` (exposed by `useConceptReviews()`).

It adds nothing to `LessonProgress` and persists nothing new. Keep `strength` derived-on-read (no stored field). Keep bands/thresholds/"needs review" OUT of this substrate (those are deprogression's, read-side).

## File structure

- Create `src/features/progress/conceptReview.ts` - pure substrate: `ConceptReview`, ladder constants, `newReview`, `strength`, `applyReview`.
- Create `src/features/progress/concepts.ts` - taxonomy derived from each engine's durable counters: `Concept`, `ConceptId`, `conceptsForLesson`, `conceptId`, `risenConcepts`.
- Modify `src/features/progress/ProgressRepository.ts` - add `getConceptReviews` / `saveConceptReview`.
- Modify `src/features/progress/inMemoryProgressRepository.ts` - implement them.
- Modify `src/features/progress/firestoreProgressRepository.ts` - implement them.
- Modify `firestore.rules` - allow a learner read/write of their own `conceptReviews`.
- Create `src/features/progress/ConceptReviewProvider.tsx` - cache + `recordReview` (single write path) + `useConceptReviews`.
- Modify `src/main.tsx` - mount the provider below `AuthProvider`, above `LessonRunProvider`.
- Modify `src/features/lesson/useLessonRun.tsx` - recovery effect: correct-counter delta -> `recordReview(conceptId, true)`.

---

## Task 1: Pure substrate (`conceptReview.ts`)

**Files:**
- Create: `src/features/progress/conceptReview.ts`
- Test: `src/features/progress/conceptReview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  applyReview,
  GAP_LADDER_MS,
  MAX_LEVEL,
  MIN_GAP_MS,
  newReview,
  strength,
  type ConceptReview,
} from "@/features/progress/conceptReview"

const DAY = 86_400_000

describe("conceptReview substrate", () => {
  it("newReview starts at level 0, due one gap out, nothing seen", () => {
    const r = newReview("stacks-and-queues:classify", 1_000)
    expect(r.level).toBe(0)
    expect(r.correctStreak).toBe(0)
    expect(r.seen).toBe(0)
    expect(r.dueAt).toBe(1_000 + GAP_LADDER_MS[0])
    expect(r.graduated).toBe(false)
  })

  it("a spaced correct rep promotes a level and lengthens the gap", () => {
    const r0 = newReview("c", 0)
    const at = GAP_LADDER_MS[0] + 5 // past the level-0 gap => spaced
    const r1 = applyReview(r0, { correct: true, at })
    expect(r1.level).toBe(1)
    expect(r1.correctStreak).toBe(1)
    expect(r1.seen).toBe(1)
    expect(r1.dueAt).toBe(at + GAP_LADDER_MS[1])
  })

  it("a massed correct rep holds the level (no ladder inflation)", () => {
    const r0 = newReview("c", 0)
    const r1 = applyReview(r0, { correct: true, at: 5 }) // within the gap
    expect(r1.level).toBe(0)
    expect(r1.correctStreak).toBe(0)
    expect(r1.seen).toBe(1)
    expect(r1.dueAt).toBe(5 + GAP_LADDER_MS[0])
  })

  it("a wrong rep demotes, resets the streak, and re-tests after MIN_GAP", () => {
    const r0 = applyReview(newReview("c", 0), { correct: true, at: GAP_LADDER_MS[0] + 1 })
    const at = r0.lastSeenAt + GAP_LADDER_MS[1] + 1
    const r1 = applyReview(r0, { correct: false, at })
    expect(r1.level).toBe(0)
    expect(r1.correctStreak).toBe(0)
    expect(r1.lapses).toBe(1)
    expect(r1.dueAt).toBe(at + MIN_GAP_MS)
  })

  it("graduates after MAX_LEVEL spaced correct reps and clamps the gap", () => {
    let r = newReview("c", 0)
    let at = 0
    for (let i = 0; i < MAX_LEVEL; i++) {
      at += GAP_LADDER_MS[Math.min(r.level, GAP_LADDER_MS.length - 1)] + 1
      r = applyReview(r, { correct: true, at })
    }
    expect(r.level).toBe(MAX_LEVEL)
    expect(r.graduated).toBe(true)
    const topGap = GAP_LADDER_MS[GAP_LADDER_MS.length - 1]
    expect(r.dueAt).toBe(at + topGap)
  })

  it("strength is 1 at lastSeenAt and 0.5 after one half-life (the level gap)", () => {
    const r: ConceptReview = { ...newReview("c", 0), level: 1, lastSeenAt: 0 }
    expect(strength(r, 0)).toBeCloseTo(1, 5)
    expect(strength(r, GAP_LADDER_MS[1])).toBeCloseTo(0.5, 5)
  })

  it("uses the day-scaled default ladder", () => {
    expect(GAP_LADDER_MS).toEqual([DAY, 3 * DAY, 7 * DAY, 21 * DAY])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/progress/conceptReview.test.ts`
Expected: FAIL with "Cannot find module '@/features/progress/conceptReview'".

- [ ] **Step 3: Write minimal implementation**

```ts
export type ConceptId = string // "${lessonId}:${subSkill}"

/**
 * The neutral, shared per-concept memory substrate. Retrieval (scheduling) and
 * deprogression (decay) both build on this. `strength` is derived-on-read (a
 * forgetting curve whose half-life is the current ladder gap); nothing here
 * knows about bands, thresholds, drills, or "needs review".
 */
export interface ConceptReview {
  conceptId: ConceptId
  level: number // ladder position (scheduling)
  correctStreak: number // consecutive spaced-correct reps
  lapses: number // wrong reveals, all-time
  seen: number // total encounters (drives the reword encounter index)
  lastSeenAt: number // epoch ms
  dueAt: number // lastSeenAt + gap(level)
  graduated: boolean
}

const DAY = 86_400_000
export const GAP_LADDER_MS = [DAY, 3 * DAY, 7 * DAY, 21 * DAY] // levels 0..3
export const MAX_LEVEL = GAP_LADDER_MS.length // graduate after 4 spaced reps
export const MIN_GAP_MS = 20 * 60 * 60 * 1000 // 20h floor: never same/next-session

function gapForLevel(level: number): number {
  return GAP_LADDER_MS[Math.min(Math.max(level, 0), GAP_LADDER_MS.length - 1)]
}

export function newReview(conceptId: ConceptId, at: number): ConceptReview {
  return {
    conceptId,
    level: 0,
    correctStreak: 0,
    lapses: 0,
    seen: 0,
    lastSeenAt: at,
    dueAt: at + GAP_LADDER_MS[0],
    graduated: false,
  }
}

/** 0..1 retrievability under a forgetting curve with half-life = gap(level). */
export function strength(r: ConceptReview, now: number): number {
  const elapsed = Math.max(0, now - r.lastSeenAt)
  return Math.pow(2, -elapsed / gapForLevel(r.level))
}

/**
 * The ONE write path. A spaced correct rep promotes (lengthens the gap); a
 * massed correct rep holds (no inflation); a wrong rep demotes and re-tests
 * after MIN_GAP. `at` is injected so the substrate stays clock-free and pure.
 */
export function applyReview(
  r: ConceptReview,
  ev: { correct: boolean; at: number },
): ConceptReview {
  const seen = r.seen + 1
  if (ev.correct) {
    const spaced = ev.at - r.lastSeenAt >= gapForLevel(r.level)
    const level = spaced ? Math.min(r.level + 1, MAX_LEVEL) : r.level
    return {
      ...r,
      level,
      correctStreak: spaced ? r.correctStreak + 1 : r.correctStreak,
      seen,
      lastSeenAt: ev.at,
      dueAt: ev.at + gapForLevel(level),
      graduated: level >= MAX_LEVEL,
    }
  }
  const level = Math.max(0, r.level - 1)
  return {
    ...r,
    level,
    correctStreak: 0,
    lapses: r.lapses + 1,
    seen,
    lastSeenAt: ev.at,
    dueAt: ev.at + MIN_GAP_MS,
    graduated: false,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/progress/conceptReview.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/conceptReview.ts src/features/progress/conceptReview.test.ts
git commit -m "feat: pure per-concept memory substrate (ladder + derived strength)"
```

---

## Task 2: Concept taxonomy (`concepts.ts`)

The taxonomy mirrors each engine's durable `toProgress().counters` keys (minus `attempts`), so a sub-skill, its durable counter, and its concept id are the same name. `conceptId = "${lessonId}:${subSkill}"`.

**Files:**
- Create: `src/features/progress/concepts.ts`
- Test: `src/features/progress/concepts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  conceptId,
  conceptsForLesson,
  risenConcepts,
} from "@/features/progress/concepts"

describe("concept taxonomy", () => {
  it("derives the 8 stacks-and-queues sub-skills", () => {
    const ids = conceptsForLesson("stacks-and-queues").map((c) => c.id)
    expect(ids).toContain("stacks-and-queues:stackPredict")
    expect(ids).toContain("stacks-and-queues:classify")
    expect(ids).toContain("stacks-and-queues:contrast")
    expect(ids).toHaveLength(8)
  })

  it("marks predict/classify/contrast load-bearing and construction scaffolding", () => {
    const byId = new Map(
      conceptsForLesson("stacks-and-queues").map((c) => [c.id, c]),
    )
    expect(byId.get("stacks-and-queues:stackPredict")?.retrievable).toBe(true)
    expect(byId.get("stacks-and-queues:stackConstruct")?.retrievable).toBe(false)
  })

  it("returns [] for an unknown lesson (safe for not-yet-mapped lessons)", () => {
    expect(conceptsForLesson("nope")).toEqual([])
  })

  it("conceptId composes lesson + sub-skill", () => {
    expect(conceptId("arrays", "a1")).toBe("arrays:a1")
  })

  it("risenConcepts reports only counters that increased, never attempts", () => {
    const prev = { stackPredict: 0, classify: 1, attempts: 4 }
    const next = { stackPredict: 1, classify: 1, attempts: 7 }
    expect(risenConcepts("stacks-and-queues", prev, next)).toEqual([
      "stacks-and-queues:stackPredict",
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/progress/concepts.test.ts`
Expected: FAIL with "Cannot find module '@/features/progress/concepts'".

- [ ] **Step 3: Write minimal implementation**

```ts
import type { ConceptId } from "@/features/progress/conceptReview"

export type { ConceptId }

export interface Concept {
  id: ConceptId
  lessonId: string
  courseId: string
  label: string // the sub-skill key; for tiles/debug, never a recall prompt
  retrievable: boolean // load-bearing sub-skills enter the SR deck
}

/**
 * Each lesson's durable correct-count sub-skills, mirroring the engine's
 * `toProgress().counters` keys (minus `attempts`). Keep in sync with the engine
 * when its counters change.
 */
const LESSON_SUBSKILLS: Record<string, string[]> = {
  "stacks-and-queues": [
    "stackPredict",
    "stackRealworld",
    "stackConstruct",
    "queuePredict",
    "queueRealworld",
    "queueConstruct",
    "classify",
    "contrast",
  ],
  arrays: ["a1", "a3", "a2", "a2Skin", "a4", "a5", "a6Grow", "a6Cheap"],
  "linked-lists": [
    "traverse",
    "insert",
    "delete",
    "predict",
    "playlist",
    "contrastInsert",
    "contrastReach",
  ],
  "hash-tables": ["hash", "collision", "lookup"],
  trees: ["locate", "sequence", "comparison"],
  heaps: ["siftUp", "siftDown", "mapping", "contrast"],
  graphs: ["read", "draw", "same"],
}

/**
 * Sub-skills that are construction/scaffolding rather than load-bearing
 * assessment, so they stay OUT of the SR deck and out of decay aggregation.
 * Only stacks-and-queues is curated here (its skills are understood); other
 * lessons currently treat every sub-skill as retrievable. Narrowing the rest is
 * a fast follow-up alongside Plan 2's per-concept item providers.
 */
const NON_RETRIEVABLE: Record<string, ReadonlySet<string>> = {
  "stacks-and-queues": new Set([
    "stackRealworld",
    "stackConstruct",
    "queueRealworld",
    "queueConstruct",
  ]),
}

const COURSE_ID = "data-structures"

export function conceptId(lessonId: string, subSkill: string): ConceptId {
  return `${lessonId}:${subSkill}`
}

export function conceptsForLesson(lessonId: string): Concept[] {
  const skills = LESSON_SUBSKILLS[lessonId] ?? []
  const nonRet = NON_RETRIEVABLE[lessonId] ?? new Set<string>()
  return skills.map((s) => ({
    id: conceptId(lessonId, s),
    lessonId,
    courseId: COURSE_ID,
    label: s,
    retrievable: !nonRet.has(s),
  }))
}

/**
 * Concept ids whose durable correct-count rose between two counter snapshots
 * (excludes `attempts`). Pure; drives the in-lesson recovery hook.
 */
export function risenConcepts(
  lessonId: string,
  prev: Record<string, number>,
  next: Record<string, number>,
): ConceptId[] {
  const out: ConceptId[] = []
  for (const [key, value] of Object.entries(next)) {
    if (key === "attempts") continue
    if (value > (prev[key] ?? 0)) out.push(conceptId(lessonId, key))
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/progress/concepts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/concepts.ts src/features/progress/concepts.test.ts
git commit -m "feat: concept taxonomy derived from engine durable counters"
```

---

## Task 3: Persistence interface + in-memory adapter

**Files:**
- Modify: `src/features/progress/ProgressRepository.ts`
- Modify: `src/features/progress/inMemoryProgressRepository.ts`
- Test: `src/features/progress/conceptReviewRepository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { createInMemoryProgressRepository } from "@/features/progress/inMemoryProgressRepository"
import { newReview } from "@/features/progress/conceptReview"

describe("ConceptReview persistence (in-memory)", () => {
  it("round-trips reviews per user and upserts by conceptId", async () => {
    const repo = createInMemoryProgressRepository()
    expect(await repo.getConceptReviews("u1")).toEqual([])

    const a = newReview("stacks-and-queues:classify", 1_000)
    await repo.saveConceptReview("u1", a)
    await repo.saveConceptReview("u1", { ...a, level: 2 }) // upsert same id

    const rows = await repo.getConceptReviews("u1")
    expect(rows).toHaveLength(1)
    expect(rows[0].level).toBe(2)
    expect(await repo.getConceptReviews("u2")).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/progress/conceptReviewRepository.test.ts`
Expected: FAIL (type error / `getConceptReviews` is not a function).

- [ ] **Step 3a: Extend the interface**

In `src/features/progress/ProgressRepository.ts`, add the import and two methods.

```ts
import type { ConceptReview } from "@/features/progress/conceptReview"
```

Add inside the `ProgressRepository` interface (after `getActivity`):

```ts
  /** All per-concept review rows for a user (signed-in only). */
  getConceptReviews(uid: string): Promise<ConceptReview[]>
  /** Upsert one review row by conceptId (optimistic, fire-and-forget). */
  saveConceptReview(uid: string, review: ConceptReview): Promise<void>
```

- [ ] **Step 3b: Implement in the in-memory adapter**

In `src/features/progress/inMemoryProgressRepository.ts`, add the import and a store, then the two methods inside the returned object (after `getActivity`).

```ts
import type { ConceptReview } from "@/features/progress/conceptReview"
```

```ts
  const conceptReviews = new Map<string, Map<string, ConceptReview>>()
```

```ts
    async getConceptReviews(uid) {
      const rows = conceptReviews.get(uid)
      return rows ? [...rows.values()].map((r) => ({ ...r })) : []
    },
    async saveConceptReview(uid, review) {
      let rows = conceptReviews.get(uid)
      if (!rows) {
        rows = new Map()
        conceptReviews.set(uid, rows)
      }
      rows.set(review.conceptId, { ...review })
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/progress/conceptReviewRepository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/ProgressRepository.ts src/features/progress/inMemoryProgressRepository.ts src/features/progress/conceptReviewRepository.test.ts
git commit -m "feat: ConceptReview persistence interface + in-memory adapter"
```

---

## Task 4: Firestore adapter + security rules

**Files:**
- Modify: `src/features/progress/firestoreProgressRepository.ts`
- Modify: `firestore.rules`
- Test: `src/features/progress/firestoreConceptReview.emulator.test.ts`

- [ ] **Step 1: Write the failing emulator test**

Mirror the structure of `firestoreProgressRepository.emulator.test.ts` (same `initializeTestEnvironment` setup it already uses). The behavioral assertion:

```ts
// inside the existing emulator describe/setup pattern, using the authed db:
it("round-trips a concept review for its owner", async () => {
  const repo = createFirestoreProgressRepository(authedDb)
  await repo.saveConceptReview("alice", newReview("trees:locate", 1_000))
  await repo.saveConceptReview("alice", { ...newReview("trees:locate", 2_000), level: 3 })
  const rows = await repo.getConceptReviews("alice")
  expect(rows).toHaveLength(1)
  expect(rows[0].conceptId).toBe("trees:locate")
  expect(rows[0].level).toBe(3)
})
```

(Import `newReview` from `@/features/progress/conceptReview`; reuse the file's existing emulator bootstrap for `authedDb` / project id.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:emulator`
Expected: FAIL (`getConceptReviews` not implemented on the Firestore adapter).

- [ ] **Step 3a: Implement the Firestore methods**

In `src/features/progress/firestoreProgressRepository.ts`, add the import, ref helpers, and methods.

```ts
import type { ConceptReview } from "@/features/progress/conceptReview"
```

Add ref helpers next to the others:

```ts
  const conceptReviewsCol = (uid: string) =>
    collection(db, "users", uid, "conceptReviews")
  const conceptReviewRef = (uid: string, conceptId: string) =>
    doc(db, "users", uid, "conceptReviews", conceptId)
```

Add methods inside the returned object (after `getActivity`):

```ts
    async getConceptReviews(uid): Promise<ConceptReview[]> {
      const snap = await getDocs(conceptReviewsCol(uid))
      return snap.docs.map((d) => {
        const x = d.data()
        return {
          conceptId: d.id,
          level: Number(x.level) || 0,
          correctStreak: Number(x.correctStreak) || 0,
          lapses: Number(x.lapses) || 0,
          seen: Number(x.seen) || 0,
          lastSeenAt: Number(x.lastSeenAt) || 0,
          dueAt: Number(x.dueAt) || 0,
          graduated: x.graduated === true,
        }
      })
    },

    async saveConceptReview(uid, review: ConceptReview) {
      await setDoc(
        conceptReviewRef(uid, review.conceptId),
        {
          level: review.level,
          correctStreak: review.correctStreak,
          lapses: review.lapses,
          seen: review.seen,
          lastSeenAt: review.lastSeenAt,
          dueAt: review.dueAt,
          graduated: review.graduated,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    },
```

Note: `conceptId` is the Firestore doc id (not duplicated in the body) and is read back from `d.id`, mirroring how `activity` keys its day docs.

- [ ] **Step 3b: Add the security rule**

In `firestore.rules`, mirror the existing per-user `activity` / `lessonProgress` rule with a `conceptReviews` match so a learner reads/writes only their own:

```
match /users/{uid}/conceptReviews/{conceptId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

(Place it beside the existing `users/{uid}/activity/{dayKey}` rule; match that rule's exact auth condition if it differs.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:emulator`
Expected: PASS (the new round-trip plus the existing emulator suite stays green).

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/firestoreProgressRepository.ts firestore.rules src/features/progress/firestoreConceptReview.emulator.test.ts
git commit -m "feat: Firestore ConceptReview adapter + owner-only security rule"
```

---

## Task 5: Provider + single write path + app wiring

**Files:**
- Create: `src/features/progress/ConceptReviewProvider.tsx`
- Modify: `src/main.tsx`

No new unit test (thin React glue over already-tested pure code + repo; it is exercised by the Plan 2 E2E tracer). Verify by typecheck + the app booting.

- [ ] **Step 1: Implement the provider**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import {
  applyReview,
  newReview,
  type ConceptReview,
} from "@/features/progress/conceptReview"
import type { ConceptId } from "@/features/progress/concepts"

/**
 * Owns the per-user ConceptReview cache and the SINGLE write path. Sits below
 * AuthProvider and above LessonRunProvider so the recovery hook (and the Plan 2
 * drill) can record reviews, and so deprogression can read them. Signed-in only:
 * recordReview is a no-op while signed out (anonymous runs are transient).
 */
interface ConceptReviewValue {
  reviews: ReadonlyMap<ConceptId, ConceptReview>
  recordReview: (conceptId: ConceptId, correct: boolean) => void
}

const ConceptReviewContext = createContext<ConceptReviewValue | null>(null)

export function ConceptReviewProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const repo = useMemo(() => createFirestoreProgressRepository(db), [])
  const [reviews, setReviews] = useState<Map<ConceptId, ConceptReview>>(
    () => new Map(),
  )
  const loadedUid = useRef<string | null>(null)

  // Load the signed-in user's rows once; clear on sign-out.
  useEffect(() => {
    if (!user) {
      loadedUid.current = null
      setReviews(new Map())
      return
    }
    if (loadedUid.current === user.uid) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await repo.getConceptReviews(user.uid)
        if (cancelled) return
        setReviews(new Map(rows.map((r) => [r.conceptId, r])))
        loadedUid.current = user.uid
      } catch {
        // Optimistic: a failed load just leaves the cache empty (all fresh).
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, repo])

  const recordReview = useCallback(
    (conceptId: ConceptId, correct: boolean) => {
      const uid = user?.uid
      if (!uid) return // signed-in only
      const now = Date.now()
      setReviews((prev) => {
        const base = prev.get(conceptId) ?? newReview(conceptId, now)
        const nextRow = applyReview(base, { correct, at: now })
        // Optimistic, idempotent (merge setDoc); fire-and-forget like saveProgress.
        void repo.saveConceptReview(uid, nextRow).catch(() => {})
        const next = new Map(prev)
        next.set(conceptId, nextRow)
        return next
      })
    },
    [user, repo],
  )

  const value = useMemo<ConceptReviewValue>(
    () => ({ reviews, recordReview }),
    [reviews, recordReview],
  )

  return (
    <ConceptReviewContext value={value}>{children}</ConceptReviewContext>
  )
}

export function useConceptReviews(): ConceptReviewValue {
  const ctx = useContext(ConceptReviewContext)
  if (!ctx)
    throw new Error("useConceptReviews must be used within ConceptReviewProvider")
  return ctx
}
```

- [ ] **Step 2: Wire it into the provider stack**

In `src/main.tsx`, import and nest it below `NavigationProvider`, above `LessonRunProvider`:

```tsx
import { ConceptReviewProvider } from "@/features/progress/ConceptReviewProvider"
```

```tsx
        <NavigationProvider initial={{ name: "home" }}>
          <ConceptReviewProvider>
            <LessonRunProvider>
              <CourseProgressProvider>
                <App />
              </CourseProgressProvider>
            </LessonRunProvider>
          </ConceptReviewProvider>
        </NavigationProvider>
```

- [ ] **Step 3: Typecheck and boot**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/progress/ConceptReviewProvider.tsx src/main.tsx
git commit -m "feat: ConceptReviewProvider (cache + single write path) wired into app"
```

---

## Task 6: In-lesson recovery hook

Feeds the substrate from normal lesson play: when a lesson's durable correct-count rises, the demonstrated concept is recorded as a correct rep. Rides the same progress-signature effect pattern the activity recorder already uses, so it is StrictMode- and resume-safe (deltas from monotonic counters, baselined while unreconciled).

**Known limitation (documented, not a bug):** the live Stacks & Queues engine stores binary `solved` flags, so a concept's counter rises 0->1 only on the *first* solve. Initial seeding works for every lesson; in-lesson *re-practice* healing works for the six counting engines but not for already-solved S&Q skills. The retrieval drill (Plan 2) heals any concept directly via `recordReview`. Closing the S&Q re-practice gap (a `gradedConcept` seam method, or confirming whether a completed lesson is even re-drillable in-lesson) is a tracked follow-up.

**Files:**
- Modify: `src/features/lesson/useLessonRun.tsx`
- (Reuses `risenConcepts` from Task 2, already tested.)

- [ ] **Step 1: Confirm the pure helper is covered**

`risenConcepts` already has a unit test (Task 2, Step 1). No new pure logic is introduced here; this task is the effect wiring.

- [ ] **Step 2: Add the recovery effect**

In `src/features/lesson/useLessonRun.tsx`, add imports:

```ts
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { risenConcepts } from "@/features/progress/concepts"
```

Inside `LessonRunProvider`, near the other refs, add a per-lesson counter baseline:

```ts
  const { recordReview } = useConceptReviews()
  const reviewBaseRef = useRef<Record<string, Record<string, number>>>({})
```

Add this effect directly after the existing activity-recording effect (it shares `progressSig` and the same reconcile gate):

```ts
  // Feed the concept-memory substrate from normal play: each rise in a lesson's
  // durable correct-count records a correct rep for that concept. Baseline while
  // signed-in-but-unreconciled (so a resume-hydrate jump never back-fills), then
  // diff. Anonymous runs no-op inside recordReview (signed-in only).
  useEffect(() => {
    const counters = module.toProgress(runsRef.current[lessonId]).counters
    if (user && reconciledKey.current !== `${user.uid}:${lessonId}`) {
      reviewBaseRef.current[lessonId] = counters
      return
    }
    const base = reviewBaseRef.current[lessonId]
    if (!base) {
      reviewBaseRef.current[lessonId] = counters
      return
    }
    for (const id of risenConcepts(lessonId, base, counters)) {
      recordReview(id, true)
    }
    reviewBaseRef.current[lessonId] = counters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lessonId, recordReview, progressSig])
```

- [ ] **Step 3: Typecheck and run the lesson suite**

Run: `npx tsc -b && npx vitest run src/features/lesson`
Expected: no type errors; existing lesson tests stay green.

- [ ] **Step 4: Commit**

```bash
git add src/features/lesson/useLessonRun.tsx
git commit -m "feat: in-lesson recovery hook feeding the concept-memory substrate"
```

---

## Self-review

**Spec coverage (substrate slice of the retrieval spec + the deprogression contract):**
- `ConceptReview`, ladder, `MAX_LEVEL`, `MIN_GAP`, `newReview`, `strength`, `applyReview` -> Task 1.
- `conceptsForLesson`, `ConceptId`, `retrievable`, recovery mapping -> Task 2.
- `getConceptReviews`/`saveConceptReview` + both adapters + rules + carry-(forward via lazy create) -> Tasks 3-4.
- `ConceptReviewProvider` + single write path `recordReview` + `useConceptReviews` (ReadonlyMap) -> Task 5.
- Recovery hook in `LessonRunProvider` -> Task 6.
- Out of this plan (Plan 2): item providers, `selectDueDrill`, the drill UI, the `LessonHost` entry gate, the E2E tracer, `checkpointDue`.

**Placeholder scan:** none. `NON_RETRIEVABLE` curation for non-S&Q lessons is a deliberate working default (all retrievable), not a placeholder; narrowing is called out as a follow-up.

**Type consistency:** `ConceptReview` and `ConceptId` are defined once in `conceptReview.ts` (Task 1, self-contained); `concepts.ts` (Task 2) imports and re-exports `ConceptId`, so there is no import cycle and Task 1 builds before Task 2 cleanly. `recordReview(conceptId, correct)` and `risenConcepts(lessonId, prev, next)` signatures match every call site, and the repository/provider import `ConceptReview` verbatim.

## Open coordination notes

- **Recovery for binary S&Q re-practice** (Task 6 limitation) is the one cross-cutting item to resolve with the deprogression chat; both features are unaffected for initial seeding and for the six counting lessons.
- **`retrievable` curation** for arrays/linked-lists/hash-tables/trees/heaps/graphs lands with Plan 2's item providers (which require each engine's sub-skill semantics anyway).

## Execution handoff

Because the two sibling chats are editing the same working tree, this runs in an **isolated git worktree on `feat/spaced-repetition-retrieval`** (see superpowers:using-git-worktrees), landing as a focused PR into green `main`. The substrate must merge before deprogression's provider wiring and before Plan 2.

Two execution options:

1. **Subagent-Driven (recommended)** - a fresh subagent per task with spec + code-quality review between tasks.
2. **Inline Execution** - tasks executed in this session with checkpoints.
