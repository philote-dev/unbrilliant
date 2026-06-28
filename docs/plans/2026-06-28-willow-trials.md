# Willow Trials (Trial I: Linear Systems) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Trial I "Linear Systems" Mission A end to end: a deterministic, no-AI campaign engine plus a guided design board (choose a structure, tap-place operations, stress-test for viable/strained/broken, revise, retrospective), wired into navigation and Firestore, with a clean-pass mastery boost and self-contained soft gating, all added without disturbing the existing course path.

**Architecture:** A pure, unit-tested engine (`src/features/trials/`: capability-matrix grader, event-script simulator, `reinforceCheckpoint`, gating, save-state, `TrialModule` reducer) sits behind a seam that mirrors `LessonModule`. React UI (`src/trials/` + willow components) reuses the existing figures (`StackBin`, `QueueTube`, `ArrayStrip`, `NodeGraph`, `FrameSequence`). Integration is additive only: one navigation screen, three repository methods, one optional course-path node. Trial content is hand-authored data.

**Tech Stack:** React 19, TypeScript, `motion/react`, Tailwind v4, Vitest, Playwright, Firebase/Firestore. Path alias `@/` -> `src/`. Test runner: `npm run test`. Build: `npm run build`.

**Design spec:** `docs/plans/specs/2026-06-28-willow-trials-design.md` (read section 5 for the capability matrix, section 7 for Trial I content).

**Scope of THIS plan (Milestone 1):** spec build-order phases 1-4 plus boost/gating wiring, delivering a playable, testable Trial I **Mission A** ("The Line Breaks"). Mission B ("The Playlist Machine"), the full retrospective polish, and the Trial II data skeleton are **Milestone 2** (follow-up plan), outlined at the end.

**Conventions for every task:** TDD (failing test first), conventional-commit messages, and stage ONLY Trials files (`git add` explicit paths, never `git add -A`) because the working tree has unrelated in-flight changes.

---

## File structure (Milestone 1)

Engine (pure, no React):
- `src/features/trials/types.ts` - shared types (StructureKind, Position, Cost, Verdict, specs, save-state).
- `src/features/trials/capability.ts` - `CAPABILITY` matrix, `costAt`, `classify`, `costWord`.
- `src/features/trials/simulate.ts` - `simulateLine` event-script simulator + `gradePrediction` for Mission A final review.
- `src/features/trials/reinforceCheckpoint.ts` - the boost (only new entry point into the concept ladder).
- `src/features/trials/gating.ts` - `trialUnlocked` (soft chaining).
- `src/features/trials/saveState.ts` - `TrialSaveState` + `toProgress`/`resume` helpers.
- `src/features/trials/trialModule.ts` - `TrialModule`, reducer, action types.

Content (data):
- `src/trials/trialOne/missionA.ts` - Mission A segment specs (A1-A4).
- `src/trials/trialOne/retrospective.ts` - retrospective copy.
- `src/trials/trialOne/index.ts` - the `TrialSpec` for Trial I (Mission A wired; Mission B added in M2).
- `src/trials/registry.ts` - `TRIALS` list + `trialOrder`.

State + plumbing:
- `src/features/trials/TrialRunProvider.tsx` - in-memory run + auto-save + reconcile (mirrors `LessonRunProvider`).
- `src/features/progress/ProgressRepository.ts` (modify) - add 3 trial methods.
- `src/features/progress/firestoreProgressRepository.ts` (modify) - implement them.
- `src/features/progress/inMemoryProgressRepository.ts` (modify) - implement them.
- `src/lib/navigation.tsx` (modify) - add `{ name: "trial"; trialId }`.
- `src/App.tsx` (modify) - route the trial screen.
- `src/trials/TrialHost.tsx` - resolves trialId -> spec, mounts player.

UI:
- `src/trials/ui/TrialGate.tsx` - immersive entrance.
- `src/trials/ui/TrialPlayer.tsx` - phase orchestration (gate/design/stress/revise/retrospective/complete).
- `src/trials/ui/TrialTopBar.tsx` - trial/mission/saved markers.
- `src/trials/ui/ClientScene.tsx` - skin renderer (reads engine state only).
- `src/trials/ui/DesignBoard.tsx` - palette + chips + slots + rule echo.
- `src/trials/ui/StructurePalette.tsx`, `OperationChip.tsx`, `RuleEcho.tsx`.
- `src/trials/ui/StressTestPanel.tsx` - run + replay + verdict.
- `src/trials/ui/RevisionTimeline.tsx`, `NudgeDrawer.tsx`, `RetrospectivePanel.tsx`.

