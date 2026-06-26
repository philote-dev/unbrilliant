# Spaced-Repetition Retrieval (Type 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a returning, signed-in learner enters their next lesson, occasionally surface a short reworded retrieval drill on a load-bearing sub-skill from an already-completed lesson, then continue into the lesson. Deterministic, no-AI, non-blocking.

**Architecture:** An item-provider registry wraps each lesson's existing seeded generators behind one seam (`conceptId -> (seed, encounter) => RetrievalItem`). A pure scheduler (`selectDueDrill`) reads the shared `ConceptReview` rows to pick the single most-overdue due concept and assembles its reworded items. A small pure reducer drives the drill, reusing the shared `gradeAnswer` feedback machine; a thin view renders it and reports each answer through the substrate's `recordReview`. `LessonHost` gates the drill before the lesson. A pure `checkpointDue` decides when a Type 2 checkpoint appears (content/grading belong to the mastery chat).

**Tech Stack:** TypeScript, Vitest (unit), React 19, Playwright + Firebase emulator (E2E).

**Depends on:** PR 1 `docs/plans/2026-06-25-concept-review-substrate.md` (the `ConceptReview` substrate, `concepts.ts`, and `ConceptReviewProvider`). This is PR 2 (branch `feat/spaced-repetition-retrieval`).

Companion spec: `docs/plans/specs/2026-06-25-spaced-repetition-retrieval-design.md`.

---

## Task 1: Item-provider registry

**Files:**
- Create: `src/features/retrieval/itemProvider.ts`
- Test: `src/features/retrieval/itemProvider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"

import {
  classifyVerdict,
  drainOrder,
} from "@/features/lesson/stacksQueuesEngine"
import { ITEM_PROVIDERS } from "@/features/retrieval/itemProvider"

describe("retrieval item providers", () => {
  it("are pure: same (seed, encounter) yields the same item", () => {
    const p = ITEM_PROVIDERS["stacks-and-queues:classify"]
    expect(p(42, 0)).toEqual(p(42, 0))
  })

  it("reword across encounters (prompt changes)", () => {
    const p = ITEM_PROVIDERS["stacks-and-queues:classify"]
    expect(p(42, 0).prompt).not.toBe(p(42, 1).prompt)
  })

  it("classify answer matches the pure verdict and is a valid option", () => {
    const item = ITEM_PROVIDERS["stacks-and-queues:classify"](7, 0)
    expect(["stack", "queue", "neither"]).toContain(item.answerId)
    expect(item.options.map((o) => o.id)).toContain(item.answerId)
  })

  it("stack predict answer is the most-recently-added item", () => {
    const item = ITEM_PROVIDERS["stacks-and-queues:stackPredict"](3, 0)
    const arrival = item.options.map((o) => o.id)
    expect(item.answerId).toBe(drainOrder(arrival, "stack")[0])
    expect(item.answerId).toBe(arrival[arrival.length - 1])
  })

  it("queue predict answer is the earliest-added item", () => {
    const item = ITEM_PROVIDERS["stacks-and-queues:queuePredict"](3, 0)
    const arrival = item.options.map((o) => o.id)
    expect(item.answerId).toBe(drainOrder(arrival, "queue")[0])
    expect(item.answerId).toBe(arrival[0])
  })

  it("classify verdict helper stays the source of truth", () => {
    expect(classifyVerdict(["A", "B", "C"], ["C", "B", "A"])).toBe("stack")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/retrieval/itemProvider.test.ts`
Expected: FAIL with "Cannot find module '@/features/retrieval/itemProvider'".

- [ ] **Step 3: Write the implementation**

