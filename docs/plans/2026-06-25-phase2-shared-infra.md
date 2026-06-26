# Phase 2 Chunk 2: Shared Infra (rubric, skill map, verifier) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-only shared infrastructure both AI features ride on: the concept rubric for Stacks & Queues, the skill-to-proposition map, and the no-giveaway verifier. All pure logic, fully unit-tested, with no OpenAI calls.

**Architecture:** Three small modules under `functions/src/poly/` (server-only, so the rubric answer key never ships to the browser): typed rubric data + lookups, a hand-authored map from each graded skill to the rubric proposition(s) a wrong answer implicates, and a pure word-scan verifier that flags AI output leaking a withheld proposition's answer tokens. Chunks 3 and 4 compose these; nothing here is a deployed Cloud Function yet, so `index.ts`, `firebase.json`, and the client are untouched.

**Tech Stack:** TypeScript (the `functions/` CommonJS package from chunk 1), Vitest. No network, no OpenAI, no Firebase runtime APIs.

---

## Context and prerequisites

- This is **chunk 2 of 5** from `docs/plans/specs/2026-06-25-phase2-ai-features-design.md`. Chunk 1 (the `functions/` workspace + `polyHealthCheck`) is merged into `main`.
- Work happens in the worktree on branch `feat/phase2-shared-infra`. Root and `functions/` deps are installed; baseline is green (functions 5 tests, root 715).
- **Server-only invariant:** everything in this chunk lives in `functions/src/` and must NEVER be imported from `src/` (the client bundle). The rubric is the answer key; it stays server-side. Chunks 3 and 4 (server-side callables) consume it; the client only ever receives derived output.
- **No deployed function is added here.** Do not modify `functions/src/index.ts`, `firebase.json`, or anything under `src/`.
- Follow chunk 1's established patterns: small focused modules, co-located `*.test.ts`, Vitest with injected/pure inputs.
- House rule: never use an em-dash (U+2014); never add narration-style comments.
- Commands run from the worktree root unless they `cd functions`.

### Reference: skill ids and concepts (from `src/features/lesson/stacksQueuesEngine.ts`)

- The graded construct skills are the string ids `"stackConstruct"` and `"queueConstruct"` (members of `SQ_SKILLS`).
- The lesson has two concepts: stacks (LIFO) and queues (FIFO). AI hints fire only on the construct beats (chunk 3); Poly checkpoints run once per concept (chunk 4).
- Do NOT import the client's `SQSkill` type into `functions/`. Use plain string keys here (functions is a separate package and the rubric must stay server-side). A test pins the exact id strings so they cannot silently drift.

---

### Task 1: Poly rubric types + Stacks & Queues rubrics

**Files:**
- Create: `functions/src/poly/types.ts`
- Create: `functions/src/poly/rubrics.ts`
- Test: `functions/src/poly/rubrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/rubrics.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { RUBRICS, rubricFor, propositionsByIds } from "./rubrics"

describe("rubrics", () => {
  it("exposes a stacks and a queues rubric by concept id", () => {
    expect(rubricFor("stacks")?.conceptId).toBe("stacks")
    expect(rubricFor("queues")?.conceptId).toBe("queues")
    expect(rubricFor("nope")).toBeUndefined()
  })

  it("every proposition in every rubric has at least one non-empty answer token", () => {
    for (const rubric of Object.values(RUBRICS)) {
      expect(rubric.propositions.length).toBeGreaterThanOrEqual(2)
      for (const p of rubric.propositions) {
        const usable = p.answerTokens.filter((t) => t.trim() !== "")
        expect(usable.length, `${rubric.conceptId}/${p.id} needs tokens`).toBeGreaterThan(0)
      }
    }
  })

  it("propositionsByIds returns only the requested propositions, in rubric order", () => {
    const stacks = rubricFor("stacks")!
    const picked = propositionsByIds(stacks, ["P3", "P1"])
    expect(picked.map((p) => p.id)).toEqual(["P1", "P3"])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/poly/rubrics.test.ts; cd ..
```

Expected: FAIL with a resolve/import error (`./rubrics` not found).

- [ ] **Step 3: Write the types**

Create `functions/src/poly/types.ts`:

```typescript
export interface Proposition {
  id: string
  text: string
  // Phrases that count as giving the proposition away if they appear in AI
  // output before the learner has demonstrated it. Case-insensitive substring
  // match (see verifier). Authored per proposition, including the abstract ones.
  answerTokens: string[]
}

export interface Rubric {
  conceptId: string
  propositions: Proposition[]
}

export interface SkillTarget {
  conceptId: string
  propositionIds: string[]
}

export interface GiveawayResult {
  ok: boolean
  leaked: string[]
}
```

- [ ] **Step 4: Write the rubrics and lookups**

Create `functions/src/poly/rubrics.ts`:

```typescript
import { Proposition, Rubric } from "./types"

const stacksRubric: Rubric = {
  conceptId: "stacks",
  propositions: [
    {
      id: "P1",
      text: "LIFO: the last item pushed is the first one removed",
      answerTokens: ["lifo", "last in first out", "last-in, first-out", "last in, first out"],
    },
    {
      id: "P2",
      text: "Only the top item is accessible",
      answerTokens: ["top"],
    },
    {
      id: "P3",
      text: "The order is a consequence of the top-only access rule, not a separate rule",
      answerTokens: ["consequence", "follows from", "because you can only", "comes from the rule"],
    },
  ],
}

const queuesRubric: Rubric = {
  conceptId: "queues",
  propositions: [
    {
      id: "P1",
      text: "FIFO: the first item added is the first one removed",
      answerTokens: ["fifo", "first in first out", "first-in, first-out", "first in, first out"],
    },
    {
      id: "P2",
      text: "You add at one end and remove from the other end",
      answerTokens: ["one end", "other end", "front", "back", "rear"],
    },
    {
      id: "P3",
      text: "The arrival order is preserved across the whole structure",
      answerTokens: ["preserved", "stays in order", "kept in order", "same order"],
    },
  ],
}

export const RUBRICS: Record<string, Rubric> = {
  stacks: stacksRubric,
  queues: queuesRubric,
}

export function rubricFor(conceptId: string): Rubric | undefined {
  return RUBRICS[conceptId]
}

export function propositionsByIds(rubric: Rubric, ids: string[]): Proposition[] {
  return rubric.propositions.filter((p) => ids.includes(p.id))
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/poly/rubrics.test.ts; cd ..
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add functions/src/poly/types.ts functions/src/poly/rubrics.ts functions/src/poly/rubrics.test.ts
git commit -m "feat: add server-only Poly rubric types and S&Q rubrics"
```

---

### Task 2: Skill-to-proposition map

**Files:**
- Create: `functions/src/poly/skillMap.ts`
- Test: `functions/src/poly/skillMap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/skillMap.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { skillTargets, targetsForSkill } from "./skillMap"
import { rubricFor } from "./rubrics"

describe("skillMap", () => {
  it("maps the construct skills to their concept and propositions", () => {
    expect(targetsForSkill("stackConstruct")).toEqual({
      conceptId: "stacks",
      propositionIds: ["P1", "P3"],
    })
    expect(targetsForSkill("queueConstruct")).toEqual({
      conceptId: "queues",
      propositionIds: ["P1", "P3"],
    })
    expect(targetsForSkill("unknownSkill")).toBeUndefined()
  })

  it("every mapped proposition id exists in the referenced rubric", () => {
    for (const target of Object.values(skillTargets)) {
      const rubric = rubricFor(target.conceptId)
      expect(rubric, `missing rubric ${target.conceptId}`).toBeDefined()
      const ids = rubric!.propositions.map((p) => p.id)
      for (const pid of target.propositionIds) {
        expect(ids, `${target.conceptId} missing ${pid}`).toContain(pid)
      }
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/poly/skillMap.test.ts; cd ..
```

Expected: FAIL with a resolve/import error (`./skillMap` not found).

- [ ] **Step 3: Write the implementation**

Create `functions/src/poly/skillMap.ts`:

```typescript
import { SkillTarget } from "./types"

// Maps a graded skill id (from the client's SQ_SKILLS, kept as plain strings so
// the rubric stays server-only) to the rubric concept and the proposition(s) a
// wrong answer on that skill implicates. AI hints fire only on the construct
// beats, so only those skills are mapped. A wrong build violates the ordering
// rule (P1) and its consequence/preservation (P3); top-only / two-ended access
// (P2) is not the primary build-order violation.
export const skillTargets: Record<string, SkillTarget> = {
  stackConstruct: { conceptId: "stacks", propositionIds: ["P1", "P3"] },
  queueConstruct: { conceptId: "queues", propositionIds: ["P1", "P3"] },
}

export function targetsForSkill(skill: string): SkillTarget | undefined {
  return skillTargets[skill]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/poly/skillMap.test.ts; cd ..
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/poly/skillMap.ts functions/src/poly/skillMap.test.ts
git commit -m "feat: add skill-to-proposition map for Poly hints"
```

---

### Task 3: No-giveaway verifier