---

## PHASE 1: Pure engine (TDD)

### Task 1: Engine types

**Files:**
- Create: `src/features/trials/types.ts`

- [ ] **Step 1: Write the types** (no separate test; consumed by Task 2+ tests which fail to compile if wrong)

```ts
export type StructureKind = "stack" | "queue" | "array" | "linked-list"
export type Position = "front" | "back" | "middle" | "top" | "current" | "byIndex"
export type Cost = "cheap" | "expensive" | "impossible"
export type Verdict = "viable" | "strained" | "broken"

export type TrialId = string

export interface DesignState {
  structure: StructureKind
  /** op id -> chosen position */
  mapping: Record<string, Position>
  policy?: Record<string, string>
}

export interface VerdictResult {
  status: Verdict
  /** key into SegmentSpec.explanations */
  explainId: Verdict
  /** key into SegmentSpec.nudges, when not viable */
  nudgeId?: string
}

export interface OperationSpec {
  id: string
  label: string
  allowedPositions: Position[]
}

export interface RequiredMapping {
  op: string
  position: Position
}

export interface SegmentSpec {
  id: string
  clientPrompt: string
  offeredStructures: StructureKind[]
  operations: OperationSpec[]
  required: RequiredMapping[]
  grading: "capability" | "prediction"
  policy?: { id: string; options: string[]; correct: string[] }
  /** present for grading === "prediction" */
  eventScript?: unknown
  explanations: Record<Verdict, string>
  nudges: Record<string, string>
  /** nudge ids the classifier surfaces per verdict */
  brokenNudgeId?: string
  strainedNudgeId?: string
}

export interface MissionSpec {
  id: string
  clientSkin: string
  inheritsFrom?: string
  segments: SegmentSpec[]
}

export interface TrialSpec {
  id: TrialId
  title: string
  /** concept ids boosted on clean completion */
  exercisedConcepts: string[]
  missions: MissionSpec[]
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors from `src/features/trials/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/features/trials/types.ts
git commit -m "feat(trials): engine types for capability grading and specs"
```

### Task 2: Capability matrix + classify

**Files:**
- Create: `src/features/trials/capability.ts`
- Test: `src/features/trials/capability.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { classify, costAt } from "./capability"
import type { DesignState, SegmentSpec } from "./types"

const A1: SegmentSpec = {
  id: "a1",
  clientPrompt: "",
  offeredStructures: ["queue", "linked-list", "array"],
  operations: [
    { id: "arrival", label: "new arrival", allowedPositions: ["front", "back", "middle"] },
    { id: "serve", label: "serve next", allowedPositions: ["front", "back", "middle"] },
  ],
  required: [
    { op: "arrival", position: "back" },
    { op: "serve", position: "front" },
  ],
  grading: "capability",
  explanations: { viable: "v", strained: "s", broken: "b" },
  nudges: { n: "watch the ends" },
  strainedNudgeId: "n",
  brokenNudgeId: "n",
}

const design = (over: Partial<DesignState>): DesignState => ({
  structure: "queue",
  mapping: { arrival: "back", serve: "front" },
  ...over,
})

describe("costAt", () => {
  it("treats undeclared positions as impossible", () => {
    expect(costAt("queue", "middle")).toBe("impossible")
    expect(costAt("stack", "front")).toBe("impossible")
    expect(costAt("array", "front")).toBe("expensive")
    expect(costAt("linked-list", "middle")).toBe("cheap")
  })
})