```ts
// src/features/retrieval/itemProvider.ts
import {
  CLASSIFY_BANK,
  classifyVerdict,
  drainOrder,
  type Discipline,
} from "@/features/lesson/stacksQueuesEngine"
import type { ConceptId } from "@/features/progress/conceptReview"

/**
 * One seam over each lesson's existing seeded generators + pure verdicts, so the
 * retrieval drill can render/grade any concept without importing seven engines.
 * Each provider is pure: same (seed, encounter) yields the same item; `encounter`
 * rotates surface/phrasing (Bjork varied presentation). Tap-gradeable concepts
 * only for now.
 */
export interface RetrievalItem {
  conceptId: ConceptId
  prompt: string
  options: { id: string; label: string }[]
  answerId: string
  why: string
}

export type ItemProvider = (seed: number, encounter: number) => RetrievalItem

function rng(seed: number, encounter: number): () => number {
  let a = (seed ^ Math.imul(encounter + 1, 0x9e3779b1)) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], next: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const CLASSIFY_PROMPTS = [
  "Everything goes in, then comes out in this order. Which behavior is that?",
  "In one end, then out in this order. Stack, queue, or neither?",
  "Given the in and out orders below, which structure could do that?",
]

function classifyProvider(seed: number, encounter: number): RetrievalItem {
  const next = rng(seed, encounter)
  const inst = CLASSIFY_BANK[Math.floor(next() * CLASSIFY_BANK.length)]
  const answerId = classifyVerdict(inst.inOrder, inst.outOrder)
  const why =
    answerId === "stack"
      ? "Out is the exact reverse of in, so last in came out first: a stack."
      : answerId === "queue"
        ? "Out matches in, so first in came out first: a queue."
        : "This order is not a clean reverse or a match, so no single stack or queue makes it."
  return {
    conceptId: "stacks-and-queues:classify",
    prompt: `${CLASSIFY_PROMPTS[encounter % CLASSIFY_PROMPTS.length]} In: ${inst.inOrder.join(
      ", ",
    )}. Out: ${inst.outOrder.join(", ")}.`,
    options: [
      { id: "stack", label: "Stack (last in, first out)" },
      { id: "queue", label: "Queue (first in, first out)" },
      { id: "neither", label: "Neither" },
    ],
    answerId,
    why,
  }
}

const PREDICT_PROMPTS: Record<Discipline, string[]> = {
  stack: [
    "These were pushed onto a stack in this order. Which comes out first?",
    "A stack received these, in order. Which is removed first?",
    "Pushed onto a stack like so. Which one pops first?",
  ],
  queue: [
    "These joined a queue in this order. Which is served first?",
    "A queue received these, in order. Which leaves first?",
    "Lined up in this order. Which one is next out?",
  ],
}

function predictProvider(discipline: Discipline, conceptId: ConceptId): ItemProvider {
  return (seed, encounter) => {
    const next = rng(seed, encounter)
    const n = 3 + Math.floor(next() * 2) // 3 or 4 items
    const arrival = shuffle(["A", "B", "C", "D"].slice(0, n), next)
    const answerId = drainOrder(arrival, discipline)[0]
    return {
      conceptId,
      prompt: `${PREDICT_PROMPTS[discipline][encounter % PREDICT_PROMPTS[discipline].length]} Added: ${arrival.join(
        ", ",
      )}.`,
      options: arrival.map((l) => ({ id: l, label: l })),
      answerId,
      why:
        discipline === "stack"
          ? `A stack is last in, first out, so the most recently added (${answerId}) comes out first.`
          : `A queue is first in, first out, so the earliest added (${answerId}) comes out first.`,
    }
  }
}

export const ITEM_PROVIDERS: Record<ConceptId, ItemProvider> = {
  "stacks-and-queues:classify": classifyProvider,
  "stacks-and-queues:stackPredict": predictProvider(
    "stack",
    "stacks-and-queues:stackPredict",
  ),
  "stacks-and-queues:queuePredict": predictProvider(
    "queue",
    "stacks-and-queues:queuePredict",
  ),
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/retrieval/itemProvider.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/retrieval/itemProvider.ts src/features/retrieval/itemProvider.test.ts
git commit -m "feat: retrieval item-provider registry over S&Q seeded generators"
```

---

## Task 2: Scheduler (`selectDueDrill`)