**Files:**
- Create: `functions/src/poly/verifier.ts`
- Test: `functions/src/poly/verifier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/verifier.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { findGiveaway } from "./verifier"
import { rubricFor, propositionsByIds } from "./rubrics"
import { targetsForSkill } from "./skillMap"
import type { Proposition } from "./types"

const props: Proposition[] = [
  { id: "P1", text: "LIFO", answerTokens: ["lifo", "last in first out"] },
  { id: "P2", text: "top only", answerTokens: ["top"] },
  { id: "P3", text: "consequence", answerTokens: [""] },
]

describe("findGiveaway", () => {
  it("passes text that contains no withheld tokens", () => {
    expect(findGiveaway("Look again at the card you moved first.", props)).toEqual({
      ok: true,
      leaked: [],
    })
  })

  it("flags a withheld proposition when a token appears (case-insensitive)", () => {
    const res = findGiveaway("Remember it is LIFO here.", props)
    expect(res.ok).toBe(false)
    expect(res.leaked).toContain("P1")
  })

  it("matches multi-word tokens as substrings", () => {
    expect(findGiveaway("that is last in first out", props).leaked).toContain("P1")
  })

  it("never flags on empty tokens (P3 with a blank token is not a match)", () => {
    expect(findGiveaway("anything at all", [props[2]])).toEqual({ ok: true, leaked: [] })
  })

  it("reports every leaked proposition", () => {
    const res = findGiveaway("the top is LIFO", props)
    expect(res.ok).toBe(false)
    expect(res.leaked.sort()).toEqual(["P1", "P2"])
  })

  it("composes with the skill map and rubric (the chunk 3 path)", () => {
    const target = targetsForSkill("stackConstruct")!
    const rubric = rubricFor(target.conceptId)!
    const withheld = propositionsByIds(rubric, target.propositionIds)
    // A hint that blurts the LIFO answer must be rejected.
    expect(findGiveaway("just remember LIFO", withheld).ok).toBe(false)
    // A hint that only nudges at the action is fine.
    expect(findGiveaway("Check the order you placed the first two cards.", withheld).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/poly/verifier.test.ts; cd ..
```

Expected: FAIL with a resolve/import error (`./verifier` not found).

- [ ] **Step 3: Write the implementation**

Create `functions/src/poly/verifier.ts`:

```typescript
import { GiveawayResult, Proposition } from "./types"

// Pure no-giveaway check: case-insensitive substring scan of AI output against
// the answer tokens of the propositions the learner has NOT yet demonstrated.
// Blank tokens are ignored so an unauthored token can never match everything.
export function findGiveaway(text: string, withheld: Proposition[]): GiveawayResult {
  const hay = text.toLowerCase()
  const leaked = withheld
    .filter((p) =>
      p.answerTokens.some((t) => t.trim() !== "" && hay.includes(t.toLowerCase())),
    )
    .map((p) => p.id)
  return { ok: leaked.length === 0, leaked }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/poly/verifier.test.ts; cd ..
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/poly/verifier.ts functions/src/poly/verifier.test.ts
git commit -m "feat: add no-giveaway word-scan verifier"
```

---

### Task 4: Full verification

**Files:** none (gates only).

- [ ] **Step 1: Build functions and run all functions tests**

Run:

```bash
npm --prefix functions run build && npm --prefix functions test
```

Expected: build exits 0; Vitest reports 16 tests passed (5 from chunk 1 + 3 + 2 + 6 new).

- [ ] **Step 2: Confirm no client or root regressions**

Run:

```bash
npm test && npx tsc -b && npm run lint
```

Expected: root Vitest still 715 passed (this chunk adds no `src/` files); `tsc -b` exits 0; oxlint exits 0.

- [ ] **Step 3: Confirm the server-only invariant**

Run:

```bash
rg -n "poly/(types|rubrics|skillMap|verifier)" src || echo "OK: no client imports of poly infra"
```

Expected: prints `OK: no client imports of poly infra` (nothing under `src/` imports the server-only modules).

- [ ] **Step 4: Commit (only if Steps 1-3 produced any fixups; otherwise skip)**

If you had to fix anything to make a gate pass, commit it:

```bash
git add -A
git commit -m "chore: chunk 2 verification fixups"
```

---

## Out of scope (later chunks)

- The hint callable that composes skillMap + rubric + verifier + OpenAI (chunk 3).
- The Poly checkpoint scorer/prober that uses the rubrics (chunk 4).
- Voice (chunk 5).
- Wiring any of these into `index.ts` as deployed functions (chunks 3 and 4).
- Updating `docs/architecture.md` / `docs/lesson-design.md` for the determinism reconciliation (later chunk per the spec).

## Self-review checklist (run before requesting review)

- [ ] Everything new is under `functions/src/poly/`; nothing under `src/` imports it.
- [ ] Every proposition (including both P3s) has at least one non-empty answer token.
- [ ] `skillTargets` keys are exactly `"stackConstruct"` and `"queueConstruct"`; mapped proposition ids exist in the referenced rubric.
- [ ] `findGiveaway` is case-insensitive, substring-based, and ignores blank tokens.
- [ ] `npm --prefix functions test` (16), root `npm test` (715), `tsc -b`, and `npm run lint` all green.