describe("classify", () => {
  it("queue with correct ends is viable", () => {
    expect(classify(design({ structure: "queue" }), A1).status).toBe("viable")
  })
  it("array front-serve is strained", () => {
    expect(classify(design({ structure: "array" }), A1).status).toBe("strained")
  })
  it("stack cannot own a line: broken", () => {
    expect(classify(design({ structure: "stack" }), A1).status).toBe("broken")
  })
  it("misplaced op (serve at back) is broken", () => {
    const d = design({ structure: "queue", mapping: { arrival: "back", serve: "back" } })
    expect(classify(d, A1).status).toBe("broken")
  })
  it("unmapped required op is broken", () => {
    const d = design({ structure: "queue", mapping: { arrival: "back" } })
    expect(classify(d, A1).status).toBe("broken")
  })
  it("non-viable verdicts carry a nudgeId", () => {
    expect(classify(design({ structure: "array" }), A1).nudgeId).toBe("n")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/trials/capability.test.ts`
Expected: FAIL ("classify is not a function" / module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Cost, DesignState, Position, SegmentSpec, StructureKind, VerdictResult } from "./types"

export const CAPABILITY: Record<StructureKind, Partial<Record<Position, Cost>>> = {
  queue: { front: "cheap", back: "cheap", middle: "impossible" },
  stack: { top: "cheap", front: "impossible", back: "impossible" },
  array: { byIndex: "cheap", back: "cheap", middle: "expensive", front: "expensive" },
  "linked-list": { front: "cheap", back: "cheap", middle: "cheap", current: "cheap" },
}

export function costAt(structure: StructureKind, position: Position): Cost {
  return CAPABILITY[structure][position] ?? "impossible"
}

export function costWord(cost: Cost): string {
  return cost === "cheap" ? "small" : cost === "expensive" ? "large" : "can't do that here"
}

const RANK: Record<Cost | "misplaced", number> = {
  cheap: 0,
  expensive: 1,
  impossible: 2,
  misplaced: 2,
}

export function classify(design: DesignState, segment: SegmentSpec): VerdictResult {
  let worst: Cost | "misplaced" = "cheap"
  for (const { op, position } of segment.required) {
    const placed = design.mapping[op]
    const cost: Cost | "misplaced" =
      placed == null || placed !== position ? "misplaced" : costAt(design.structure, position)
    if (RANK[cost] > RANK[worst]) worst = cost
  }
  if (worst === "impossible" || worst === "misplaced") {
    return { status: "broken", explainId: "broken", nudgeId: segment.brokenNudgeId }
  }
  if (worst === "expensive") {
    return { status: "strained", explainId: "strained", nudgeId: segment.strainedNudgeId }
  }
  return { status: "viable", explainId: "viable" }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/trials/capability.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/trials/capability.ts src/features/trials/capability.test.ts
git commit -m "feat(trials): capability matrix + deterministic classify"
```

### Task 3: reinforceCheckpoint (mastery boost)

**Files:**
- Create: `src/features/trials/reinforceCheckpoint.ts`
- Test: `src/features/trials/reinforceCheckpoint.test.ts`

- [ ] **Step 0: Confirm exports** from `src/features/progress/conceptReview.ts`: the exact names for `MAX_LEVEL`, the gap function (e.g. `gapForLevel`), and `ConceptReview`. Use the real names below; adjust the import if they differ.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { reinforceCheckpoint } from "./reinforceCheckpoint"
import { MAX_LEVEL, type ConceptReview } from "@/features/progress/conceptReview"

const base = (over: Partial<ConceptReview> = {}): ConceptReview => ({
  conceptId: "arrays:deleteCount",
  level: 1,
  correctStreak: 1,
  lapses: 0,
  seen: 3,
  lastSeenAt: 1000,
  dueAt: 5000,
  graduated: false,
  ...over,
})

describe("reinforceCheckpoint", () => {
  it("clean pass promotes one rung and refreshes due date", () => {
    const r = reinforceCheckpoint(base({ level: 1 }), { at: 10_000, cleanPass: true })
    expect(r.level).toBe(2)
    expect(r.lastSeenAt).toBe(10_000)
    expect(r.dueAt).toBeGreaterThan(10_000)
  })
  it("clean pass never exceeds MAX_LEVEL and sets graduated", () => {
    const r = reinforceCheckpoint(base({ level: MAX_LEVEL }), { at: 10_000, cleanPass: true })
    expect(r.level).toBe(MAX_LEVEL)
    expect(r.graduated).toBe(true)
  })
  it("revised pass refreshes recency but does not promote", () => {
    const r = reinforceCheckpoint(base({ level: 1 }), { at: 10_000, cleanPass: false })
    expect(r.level).toBe(1)
    expect(r.lastSeenAt).toBe(10_000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/trials/reinforceCheckpoint.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation** (use the confirmed export names from Step 0)

```ts
import { MAX_LEVEL, gapForLevel, type ConceptReview } from "@/features/progress/conceptReview"

/**
 * The only path that promotes a concept on massed practice. Called once per
 * Trial completion, per exercised concept. Clean pass climbs one rung; a
 * revised pass only refreshes recency so the concept reads strong again.
 */
export function reinforceCheckpoint(
  r: ConceptReview,
  ev: { at: number; cleanPass: boolean },
): ConceptReview {
  const seen = r.seen + 1
  if (ev.cleanPass) {
    const level = Math.min(r.level + 1, MAX_LEVEL)
    return {
      ...r,
      level,
      seen,
      lastSeenAt: ev.at,
      dueAt: ev.at + gapForLevel(level),
      graduated: level >= MAX_LEVEL,
    }
  }
  return { ...r, seen, lastSeenAt: ev.at, dueAt: ev.at + gapForLevel(r.level) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/trials/reinforceCheckpoint.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/trials/reinforceCheckpoint.ts src/features/trials/reinforceCheckpoint.test.ts
git commit -m "feat(trials): reinforceCheckpoint clean-pass mastery boost"
```

### Task 4: Gating (soft chaining)

**Files:**
- Create: `src/features/trials/gating.ts`
- Test: `src/features/trials/gating.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { trialUnlocked } from "./gating"

const order = ["trial-1-linear", "trial-2-organization"]

describe("trialUnlocked", () => {
  it("locked until the capping unit is complete", () => {
    expect(trialUnlocked({ trialId: "trial-1-linear", order, completed: new Set(), unitComplete: false })).toBe(false)
  })
  it("first trial unlocks once its unit is complete", () => {
    expect(trialUnlocked({ trialId: "trial-1-linear", order, completed: new Set(), unitComplete: true })).toBe(true)
  })
  it("later trial stays locked until the prior trial is completed", () => {
    expect(trialUnlocked({ trialId: "trial-2-organization", order, completed: new Set(), unitComplete: true })).toBe(false)
    expect(
      trialUnlocked({ trialId: "trial-2-organization", order, completed: new Set(["trial-1-linear"]), unitComplete: true }),
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/trials/gating.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { TrialId } from "./types"

export interface TrialUnlockInput {
  trialId: TrialId
  order: TrialId[]
  completed: Set<TrialId>
  /** the capping curriculum unit for this trial is finished */
  unitComplete: boolean
}

export function trialUnlocked({ trialId, order, completed, unitComplete }: TrialUnlockInput): boolean {
  if (!unitComplete) return false
  const idx = order.indexOf(trialId)
  if (idx <= 0) return true
  return completed.has(order[idx - 1])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/trials/gating.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/trials/gating.ts src/features/trials/gating.test.ts
git commit -m "feat(trials): soft trial-to-trial chaining gate"
```

### Task 5: Event-script simulator + prediction grading (Mission A final review)

**Files:**
- Create: `src/features/trials/simulate.ts`
- Test: `src/features/trials/simulate.test.ts`

- [ ] **Step 1: Write the failing test** (canonical A4 script: 5 arrive, middle leaves, 2 served, last action undone, 1 arrives)

```ts
import { describe, expect, it } from "vitest"
import { gradePrediction, simulateLine, type LineOp } from "./simulate"

const script: LineOp[] = [
  { t: "arrive", id: "A" },
  { t: "arrive", id: "B" },
  { t: "arrive", id: "C" },
  { t: "arrive", id: "D" },
  { t: "arrive", id: "E" },
  { t: "leaveMiddle", id: "C" },
  { t: "serve" }, // serves A
  { t: "serve" }, // serves B
  { t: "undo" }, // reverses the second serve -> B returns to front
  { t: "arrive", id: "F" },
]

describe("simulateLine", () => {
  it("computes the final front and what undo reversed", () => {
    const r = simulateLine(script)
    expect(r.front).toBe("B")
    expect(r.lastUndoReversed).toBe("serve")
    expect(r.line).toEqual(["B", "D", "E", "F"])
  })
})

describe("gradePrediction", () => {
  it("passes when predicted front matches truth", () => {
    expect(gradePrediction(script, { front: "B" }).correct).toBe(true)
  })
  it("fails and reports truth when wrong", () => {
    const g = gradePrediction(script, { front: "D" })
    expect(g.correct).toBe(false)
    expect(g.truth.front).toBe("B")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/trials/simulate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation** (snapshot-based undo: each desk action stores the pre-action line; undo restores it)

```ts
export type LineOp =
  | { t: "arrive"; id: string }
  | { t: "serve" }
  | { t: "leaveMiddle"; id: string }
  | { t: "undo" }

export interface LineResult {
  front: string | null
  line: string[]
  lastUndoReversed: string | null
}

export function simulateLine(ops: LineOp[]): LineResult {
  let line: string[] = []
  const history: { action: string; before: string[] }[] = []
  let lastUndoReversed: string | null = null
  for (const op of ops) {
    if (op.t === "arrive") {
      history.push({ action: "arrive", before: [...line] })
      line = [...line, op.id]
    } else if (op.t === "serve") {
      history.push({ action: "serve", before: [...line] })
      line = line.slice(1)
    } else if (op.t === "leaveMiddle") {
      history.push({ action: "leaveMiddle", before: [...line] })
      line = line.filter((x) => x !== op.id)
    } else {
      const h = history.pop()
      if (h) {
        lastUndoReversed = h.action
        line = h.before
      }
    }
  }
  return { front: line[0] ?? null, line, lastUndoReversed }
}

export function gradePrediction(
  ops: LineOp[],
  prediction: { front: string | null },
): { correct: boolean; truth: LineResult } {
  const truth = simulateLine(ops)
  return { correct: prediction.front === truth.front, truth }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/trials/simulate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/trials/simulate.ts src/features/trials/simulate.test.ts
git commit -m "feat(trials): line simulator + prediction grading for final review"
```

### Task 6: Save-state shape + helpers

**Files:**
- Create: `src/features/trials/saveState.ts`
- Test: `src/features/trials/saveState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { emptySave, isComplete, type TrialSaveState } from "./saveState"

describe("trial save-state", () => {
  it("emptySave starts at the first segment, not complete", () => {
    const s = emptySave("trial-1-linear", "mission-a", "a1")
    expect(s.completed).toBe(false)
    expect(s.segmentId).toBe("a1")
    expect(s.unlockedSegments).toEqual(["a1"])
  })
  it("isComplete reflects the completed flag", () => {
    const s: TrialSaveState = { ...emptySave("t", "m", "s"), completed: true }
    expect(isComplete(s)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/trials/saveState.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Position, StructureKind, TrialId, Verdict } from "./types"

export interface RevisionRecord {
  segmentId: string
  at: number
  from: { structure: StructureKind; mapping: Record<string, Position> }
  to: { structure: StructureKind; mapping: Record<string, Position> }
}

export interface DesignArtifact {
  structure: StructureKind
  mapping: Record<string, Position>
  policy?: Record<string, string>
}

export interface TrialSaveState {
  trialId: TrialId
  missionId: string
  segmentId: string
  unlockedSegments: string[]
  chosenStructures: Record<string, StructureKind>
  operationMappings: Record<string, Position>
  policyChoices: Record<string, string>
  verdicts: Record<string, Verdict>
  revisionHistory: RevisionRecord[]
  nudgesShown: string[]
  stressTestsRun: string[]
  missionAArtifact?: DesignArtifact
  missionBArtifact?: DesignArtifact
  completed: boolean
  cleanPass: boolean
}

export function emptySave(trialId: TrialId, missionId: string, segmentId: string): TrialSaveState {
  return {
    trialId,
    missionId,
    segmentId,
    unlockedSegments: [segmentId],
    chosenStructures: {},
    operationMappings: {},
    policyChoices: {},
    verdicts: {},
    revisionHistory: [],
    nudgesShown: [],
    stressTestsRun: [],
    completed: false,
    cleanPass: true,
  }
}

export function isComplete(s: TrialSaveState): boolean {
  return s.completed
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/trials/saveState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/trials/saveState.ts src/features/trials/saveState.test.ts
git commit -m "feat(trials): durable TrialSaveState shape + helpers"
```

### Task 7: TrialModule reducer

**Files:**
- Create: `src/features/trials/trialModule.ts`
- Test: `src/features/trials/trialModule.test.ts`

**Responsibility:** Pure state machine for a run. State holds the active `TrialSpec`, mission/segment cursor, the working `DesignState` for the current segment, the latest `VerdictResult`, phase (`"design" | "verdict" | "advance" | "complete"`), `cleanPass`, and the durable fields from `TrialSaveState`. Actions:

```ts
export type TrialAction =
  | { type: "choose-structure"; structure: StructureKind }
  | { type: "place-op"; op: string; position: Position }
  | { type: "unplace-op"; op: string }
  | { type: "set-policy"; id: string; value: string }
  | { type: "run-stress" }        // classify (or gradePrediction) -> verdict, record run
  | { type: "revise" }            // back to design, push a RevisionRecord, mark run not clean if prior verdict was broken
  | { type: "advance" }           // only allowed when verdict is viable/strained; move to next segment or complete
```

- [ ] **Step 1: Write failing tests** covering: choosing a structure then placing both A1 ops and running stress yields `viable`; running with `stack` yields `broken` and `advance` is rejected while broken; a `broken -> revise -> fix -> viable` path sets `cleanPass = false`; advancing past the last segment of the only mission sets phase `complete`. (Use a 2-segment fixture spec built from the A1 shape plus a trivial second segment.)

- [ ] **Step 2: Run** `npm run test -- src/features/trials/trialModule.test.ts` -> FAIL.

- [ ] **Step 3: Implement** `createTrialRun(spec)`, `trialReducer(state, action)`, and the `TrialModule` object (`id`, `create`, `reducer`, `toProgress`, `resume`, `completed`) mirroring `LessonModule` in `src/features/lesson/lessonModule.ts`. `run-stress` calls `classify` for `grading === "capability"` segments. `advance` is a no-op unless the current verdict status is `viable` or `strained` (broken blocks). `revise` sets `cleanPass = false` when the verdict being revised was `broken`, and pushes a `RevisionRecord`. On final advance, set `completed = true` and freeze `cleanPass`.

- [ ] **Step 4: Run** tests -> PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/trials/trialModule.ts src/features/trials/trialModule.test.ts
git commit -m "feat(trials): TrialModule reducer (choose/place/stress/revise/advance)"
```

---

## PHASE 2: Persistence + navigation plumbing (additive)

### Task 8: ProgressRepository trial methods

**Files:**
- Modify: `src/features/progress/ProgressRepository.ts` (add to interface)
- Modify: `src/features/progress/firestoreProgressRepository.ts`
- Modify: `src/features/progress/inMemoryProgressRepository.ts`
- Test: `src/features/progress/inMemoryProgressRepository.test.ts` (extend or create)

- [ ] **Step 1: Failing test** against the in-memory repo: `saveTrialProgress(uid, trialId, slice)` then `getTrialProgress(uid, trialId)` round-trips; `listCompletedTrials(uid)` returns ids where `completed`.

- [ ] **Step 2: Run** -> FAIL.

- [ ] **Step 3: Implement.** Interface additions:

```ts
getTrialProgress(uid: string, trialId: string): Promise<TrialSaveState | null>
saveTrialProgress(uid: string, trialId: string, slice: TrialSaveState): Promise<void>
listCompletedTrials(uid: string): Promise<string[]>
```

Firestore impl stores at `users/{uid}/trialProgress/{trialId}` (follow the existing converter/path patterns in the file). In-memory impl uses a `Map`.

- [ ] **Step 4: Run** -> PASS. Also run `npx tsc -p tsconfig.app.json --noEmit` to confirm both impls satisfy the interface.

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/ProgressRepository.ts src/features/progress/firestoreProgressRepository.ts src/features/progress/inMemoryProgressRepository.ts src/features/progress/inMemoryProgressRepository.test.ts
git commit -m "feat(trials): trial progress persistence on ProgressRepository"
```

### Task 9: TrialRunProvider

**Files:**
- Create: `src/features/trials/TrialRunProvider.tsx`
- Test: `src/features/trials/TrialRunProvider.test.tsx`

**Responsibility:** Mirror `src/features/lesson/useLessonRun.tsx`: keep an in-memory run per trialId in a ref, expose `state`/`dispatch`, auto-save `toProgress(state)` to the repo on change (signed-in only, optimistic, fire-and-forget), reconcile once per `uid:trialId` (server wins -> `resume`), and on completion call `reinforceCheckpoint` for each `spec.exercisedConcepts` via the concept-review write path, then `saveTrialProgress`.

- [ ] **Step 1: Failing test** (React Testing Library): dispatching through a fixture run to completion triggers `saveTrialProgress` with `completed: true` and calls the injected concept-boost callback once per exercised concept. Use the in-memory repo + a fake boost spy.
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Implement**, injecting the repo and a `boostConcept(conceptId, cleanPass)` callback (so the test can spy and production wires it to `ConceptReviewProvider`).
- [ ] **Step 4: Run** -> PASS.
- [ ] **Step 5: Commit**

```bash
git add src/features/trials/TrialRunProvider.tsx src/features/trials/TrialRunProvider.test.tsx
git commit -m "feat(trials): TrialRunProvider with autosave, reconcile, completion boost"
```

### Task 10: Navigation screen + TrialHost route

**Files:**
- Modify: `src/lib/navigation.tsx` (add `{ name: "trial"; trialId: string }` to the `Screen` union)
- Modify: `src/App.tsx` (render `TrialHost` for the new screen in `renderScreen()`)
- Create: `src/trials/TrialHost.tsx`
- Create: `src/trials/registry.ts`

- [ ] **Step 1: Failing test** `src/trials/registry.test.ts`: `getTrial("trial-1-linear")` returns a spec with id and at least one mission; `trialOrder` lists trial ids.
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Implement** `registry.ts` (`TRIALS`, `getTrial`, `trialOrder`), add the screen to the union, and a minimal `TrialHost` that resolves `trialId -> spec` and renders `TrialPlayer` (placeholder text until Phase 3). Confirm `npx tsc` passes and `App.tsx` switch is exhaustive.
- [ ] **Step 4: Run** tests + tsc -> PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation.tsx src/App.tsx src/trials/TrialHost.tsx src/trials/registry.ts src/trials/registry.test.ts
git commit -m "feat(trials): trial navigation screen + host + registry"
```

---

## PHASE 3: Design Board loop (UI)

> UI tasks: build the component, verify with `npm run build` (typecheck) and a Playwright screenshot into `docs/reference/` (kebab-case names per the use-playwright rule), then commit. Reuse willow tokens/components; no new color systems. Each component reads/dispatches through `TrialRunProvider`; none grade (they call the engine).

### Task 11: TrialGate + TrialPlayer shell + TrialTopBar

**Files:** Create `src/trials/ui/TrialGate.tsx`, `src/trials/ui/TrialPlayer.tsx`, `src/trials/ui/TrialTopBar.tsx`.

**Responsibility:** `TrialGate` is the immersive entrance (dimmed backdrop, central Trial card, "This is not a lesson" copy, Begin button). `TrialPlayer` switches on engine phase: gate -> design -> verdict -> retrospective -> complete, rendering `ClientScene` over `DesignBoard` (stacked). `TrialTopBar` shows trial title, mission, and a quiet "saved" marker.

**Acceptance:** entering the trial route shows the gate; Begin reveals the stacked working surface; reduced-motion respected (`useReducedMotion`). Screenshot: `trial-gate.png`, `trial-working-surface.png`.

### Task 12: ClientScene (skin renderer)

**Files:** Create `src/trials/ui/ClientScene.tsx`.

**Responsibility:** Render the Mission A check-in-desk skin from engine state only, using `QueueTube`/`StructCell` (and `NodeGraph`/`ArrayStrip` when the chosen structure changes). Pure presentational; props are derived view state, never the verdict before commit.

**Acceptance:** scene reflects the current line; no verdict leak. Screenshot: `trial-client-scene-a1.png`.

### Task 13: DesignBoard (palette + tap-to-place + rule echo)

**Files:** Create `src/trials/ui/DesignBoard.tsx`, `StructurePalette.tsx`, `OperationChip.tsx`, `RuleEcho.tsx`.

**Responsibility:** `StructurePalette` lists `segment.offeredStructures` (dispatch `choose-structure`). Tap-to-place: tap a chip to arm it, tap a labeled zone on the structure figure to dispatch `place-op`. `RuleEcho` restates each placement as a sentence ("A new arrival joins the back of the line."). A Run button is enabled only when all `segment.required` ops are placed.

**Acceptance:** placing arrival->back and serve->front on a queue enables Run and shows two rule sentences. Screenshot: `trial-design-board-a1.png`.

### Task 14: StressTestPanel (run + replay + verdict)

**Files:** Create `src/trials/ui/StressTestPanel.tsx`.

**Responsibility:** On Run, dispatch `run-stress`; play the consequence with `FrameSequence`/figure animations; show the verdict (viable green / strained amber / broken red) with `segment.explanations[status]`. Broken shows Revise only; strained shows Continue + Revise; viable shows Continue. Verdict appears only after Run.

**Acceptance:** queue@A2 shows broken + Revise-only; array@A2 shows strained + both; list@A2 shows viable + Continue. Screenshots: `trial-verdict-broken.png`, `trial-verdict-strained.png`, `trial-verdict-viable.png`.

### Task 15: RevisionTimeline + NudgeDrawer

**Files:** Create `src/trials/ui/RevisionTimeline.tsx`, `NudgeDrawer.tsx`.

**Responsibility:** `RevisionTimeline` lists `revisionHistory` (non-punitive, just a record). `NudgeDrawer` surfaces `segment.nudges[verdict.nudgeId]` on a non-viable verdict, attention-only.

**Acceptance:** a broken->revise cycle adds a timeline entry and shows the authored nudge. Screenshot: `trial-revision-nudge.png`.

---

## PHASE 4: Mission A + completion

### Task 16: Mission A content

**Files:** Create `src/trials/trialOne/missionA.ts`, `src/trials/trialOne/retrospective.ts`, `src/trials/trialOne/index.ts`. Test: `src/trials/trialOne/missionA.test.ts`.

**Responsibility:** Author A1-A4 per spec section 7 as `SegmentSpec`s (A1-A3 `grading: "capability"`, A4 `grading: "prediction"` with the canonical `eventScript`). Assemble the `TrialSpec` with `exercisedConcepts` = the spec's tunable list. Retrospective copy from spec.

- [ ] Test: assert each segment's authored `required` produces the spec's expected verdict for each offered structure when run through `classify` (e.g. A2 queue->broken, array->strained, list->viable). This pins content to the grader.
- [ ] Commit: `feat(trials): Trial I Mission A content + verdict tests`.

### Task 17: Wire A1-A3 (capability segments)

**Responsibility:** Drive segments A1-A3 through the board loop with the right figures/animations (A1 enter/exit + ends; A2 rewire vs shift vs front-back shake; A3 stack push/pop undo tray). Confirm the engine verdicts match the authored expectations live.

**Acceptance:** play A1->A3 reaching viable on the intended structures; broken paths blocked. Screenshots refreshed.

### Task 18: Wire A4 (prediction final review)

**Responsibility:** Render the prediction UI; on submit call `gradePrediction(eventScript, prediction)`; replay with `FrameSequence` and pause at divergence when wrong.

**Acceptance:** correct front prediction passes; wrong prediction pauses replay at the divergence and reveals the truth. Screenshot: `trial-final-review-a4.png`.

### Task 19: Completion -> boost + gating + retrospective

**Files:** Modify `TrialRunProvider.tsx` wiring + `RetrospectivePanel.tsx`.

**Responsibility:** On Mission A completion (Milestone 1 treats Mission A completion as Trial-complete; revisit when Mission B lands), show the `RetrospectivePanel` (first choice, what broke, what changed, final capability), call `reinforceCheckpoint` per exercised concept with the run's `cleanPass`, persist `completed: true`, and unlock via `trialUnlocked`.

**Acceptance:** completing clean promotes the exercised concepts by one rung (assert via a provider test with the in-memory repo); a revised run does not promote. Screenshot: `trial-retrospective.png`.

### Task 20: Course-path node (additive) + e2e smoke

**Files:** Add a Trial node to the path without touching lesson unlock rules (render an extra node after the linear unit whose availability comes from `trialUnlocked`; do not modify `isLessonUnlocked`/`derivePathNodes` lesson logic). Add a Playwright e2e that opens the trial from the path and finishes Mission A.

**Acceptance:** the Trial node appears after linked-lists, opens the gate, and a full Mission A run completes in the e2e. Screenshot: `trial-node-on-path.png`. Commit.

---

## Milestone 2 (follow-up plan, not in this pass)

- **Mission B "The Playlist Machine":** current-pointer model, `simulatePlaylist` (doubly-linked + current + edit stack) and B5 prediction grading, design-memory inheritance from Mission A (`missionAArtifact` -> opening recap), segments B1-B5. Redefine Trial completion to require both missions.
- **Retrospective + Trial Gate polish pass.**
- **Trial II data skeleton:** extend `CAPABILITY`/`Position` for keyed lookup, ordered display, priority-top, neighbor-only reads; author Mission A/B specs as data to confirm the engine generalizes.

---

## Self-review

- **Spec coverage:** capability grader (T2) <- spec 5; boost (T3) <- spec 8; gating (T4) <- spec 9; prediction/final review (T5, T18) <- spec 5/7; save-state (T6, T8) <- spec 9; seam (T7) <- spec 10; navigation/persistence additive (T8-T10, T20) <- spec 10; board loop + tap-to-place + verdicts + revision/nudge (T11-T15) <- spec 4/11; Mission A content (T16-T18) <- spec 7; completion/boost/gating (T19-T20) <- spec 4/8/9. Mission B, retrospective polish, Trial II are explicitly Milestone 2 per spec section 2 build focus.
- **Placeholder scan:** engine tasks contain full code; UI tasks contain concrete responsibilities, props, and acceptance criteria with named screenshots (not "TBD").
- **Type consistency:** `DesignState`, `SegmentSpec`, `VerdictResult`, `TrialSaveState`, `LineOp`, `TrialAction` names are used identically across tasks; `classify`/`costAt`/`reinforceCheckpoint`/`trialUnlocked`/`simulateLine`/`gradePrediction` signatures match between definition and call sites.