**Files:**
- Create: `src/features/retrieval/selectDrill.ts`
- Test: `src/features/retrieval/selectDrill.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"

import { newReview, type ConceptReview } from "@/features/progress/conceptReview"
import { selectDueDrill, seedFromUid } from "@/features/retrieval/selectDrill"

const DONE = new Set(["stacks-and-queues"])
const row = (id: string, dueAt: number): ConceptReview => ({
  ...newReview(id, 0),
  dueAt,
})

describe("selectDueDrill", () => {
  it("returns null when nothing is due", () => {
    const reviews = [row("stacks-and-queues:classify", 10_000)]
    expect(
      selectDueDrill(reviews, { completedLessonIds: DONE, now: 5_000, userSeed: 1 }),
    ).toBeNull()
  })

  it("returns null when the concept's lesson is not completed", () => {
    const reviews = [row("stacks-and-queues:classify", 0)]
    expect(
      selectDueDrill(reviews, {
        completedLessonIds: new Set(),
        now: 5_000,
        userSeed: 1,
      }),
    ).toBeNull()
  })

  it("picks the most-overdue due concept and builds one item by default", () => {
    const reviews = [
      row("stacks-and-queues:classify", 4_000),
      row("stacks-and-queues:stackPredict", 1_000), // more overdue
    ]
    const drill = selectDueDrill(reviews, {
      completedLessonIds: DONE,
      now: 5_000,
      userSeed: 1,
    })
    expect(drill?.conceptId).toBe("stacks-and-queues:stackPredict")
    expect(drill?.items).toHaveLength(1)
    expect(drill?.items[0].conceptId).toBe("stacks-and-queues:stackPredict")
  })

  it("honors itemCount up to 3", () => {
    const reviews = [row("stacks-and-queues:classify", 0)]
    const drill = selectDueDrill(reviews, {
      completedLessonIds: DONE,
      now: 5_000,
      userSeed: 1,
      itemCount: 3,
    })
    expect(drill?.items).toHaveLength(3)
  })

  it("seedFromUid is stable", () => {
    expect(seedFromUid("abc")).toBe(seedFromUid("abc"))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/retrieval/selectDrill.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write the implementation**

```ts
// src/features/retrieval/selectDrill.ts
import { retrievableConcepts } from "@/features/progress/concepts"
import { strength, type ConceptReview } from "@/features/progress/conceptReview"
import { ITEM_PROVIDERS, type RetrievalItem } from "@/features/retrieval/itemProvider"

export interface DueDrill {
  conceptId: string
  items: RetrievalItem[]
}

const RETRIEVABLE_IDS = new Set(retrievableConcepts().map((c) => c.id))

export function lessonOfConcept(conceptId: string): string {
  return conceptId.split(":")[0]
}

/** A stable per-user seed so item draws are deterministic and replayable. */
export function seedFromUid(uid: string): number {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (Math.imul(h, 31) + uid.charCodeAt(i)) | 0
  return h
}

function itemSeed(userSeed: number, conceptId: string, encounter: number): number {
  let h = userSeed | 0
  for (let i = 0; i < conceptId.length; i++)
    h = (Math.imul(h, 31) + conceptId.charCodeAt(i)) | 0
  return (h ^ Math.imul(encounter + 1, 0x9e3779b1)) | 0
}

/**
 * The single most-overdue due concept whose lesson is completed and that has a
 * registered provider, assembled into 1..3 reworded items. Single-topic per drill;
 * interleaving emerges across sessions as the most-overdue concept rotates.
 */
export function selectDueDrill(
  reviews: ConceptReview[],
  ctx: {
    completedLessonIds: Set<string>
    now: number
    userSeed: number
    itemCount?: number
  },
): DueDrill | null {
  const due = reviews.filter(
    (r) =>
      RETRIEVABLE_IDS.has(r.conceptId) &&
      !!ITEM_PROVIDERS[r.conceptId] &&
      ctx.completedLessonIds.has(lessonOfConcept(r.conceptId)) &&
      r.dueAt <= ctx.now,
  )
  if (due.length === 0) return null

  due.sort((a, b) => {
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt // smaller dueAt = more overdue
    const s = strength(a, ctx.now) - strength(b, ctx.now) // then lowest strength
    if (s !== 0) return s
    return a.lastSeenAt - b.lastSeenAt // then oldest
  })

  const r = due[0]
  const provider = ITEM_PROVIDERS[r.conceptId]
  const count = Math.max(1, Math.min(ctx.itemCount ?? 1, 3))
  const items: RetrievalItem[] = []
  for (let i = 0; i < count; i++) {
    items.push(provider(itemSeed(ctx.userSeed, r.conceptId, r.seen + i), r.seen + i))
  }
  return { conceptId: r.conceptId, items }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/retrieval/selectDrill.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/retrieval/selectDrill.ts src/features/retrieval/selectDrill.test.ts
git commit -m "feat: due-based retrieval scheduler (most-overdue, single-topic)"
```

---

## Task 3: Drill reducer (`retrievalSession.ts`)

**Files:**
- Create: `src/features/retrieval/retrievalSession.ts`
- Test: `src/features/retrieval/retrievalSession.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"

import {
  createRetrieval,
  retrievalReducer,
  type RetrievalState,
} from "@/features/retrieval/retrievalSession"
import type { RetrievalItem } from "@/features/retrieval/itemProvider"

const items: RetrievalItem[] = [
  {
    conceptId: "c1",
    prompt: "q1",
    options: [
      { id: "x", label: "x" },
      { id: "y", label: "y" },
    ],
    answerId: "x",
    why: "because x",
  },
]

const run = (s: RetrievalState, ...as: Parameters<typeof retrievalReducer>[1][]) =>
  as.reduce(retrievalReducer, s)

describe("retrieval session reducer", () => {
  it("a correct answer is terminal and records the result", () => {
    const s = run(
      createRetrieval(items),
      { type: "select", optionId: "x" },
      { type: "check" },
    )
    expect(s.feedback).toBe("correct")
    expect(s.results).toEqual([true])
  })

  it("first wrong nudges (retry), second wrong fails", () => {
    let s = run(
      createRetrieval(items),
      { type: "select", optionId: "y" },
      { type: "check" },
    )
    expect(s.feedback).toBe("nudge")
    expect(s.results).toEqual([])
    s = run(s, { type: "select", optionId: "y" }, { type: "check" })
    expect(s.feedback).toBe("fail")
    expect(s.results).toEqual([false])
  })

  it("next finishes the single-item drill", () => {
    const s = run(
      createRetrieval(items),
      { type: "select", optionId: "x" },
      { type: "check" },
      { type: "next" },
    )
    expect(s.done).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/retrieval/retrievalSession.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write the implementation**

```ts
// src/features/retrieval/retrievalSession.ts
import { gradeAnswer, type Feedback } from "@/features/lesson/engine"
import type { RetrievalItem } from "@/features/retrieval/itemProvider"

/**
 * Pure reducer for a single-topic retrieval drill. Reuses the shared `gradeAnswer`
 * feedback machine + combo so feedback and flame behave exactly like a lesson. No
 * I/O: the view calls `recordReview` when an item reaches a terminal verdict.
 */
export interface RetrievalState {
  items: RetrievalItem[]
  index: number
  selected: string | null
  feedback: Feedback
  wrongCount: number
  revealed: boolean
  combo: number
  results: boolean[] // one entry per item once it terminalizes
  done: boolean
}

export type RetrievalAction =
  | { type: "select"; optionId: string }
  | { type: "check" }
  | { type: "next" }

const FRESH = {
  selected: null,
  feedback: "idle" as Feedback,
  wrongCount: 0,
  revealed: false,
}

export function createRetrieval(items: RetrievalItem[]): RetrievalState {
  return {
    items,
    index: 0,
    combo: 0,
    results: [],
    done: items.length === 0,
    ...FRESH,
  }
}

const isTerminal = (f: Feedback) => f === "correct" || f === "fail"

export function retrievalReducer(
  state: RetrievalState,
  action: RetrievalAction,
): RetrievalState {
  if (state.done) return state
  const item = state.items[state.index]
  switch (action.type) {
    case "select":
      if (isTerminal(state.feedback)) return state
      return { ...state, selected: action.optionId, feedback: "idle" }
    case "check": {
      if (state.selected == null || isTerminal(state.feedback)) return state
      const correct = state.selected === item.answerId
      const v = gradeAnswer(state, correct)
      return {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        results: isTerminal(v.feedback) ? [...state.results, correct] : state.results,
      }
    }
    case "next": {
      if (!isTerminal(state.feedback)) return state
      const index = state.index + 1
      if (index >= state.items.length) return { ...state, done: true }
      return { ...state, index, ...FRESH }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/retrieval/retrievalSession.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/retrieval/retrievalSession.ts src/features/retrieval/retrievalSession.test.ts
git commit -m "feat: pure retrieval drill reducer (reuses gradeAnswer)"
```

---

## Task 4: Drill view (`RetrievalDrill.tsx`)

**Files:**
- Create: `src/features/retrieval/RetrievalDrill.tsx`

(Behavior is covered by the Task 3 reducer tests and the Task 7 E2E tracer; this is the thin presentational shell.)

- [ ] **Step 1: Write the component**

```tsx
// src/features/retrieval/RetrievalDrill.tsx
import { useEffect, useReducer, useRef } from "react"

import { Button } from "@/components/ui/button"
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import {
  createRetrieval,
  retrievalReducer,
} from "@/features/retrieval/retrievalSession"
import type { RetrievalItem } from "@/features/retrieval/itemProvider"

/**
 * The pre-lesson warm-up. Mandatory attempt, non-blocking: the learner answers,
 * sees the correction, and proceeds. Each item reports through `recordReview` once
 * when it reaches a terminal verdict.
 */
export function RetrievalDrill({
  items,
  lessonName,
  onDone,
}: {
  items: RetrievalItem[]
  lessonName: string
  onDone: () => void
}) {
  const { recordReview } = useConceptReviews()
  const [state, dispatch] = useReducer(retrievalReducer, items, createRetrieval)
  const recordedRef = useRef<number>(-1)

  const item = state.items[state.index]
  const terminal = state.feedback === "correct" || state.feedback === "fail"
  const last = state.index + 1 >= state.items.length

  useEffect(() => {
    if (terminal && recordedRef.current !== state.index && item) {
      recordedRef.current = state.index
      recordReview(item.conceptId, state.feedback === "correct")
    }
  }, [terminal, state.index, state.feedback, item, recordReview])

  useEffect(() => {
    if (state.done) onDone()
  }, [state.done, onDone])

  if (state.done || !item) return null

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <p className="text-sm font-medium text-muted-foreground">
        Quick warm-up from {lessonName}
      </p>
      <p className="text-lg">{item.prompt}</p>
      <div className="flex flex-col gap-2">
        {item.options.map((o) => (
          <Button
            key={o.id}
            variant={state.selected === o.id ? "default" : "outline"}
            disabled={terminal}
            onClick={() => dispatch({ type: "select", optionId: o.id })}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {state.feedback === "nudge" && (
        <p className="text-sm text-amber-600">Not quite. Take another look and try again.</p>
      )}

      {!terminal ? (
        <Button
          disabled={state.selected == null}
          onClick={() => dispatch({ type: "check" })}
        >
          Check
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold">
              {state.feedback === "correct" ? "Correct. " : "Answer: "}
            </span>
            {item.why}
          </p>
          <Button onClick={() => dispatch({ type: "next" })}>
            {last ? `Continue to ${lessonName}` : "Next"}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/retrieval/RetrievalDrill.tsx
git commit -m "feat: retrieval drill view (mandatory attempt, non-blocking)"
```

---

## Task 5: Gate the drill at lesson entry (`LessonHost`)

**Files:**
- Modify: `src/lessons/LessonHost.tsx`

- [ ] **Step 1: Add the drill gate**

Replace the body of `LessonHost` so it checks for a due drill first. Keep the existing playable/lazy routing as the fallback.

```tsx
// src/lessons/LessonHost.tsx
import { Suspense, useMemo, useState } from "react"

import { LIVE_LESSON_ID, isLessonPlayable, lessonName } from "@/lessons/catalog"
import { FUTURE_LESSONS } from "@/lessons/registry"
import { LessonPlayer } from "@/screens/LessonPlayer"
import { WillowMark } from "@/components/willow/Logo"
import { useAuth } from "@/lib/auth"
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { RetrievalDrill } from "@/features/retrieval/RetrievalDrill"
import {
  lessonOfConcept,
  seedFromUid,
  selectDueDrill,
} from "@/features/retrieval/selectDrill"

// One drill per concept per app session (a refresh clears it). Module-level so it
// survives LessonHost remounts as the learner navigates between lessons.
const shownThisSession = new Set<string>()

export function LessonHost({ lessonId }: { lessonId: string }) {
  const { user } = useAuth()
  const { reviews } = useConceptReviews()
  const { progressByLesson } = useCourseProgress()
  const [drillDone, setDrillDone] = useState(false)

  const drill = useMemo(() => {
    if (!user || drillDone) return null
    const completedLessonIds = new Set(
      Object.entries(progressByLesson)
        .filter(([, p]) => p?.completed)
        .map(([id]) => id),
    )
    const d = selectDueDrill(reviews, {
      completedLessonIds,
      now: Date.now(),
      userSeed: seedFromUid(user.uid),
    })
    if (!d || shownThisSession.has(d.conceptId)) return null
    return d
  }, [user, drillDone, reviews, progressByLesson])

  if (drill) {
    return (
      <RetrievalDrill
        items={drill.items}
        lessonName={lessonName(lessonOfConcept(drill.conceptId))}
        onDone={() => {
          shownThisSession.add(drill.conceptId)
          setDrillDone(true)
        }}
      />
    )
  }

  if (isLessonPlayable(lessonId)) {
    return <LessonPlayer lessonId={lessonId} />
  }
  const Lazy = FUTURE_LESSONS[lessonId]
  if (!Lazy) return <LessonPlayer lessonId={LIVE_LESSON_ID} />
  return (
    <Suspense fallback={<LessonLoading />}>
      <Lazy />
    </Suspense>
  )
}

function LessonLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <WillowMark className="size-10 animate-pulse" />
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check + app boots**

Run: `npx tsc -b`
Expected: PASS.
Run: `npm run dev`; sign in, complete Stacks & Queues, then open the next lesson the following day (or use the E2E seeding in Task 7) to see the warm-up.

- [ ] **Step 3: Commit**

```bash
git add src/lessons/LessonHost.tsx
git commit -m "feat: surface the retrieval drill before a due lesson entry"
```

---

## Task 6: Type 2 checkpoint due-decision (`checkpoint.ts`)

**Files:**
- Create: `src/features/retrieval/checkpoint.ts`
- Test: `src/features/retrieval/checkpoint.test.ts`

(My part only: deciding when a checkpoint is due. Checkpoint content and grading belong to the mastery-question chat.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"

import { newReview, type ConceptReview } from "@/features/progress/conceptReview"
import { conceptsForLesson } from "@/features/progress/concepts"
import { checkpointDue } from "@/features/retrieval/checkpoint"
import type { ProgressByLesson } from "@/lessons/catalog"

const completed = (...ids: string[]): ProgressByLesson =>
  Object.fromEntries(
    ids.map((id) => [id, { counters: {}, currentPart: "", completed: true }]),
  )

const strongRows = (lessonId: string, now: number): ConceptReview[] =>
  conceptsForLesson(lessonId).map((c) => ({ ...newReview(c.id, now), level: 3 }))

describe("checkpointDue", () => {
  it("is null until all prerequisite lessons are completed", () => {
    expect(
      checkpointDue("data-structures", completed("stacks-and-queues"), [], 0),
    ).toBeNull()
  })

  it("returns the checkpoint id once prerequisites are done and concepts are strong", () => {
    const now = 1_000_000
    const progress = completed("stacks-and-queues", "arrays", "linked-lists")
    const reviews = [
      ...strongRows("stacks-and-queues", now),
      ...strongRows("arrays", now),
      ...strongRows("linked-lists", now),
    ]
    expect(checkpointDue("data-structures", progress, reviews, now)).toBe(
      "ds-linear-check",
    )
  })

  it("stays null for an already-passed checkpoint", () => {
    const now = 1_000_000
    const progress = completed("stacks-and-queues", "arrays", "linked-lists")
    const reviews = [
      ...strongRows("stacks-and-queues", now),
      ...strongRows("arrays", now),
      ...strongRows("linked-lists", now),
    ]
    expect(
      checkpointDue(
        "data-structures",
        progress,
        reviews,
        now,
        new Set(["ds-linear-check"]),
      ),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/retrieval/checkpoint.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write the implementation**

```ts
// src/features/retrieval/checkpoint.ts
import { conceptsForLesson } from "@/features/progress/concepts"
import { strength, type ConceptReview } from "@/features/progress/conceptReview"
import type { ProgressByLesson } from "@/lessons/catalog"

/**
 * The retrieval system's only part of Type 2: deciding WHEN a course checkpoint is
 * due. The checkpoint experience, scenario pool, and grading belong to the
 * mastery-question chat. Catalog-driven config so it scales to future courses.
 */
export type CheckpointId = string

interface Checkpoint {
  id: CheckpointId
  courseId: string
  afterLessons: string[]
  minStrength: number // average concept strength across afterLessons to be "ready"
}

export const CHECKPOINTS: Checkpoint[] = [
  {
    id: "ds-linear-check",
    courseId: "data-structures",
    afterLessons: ["stacks-and-queues", "arrays", "linked-lists"],
    minStrength: 0.4,
  },
]

export function checkpointDue(
  courseId: string,
  progress: ProgressByLesson,
  reviews: ConceptReview[],
  now: number,
  passed: Set<CheckpointId> = new Set(),
): CheckpointId | null {
  const byId = new Map(reviews.map((r) => [r.conceptId, r]))
  for (const cp of CHECKPOINTS) {
    if (cp.courseId !== courseId || passed.has(cp.id)) continue
    if (!cp.afterLessons.every((id) => progress[id]?.completed)) continue
    const strengths = cp.afterLessons.flatMap((id) =>
      conceptsForLesson(id).map((c) => {
        const r = byId.get(c.id)
        return r ? strength(r, now) : 0
      }),
    )
    const avg =
      strengths.length === 0
        ? 0
        : strengths.reduce((a, b) => a + b, 0) / strengths.length
    if (avg >= cp.minStrength) return cp.id
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/retrieval/checkpoint.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/retrieval/checkpoint.ts src/features/retrieval/checkpoint.test.ts
git commit -m "feat: Type 2 checkpoint due-decision (retrieval's part only)"
```

---

## Task 7: E2E tracer (entry drill appears, then the lesson)

**Files:**
- Create: `e2e/retrieval.spec.ts`

This mirrors the auth + emulator setup in the existing `e2e/tracer.spec.ts`. Rather than fast-forward the clock, seed a past-due review and a completed prerequisite directly in the emulator, then assert the drill gates the next lesson and does not reappear.

- [ ] **Step 1: Write the E2E test**

```ts
import { expect, test } from "@playwright/test"

// Reuse the project's e2e helpers from tracer.spec.ts:
// - signInTestUser(page) -> { uid }
// - seedFirestore(uid, { lessonProgress, conceptReviews }) writes docs to the emulator
// - gotoLesson(page, lessonId)
import { gotoLesson, seedFirestore, signInTestUser } from "./helpers"

test("a due concept shows a warm-up before the next lesson, once", async ({ page }) => {
  const { uid } = await signInTestUser(page)
  await seedFirestore(uid, {
    lessonProgress: {
      "stacks-and-queues": { counters: { classify: 1 }, currentPart: "compare", completed: true },
    },
    conceptReviews: {
      "stacks-and-queues:classify": {
        level: 0,
        correctStreak: 0,
        lapses: 0,
        seen: 1,
        lastSeenAt: 0,
        dueAt: 1, // far in the past => due now
        graduated: false,
      },
    },
  })

  await gotoLesson(page, "arrays")
  await expect(page.getByText(/Quick warm-up from Stacks & Queues/i)).toBeVisible()

  // Answer the single item (any option), then continue into the lesson.
  await page.getByRole("button", { name: /Stack|Queue|Neither|^A$|^B$|^C$|^D$/ }).first().click()
  await page.getByRole("button", { name: /^Check$/ }).click()
  await page.getByRole("button", { name: /Continue to|^Next$/ }).click()

  // The lesson is now showing and the drill is gone.
  await expect(page.getByText(/Quick warm-up/i)).toHaveCount(0)

  // Re-entering the same session does not show it again.
  await gotoLesson(page, "home")
  await gotoLesson(page, "arrays")
  await expect(page.getByText(/Quick warm-up/i)).toHaveCount(0)
})
```

- [ ] **Step 2: Run the tracer**

Run: `npm run e2e -- retrieval`
Expected: PASS. (If the helpers differ, adapt to `e2e/tracer.spec.ts`'s actual exports; the assertions stay the same.)

- [ ] **Step 3: Full suite + commit**

Run: `npm test && npx tsc -b`
Expected: PASS.

```bash
git add e2e/retrieval.spec.ts
git commit -m "test: e2e tracer for the pre-lesson retrieval drill"
```

---

## Self-review (against the spec)

- **Contract 2 (item-provider registry):** Task 1. Pure `(seed, encounter) => RetrievalItem`, reword by encounter, wraps S&Q verdict helpers. (Covered.)
- **Scheduler policy (deck/cooldown/selection/assembly/frequency):** Tasks 2 + 5. Eligibility (retrievable + completed + due), most-overdue selection, single-topic 1..3 items, once-per-session guard. Cooldown is the substrate's ladder (PR 1). (Covered.)
- **Drill (mandatory, non-blocking, reuses gradeAnswer):** Tasks 3, 4. (Covered.)
- **Integration at lesson entry:** Task 5 (`LessonHost`). (Covered.)
- **Type 2 due-decision (mine only):** Task 6. (Covered.)
- **Determinism + 3 test seams:** unit (Tasks 1-3, 6), the substrate's repo integration (PR 1), E2E tracer (Task 7). (Covered.)
- **No-AI gate:** every provider is pure and tap-gradeable; verdicts come from the engine's pure helpers. (Covered.)

## Open items / follow-ups (not blocking this PR)

- **Sign-in backfill** for lessons completed before this shipped (seed level-0 rows). Forward play seeds lazily via the recovery hook; backfill is a small follow-up (low priority, pre-launch).
- **More concepts:** wire Arrays / Linked Lists / etc. providers as those lessons' tap-gradeable sub-skills are added; the registry + taxonomy are the only touch-points.
- **Gestural retrieval items** (construct / rewire / draw) once a shared drag-renderer exists.
- **Checkpoint wiring:** the catalog "checkpoint node" kind + the mastery chat's content/grading consume `checkpointDue`; coordinate placement and threshold.

## Risks / notes for the implementer

- `selectDueDrill` reads `reviews` from `useConceptReviews()` and completed lessons from `useCourseProgress()`; `LessonHost` renders under both providers (it is below `App`), so the hooks resolve.
- The `shownThisSession` module set gives "once per concept per app session"; `drillDone` gives "once per entry". A page refresh intentionally clears the session guard.
- Keep all answer derivation in the engine's pure verdict helpers (`predictAnswer`, `drainOrder`, `classifyVerdict`); never inline a second copy of the rule.
