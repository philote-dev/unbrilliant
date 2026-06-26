# Phase 2 Chunk 4: Poly Checkpoints (self-explanation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "learn by explaining" checkpoints at the two concept boundaries of Stacks & Queues: the learner explains the concept in their own words, Poly scores it against the rubric (covered / partial / missing), probes the weakest gap up to a capped number of exchanges, then affirms and continues. The checkpoint never gates progress, and raw explanations are stored for signed-in learners.

**Architecture:** Two new callables, `polyScore` (rubric-based three-way scoring) and `polyProbe` (a verifier-guarded follow-up question), reuse chunk 2's server-only rubric + verifier and chunk 1's OpenAI seam. A `PolyCheckpoint` React component runs the bounded text loop and renders per-proposition status dots. It is inserted as a renderer-layer overlay inside the S&Q `Stage` at the two concept boundaries (after stacks, after queues), keyed on `partIndex`, so the pure engine is untouched and the checkpoint is non-gating. Raw explanations are written to `users/{uid}/checkpointExplanations` (signed-in only; anonymous play skips storage), guarded by Firestore rules.

**Tech Stack:** Firebase callables (`firebase-functions` v2), the `poly/` infra (chunks 1-2), React 19, Firestore (`addDoc` + rules), Vitest (node + jsdom + emulator projects).

---

## Context and prerequisites

- This is **chunk 4 of 5** from `docs/plans/specs/2026-06-25-phase2-ai-features-design.md`. Chunks 1-3 are merged into `main`.
- Work happens in the worktree on branch `feat/phase2-poly-checkpoints`. Root + `functions/` deps are installed; baseline is green.
- **Scope:** the text loop only. Voice is chunk 5. Do not change the hint code from chunk 3.
- **Engine is untouched.** No changes under `src/features/lesson/`. The checkpoint is a renderer overlay gated by `partIndex`; it dispatches no engine actions and never blocks (non-gating).
- **Safety invariants:** the OpenAI key stays server-side (chunk 1 secret). The client sends only `{conceptId, explanation}` / `{conceptId, propositionId, explanation}`; it never receives rubric internals (proposition text/tokens). The prober runs `findGiveaway` so it cannot reveal the missing proposition's tokens. Per-proposition status reaches the client as `{id, verdict}` only (ids + verdicts, no text), so the UI dots carry no rubric text.
- **Storage:** raw explanations are stored ONLY for signed-in users (`users/{uid}/checkpointExplanations`); anonymous play skips storage (no identity, and the rules require auth). Audience is a demo (no minors), per the spec decision.
- House rule: never use an em-dash (U+2014), including comments and commit messages. No narration comments. Tests mock OpenAI; no real network calls in unit/component tests.
- Commands run from the worktree root unless they `cd functions`.

### Reference (already in the repo)

- `functions/src/poly/{rubrics,verifier,types}.ts`: `rubricFor`, `propositionsByIds`, `findGiveaway`, `Proposition`.
- `functions/src/openai.ts` + `functions/src/openaiConfig.ts`: `Completer`, `openAICompleter`, `createClient`, `OPENAI_API_KEY`, `resolveModel`.
- `functions/src/poly/hint.ts`: the chunk 3 callable pattern (compose infra, onCall, return on failure).
- `src/lib/ai/polyClient.ts`: `httpsCallable` client pattern.
- `firestore.rules`: `isOwner(uid)`, the `users/{uid}` block, and the `isValidActivity()` shape-check pattern.
- `src/features/progress/firestoreProgressRepository.ts` + `.emulator.test.ts`: the Firestore write + rules-test patterns.
- `src/lessons/stacksQueues/Stage.tsx` `StacksQueuesStage` (routes by `currentPart`); `src/features/lesson/stacksQueuesEngine.ts` `SQ_PARTS` (stacks = 0-4, queues = 5-9, compare = 10).
- `src/lib/auth.tsx` `useAuth()` returns `{ user: { uid } | null }`; `src/lib/firebase.ts` exports `db`.

---

### Task 1: `polyScore` callable (TDD)

**Files:**
- Create: `functions/src/poly/score.ts`
- Test: `functions/src/poly/score.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/score.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { scoreExplanation } from "./score"
import type { Completer } from "../openai"

function completer(reply: string): Completer {
  return { complete: vi.fn().mockResolvedValue(reply) }
}

const base = { conceptId: "stacks", explanation: "last thing in is first out" }

describe("scoreExplanation", () => {
  it("parses a clean JSON verdict and surfaces the weakest", async () => {
    const c = completer(
      '{"scores":[{"id":"P1","verdict":"covered"},{"id":"P2","verdict":"missing"},{"id":"P3","verdict":"partial"}],"weakest":"P2"}',
    )
    const res = await scoreExplanation(c, "m", base)
    expect(res.scores).toEqual([
      { id: "P1", verdict: "covered" },
      { id: "P2", verdict: "missing" },
      { id: "P3", verdict: "partial" },
    ])
    expect(res.weakest).toBe("P2")
  })

  it("tolerates JSON wrapped in prose", async () => {
    const c = completer('Here you go: {"scores":[{"id":"P1","verdict":"covered"}],"weakest":null} thanks')
    const res = await scoreExplanation(c, "m", base)
    expect(res.scores[0]).toEqual({ id: "P1", verdict: "covered" })
  })

  it("falls back to all-covered (no probe) when the reply is not parseable", async () => {
    const c = completer("sorry I cannot do that")
    const res = await scoreExplanation(c, "m", base)
    expect(res.scores.every((s) => s.verdict === "covered")).toBe(true)
    expect(res.weakest).toBeNull()
  })

  it("derives the weakest (first missing) when the model omits or mis-states it", async () => {
    const c = completer(
      '{"scores":[{"id":"P1","verdict":"covered"},{"id":"P2","verdict":"missing"},{"id":"P3","verdict":"missing"}]}',
    )
    const res = await scoreExplanation(c, "m", base)
    expect(res.weakest).toBe("P2")
  })

  it("returns empty and no weakest for an unknown concept (no model call)", async () => {
    const c = completer("unused")
    const res = await scoreExplanation(c, "m", { conceptId: "nope", explanation: "x" })
    expect(res).toEqual({ scores: [], weakest: null })
    expect(c.complete).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/poly/score.test.ts; cd ..
```

Expected: FAIL (no `./score`).

- [ ] **Step 3: Write the implementation**

Create `functions/src/poly/score.ts`:

```typescript
import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "../openai"
import { OPENAI_API_KEY, resolveModel } from "../openaiConfig"
import { rubricFor } from "./rubrics"
import { Rubric } from "./types"

export type Verdict = "covered" | "partial" | "missing"
export interface PropScore {
  id: string
  verdict: Verdict
}
export interface ScoreResult {
  scores: PropScore[]
  weakest: string | null
}
export interface ScoreArgs {
  conceptId: string
  explanation: string
}

const VERDICTS: Verdict[] = ["covered", "partial", "missing"]

const SYSTEM =
  "You evaluate a learner's free-text explanation of a concept against a rubric of " +
  "propositions. For each proposition return covered, partial, or missing. A proposition " +
  "is covered if the learner conveys the idea in ANY wording, including analogies or " +
  "examples. Do not require exact terminology. Return ONLY JSON of the form " +
  '{"scores":[{"id":"P1","verdict":"covered"}],"weakest":"P2"}. Never include the rubric text.'

function buildUser(rubric: Rubric, explanation: string): string {
  const rubricText = rubric.propositions.map((p) => `${p.id}: ${p.text}`).join("\n")
  return `Concept: ${rubric.conceptId}\nRubric:\n${rubricText}\nLearner explanation: ${explanation}`
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("no json")
  return JSON.parse(raw.slice(start, end + 1))
}

function allCovered(rubric: Rubric): ScoreResult {
  return {
    scores: rubric.propositions.map((p) => ({ id: p.id, verdict: "covered" as Verdict })),
    weakest: null,
  }
}

function normalize(rubric: Rubric, parsed: unknown): ScoreResult {
  const obj = parsed as { scores?: unknown; weakest?: unknown }
  const byId = new Map<string, Verdict>()
  if (Array.isArray(obj.scores)) {
    for (const s of obj.scores as Array<{ id?: unknown; verdict?: unknown }>) {
      if (typeof s?.id === "string" && VERDICTS.includes(s.verdict as Verdict)) {
        byId.set(s.id, s.verdict as Verdict)
      }
    }
  }
  // One score per rubric proposition; an omitted/invalid one defaults to covered
  // (do not fabricate gaps for a non-gating side-quest).
  const scores: PropScore[] = rubric.propositions.map((p) => ({
    id: p.id,
    verdict: byId.get(p.id) ?? "covered",
  }))
  const claimed = typeof obj.weakest === "string" ? obj.weakest : null
  const claimedScore = scores.find((s) => s.id === claimed)
  const weakest =
    claimedScore && claimedScore.verdict !== "covered"
      ? claimed
      : (scores.find((s) => s.verdict === "missing")?.id ??
        scores.find((s) => s.verdict === "partial")?.id ??
        null)
  return { scores, weakest }
}

export async function scoreExplanation(
  completer: Completer,
  model: string,
  args: ScoreArgs,
): Promise<ScoreResult> {
  const rubric = rubricFor(args.conceptId)
  if (!rubric) return { scores: [], weakest: null }
  const raw = await completer.complete({
    system: SYSTEM,
    user: buildUser(rubric, args.explanation),
    model,
  })
  try {
    return normalize(rubric, extractJson(raw))
  } catch {
    return allCovered(rubric)
  }
}

export const polyScore = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<ScoreResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await scoreExplanation(completer, resolveModel(), request.data as ScoreArgs)
    } catch (err) {
      logger.error("polyScore failed", err)
      return { scores: [], weakest: null }
    }
  },
)
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/poly/score.test.ts; cd ..
```

Expected: PASS (5 tests).

- [ ] **Step 5: Export from the entrypoint**

Edit `functions/src/index.ts` to add:

```typescript
export { polyScore } from "./poly/score"
```

- [ ] **Step 6: Commit**

```bash
git add functions/src/poly/score.ts functions/src/poly/score.test.ts functions/src/index.ts
git commit -m "feat: add polyScore callable (three-way rubric scoring)"
```

---

### Task 2: `polyProbe` callable (TDD)

**Files:**
- Create: `functions/src/poly/probe.ts`
- Test: `functions/src/poly/probe.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/probe.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { probeQuestion } from "./probe"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

const base = { conceptId: "stacks", propositionId: "P1", explanation: "I push cards" }

describe("probeQuestion", () => {
  it("returns a clean probe question on the first try", async () => {
    const c = completer("What happens to the card you set down most recently?")
    const res = await probeQuestion(c, "m", base)
    expect(res.question).toBe("What happens to the card you set down most recently?")
    expect(c.complete).toHaveBeenCalledTimes(1)
  })

  it("regenerates once when the probe leaks the withheld proposition token", async () => {
    const c = completer("Is it LIFO here?", "Which card can you take off first?")
    const res = await probeQuestion(c, "m", base)
    expect(res.question).toBe("Which card can you take off first?")
    expect(c.complete).toHaveBeenCalledTimes(2)
  })

  it("returns null when even the retry leaks", async () => {
    const c = completer("It is LIFO.", "Still last in first out.")
    const res = await probeQuestion(c, "m", base)
    expect(res.question).toBeNull()
  })

  it("returns null for an unknown concept or proposition (no model call)", async () => {
    const c = completer("unused")
    expect((await probeQuestion(c, "m", { ...base, propositionId: "ZZ" })).question).toBeNull()
    expect(c.complete).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/poly/probe.test.ts; cd ..
```

Expected: FAIL (no `./probe`).

- [ ] **Step 3: Write the implementation**

Create `functions/src/poly/probe.ts`:

```typescript
import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "../openai"
import { OPENAI_API_KEY, resolveModel } from "../openaiConfig"
import { rubricFor, propositionsByIds } from "./rubrics"
import { findGiveaway } from "./verifier"
import { Proposition } from "./types"

export interface ProbeArgs {
  conceptId: string
  propositionId: string
  explanation: string
}

export interface ProbeResult {
  question: string | null
}

const BASE_SYSTEM =
  "You ask ONE short follow-up question to help a learner surface a missing idea. " +
  "You are given the proposition they have not yet conveyed. Ask a question that leads " +
  "them toward it. NEVER state the idea. NEVER include its key terms. One sentence."

const STRICTER =
  "Your previous question revealed too much. Ask a more indirect one: do not use the " +
  "idea's key terms. "

function buildUser(missing: Proposition, explanation: string): string {
  return (
    `Missing proposition: ${missing.text}\n` +
    `Their last explanation: ${explanation}\n` +
    "Write the question."
  )
}

export async function probeQuestion(
  completer: Completer,
  model: string,
  args: ProbeArgs,
): Promise<ProbeResult> {
  const rubric = rubricFor(args.conceptId)
  if (!rubric) return { question: null }
  const [missing] = propositionsByIds(rubric, [args.propositionId])
  if (!missing) return { question: null }
  const withheld = [missing]
  const user = buildUser(missing, args.explanation)

  const first = (await completer.complete({ system: BASE_SYSTEM, user, model })).trim()
  if (findGiveaway(first, withheld).ok) return { question: first || null }

  const second = (
    await completer.complete({ system: STRICTER + BASE_SYSTEM, user, model })
  ).trim()
  if (findGiveaway(second, withheld).ok) return { question: second || null }

  return { question: null }
}

export const polyProbe = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<ProbeResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await probeQuestion(completer, resolveModel(), request.data as ProbeArgs)
    } catch (err) {
      logger.error("polyProbe failed", err)
      return { question: null }
    }
  },
)
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/poly/probe.test.ts; cd ..
```

Expected: PASS (4 tests).

- [ ] **Step 5: Export, build, and run all functions tests**

Edit `functions/src/index.ts` to add:

```typescript
export { polyProbe } from "./poly/probe"
```

Run:

```bash
npm --prefix functions run build && npm --prefix functions test
```

Expected: build exits 0; 30 tests pass (21 from chunks 1-3 + 5 + 4 new).

- [ ] **Step 6: Commit**

```bash
git add functions/src/poly/probe.ts functions/src/poly/probe.test.ts functions/src/index.ts
git commit -m "feat: add polyProbe callable (verifier-guarded follow-up)"
```

---

### Task 3: Client helpers (TDD)

**Files:**
- Modify: `src/lib/ai/polyClient.ts`
- Test: `src/lib/ai/polyClient.test.ts` (extend)

- [ ] **Step 1: Write the failing tests (append a new describe block; reuse the file's `mockCallable` + mocks)**

Add to `src/lib/ai/polyClient.test.ts`:

```typescript
describe("checkpoint client helpers", () => {
  beforeEach(() => mockCallable.mockReset())

  it("scoreExplanation calls polyScore and returns its data", async () => {
    const { scoreExplanation } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({
      data: { scores: [{ id: "P1", verdict: "covered" }], weakest: null },
    })
    const res = await scoreExplanation({ conceptId: "stacks", explanation: "x" })
    expect(res.weakest).toBeNull()
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyScore")
  })

  it("requestProbe calls polyProbe and returns its data", async () => {
    const { requestProbe } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { question: "a probe?" } })
    const res = await requestProbe({ conceptId: "stacks", propositionId: "P1", explanation: "x" })
    expect(res.question).toBe("a probe?")
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyProbe")
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/polyClient.test.ts
```

Expected: FAIL (no `scoreExplanation` / `requestProbe` exports).

- [ ] **Step 3: Add the implementation to `src/lib/ai/polyClient.ts`**

Append:

```typescript
export type Verdict = "covered" | "partial" | "missing"
export interface PropScore {
  id: string
  verdict: Verdict
}
export interface ScoreRequest {
  conceptId: string
  explanation: string
}
export interface ScoreResponse {
  scores: PropScore[]
  weakest: string | null
}
export interface ProbeRequest {
  conceptId: string
  propositionId: string
  explanation: string
}
export interface ProbeResponse {
  question: string | null
}

export async function scoreExplanation(req: ScoreRequest): Promise<ScoreResponse> {
  const callable = httpsCallable<ScoreRequest, ScoreResponse>(functions, "polyScore")
  const res = await callable(req)
  return res.data
}

export async function requestProbe(req: ProbeRequest): Promise<ProbeResponse> {
  const callable = httpsCallable<ProbeRequest, ProbeResponse>(functions, "polyProbe")
  const res = await callable(req)
  return res.data
}
```

- [ ] **Step 4: Run to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/polyClient.test.ts
```

Expected: PASS (4 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/polyClient.ts src/lib/ai/polyClient.test.ts
git commit -m "feat: add scoreExplanation and requestProbe client helpers"
```

---

### Task 4: Raw-explanation storage (Firestore rules + writer + emulator test)

**Files:**
- Modify: `firestore.rules`
- Create: `src/features/poly/explanationStore.ts`
- Test: `src/features/poly/explanationStore.emulator.test.ts`

- [ ] **Step 1: Add the Firestore rule**

In `firestore.rules`, add a shape-check helper next to `isValidActivity()`:

```
    function isValidExplanation() {
      let d = request.resource.data;
      return d.keys().hasOnly(['conceptId', 'explanation', 'createdAt'])
        && d.conceptId is string
        && d.explanation is string && d.explanation.size() <= 5000
        && d.createdAt is timestamp;
    }
```

And add this subcollection inside the `match /users/{uid}` block (alongside `lessonProgress` and `activity`):

```
      match /checkpointExplanations/{id} {
        allow read: if isOwner(uid);
        allow create: if isOwner(uid) && isValidExplanation();
      }
```

- [ ] **Step 2: Write the failing emulator test**

Create `src/features/poly/explanationStore.emulator.test.ts`:

```typescript
import { readFileSync } from "node:fs"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { collection, doc, getDocs, setDoc, type Firestore } from "firebase/firestore"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { saveExplanation } from "@/features/poly/explanationStore"

const PROJECT_ID = "demo-willow"
let testEnv: RulesTestEnvironment

function dbFor(uid: string): Firestore {
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(process.env.RULES_PATH ?? "firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_PORT) || 8080,
    },
  })
})
afterAll(async () => {
  await testEnv.cleanup()
})
beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe("explanation storage (emulator)", () => {
  it("lets a learner store and read back their own explanation", async () => {
    const db = dbFor("alice")
    await assertSucceeds(
      saveExplanation(db, "alice", { conceptId: "stacks", explanation: "last in first out" }),
    )
    const snap = await getDocs(collection(db, "users", "alice", "checkpointExplanations"))
    expect(snap.size).toBe(1)
    expect(snap.docs[0].data().explanation).toBe("last in first out")
  })

  it("denies storing under another learner's id", async () => {
    const db = dbFor("mallory")
    await assertFails(
      saveExplanation(db, "alice", { conceptId: "stacks", explanation: "x" }),
    )
  })

  it("rejects an explanation write with an unexpected field", async () => {
    const db = dbFor("alice")
    await assertFails(
      setDoc(doc(db, "users", "alice", "checkpointExplanations", "x"), {
        conceptId: "stacks",
        explanation: "x",
        createdAt: new Date(),
        hacked: true,
      }),
    )
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run (runs the whole emulator suite; the new file is the only failure):

```bash
npm run test:emulator
```

Expected: FAIL on the new explanation-storage tests (no `./explanationStore` module yet); the existing emulator tests still pass.

- [ ] **Step 4: Write the writer**

Create `src/features/poly/explanationStore.ts`:

```typescript
import {
  addDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore"

export interface ExplanationRecord {
  conceptId: string
  explanation: string
}

/** Persist a raw checkpoint explanation under the signed-in learner. Callers must
 * only invoke this with a real uid (anonymous play skips storage). */
export async function saveExplanation(
  db: Firestore,
  uid: string,
  rec: ExplanationRecord,
): Promise<void> {
  await addDoc(collection(db, "users", uid, "checkpointExplanations"), {
    conceptId: rec.conceptId,
    explanation: rec.explanation,
    createdAt: serverTimestamp(),
  })
}
```

- [ ] **Step 5: Run to verify it passes**

Run:

```bash
npm run test:emulator
```

Expected: PASS (all emulator tests, including the 3 new explanation-storage tests).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules src/features/poly/explanationStore.ts src/features/poly/explanationStore.emulator.test.ts
git commit -m "feat: store raw checkpoint explanations for signed-in learners"
```

---

### Task 5: The `PolyCheckpoint` component (TDD)

**Files:**
- Create: `src/lessons/stacksQueues/PolyCheckpoint.tsx`
- Test: `src/lessons/stacksQueues/PolyCheckpoint.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lessons/stacksQueues/PolyCheckpoint.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PolyCheckpoint } from "./PolyCheckpoint"

function deps(over: Partial<Parameters<typeof PolyCheckpoint>[0]> = {}) {
  return {
    conceptId: "stacks",
    conceptName: "stacks",
    uid: null,
    onDone: vi.fn(),
    scoreExplanation: vi.fn().mockResolvedValue({
      scores: [{ id: "P1", verdict: "covered" }],
      weakest: null,
    }),
    requestProbe: vi.fn().mockResolvedValue({ question: "probe?" }),
    saveExplanation: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

describe("PolyCheckpoint", () => {
  it("affirms and continues when the explanation covers everything", async () => {
    const props = deps()
    render(<PolyCheckpoint {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "last in first out")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole("button", { name: /continue/i }))
    expect(props.onDone).toHaveBeenCalledTimes(1)
  })

  it("probes the weakest gap, then continues after the cap", async () => {
    const props = deps({
      maxExchanges: 2,
      scoreExplanation: vi.fn().mockResolvedValue({
        scores: [{ id: "P1", verdict: "missing" }],
        weakest: "P1",
      }),
    })
    render(<PolyCheckpoint {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "first answer")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(screen.getByText("probe?")).toBeInTheDocument())
    await userEvent.type(screen.getByRole("textbox"), "second answer")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    // Cap reached (2 exchanges): continue is offered regardless.
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument())
    expect(props.requestProbe).toHaveBeenCalledTimes(1)
  })

  it("stores the raw explanation when a uid is present", async () => {
    const props = deps({ uid: "alice" })
    render(<PolyCheckpoint {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "my explanation")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() =>
      expect(props.saveExplanation).toHaveBeenCalledWith("alice", {
        conceptId: "stacks",
        explanation: "my explanation",
      }),
    )
  })

  it("skips to continue when scoring fails", async () => {
    const props = deps({ scoreExplanation: vi.fn().mockRejectedValue(new Error("down")) })
    render(<PolyCheckpoint {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "x")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run:

```bash
npx vitest run src/lessons/stacksQueues/PolyCheckpoint.test.tsx
```

Expected: FAIL (no `./PolyCheckpoint`).

- [ ] **Step 3: Write the component**

Create `src/lessons/stacksQueues/PolyCheckpoint.tsx`:

```tsx
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  scoreExplanation as defaultScore,
  requestProbe as defaultProbe,
  type PropScore,
  type ScoreRequest,
  type ScoreResponse,
  type ProbeRequest,
  type ProbeResponse,
} from "@/lib/ai/polyClient"
import {
  saveExplanation as defaultSave,
  type ExplanationRecord,
} from "@/features/poly/explanationStore"
import { db } from "@/lib/firebase"

export interface PolyCheckpointProps {
  conceptId: string
  conceptName: string
  uid: string | null
  onDone: () => void
  maxExchanges?: number
  scoreExplanation?: (req: ScoreRequest) => Promise<ScoreResponse>
  requestProbe?: (req: ProbeRequest) => Promise<ProbeResponse>
  saveExplanation?: (uid: string, rec: ExplanationRecord) => Promise<void>
}

type Phase = "asking" | "thinking" | "done"

function dotClass(verdict: PropScore["verdict"]): string {
  if (verdict === "covered") return "bg-emerald-500"
  if (verdict === "partial") return "bg-amber-500"
  return "bg-muted-foreground/30"
}

export function PolyCheckpoint({
  conceptId,
  conceptName,
  uid,
  onDone,
  maxExchanges = 3,
  scoreExplanation = defaultScore,
  requestProbe = defaultProbe,
  saveExplanation = (u, rec) => defaultSave(db, u, rec),
}: PolyCheckpointProps) {
  const [phase, setPhase] = useState<Phase>("asking")
  const [question, setQuestion] = useState(
    `In your own words, explain ${conceptName}.`,
  )
  const [answer, setAnswer] = useState("")
  const [scores, setScores] = useState<PropScore[]>([])
  const [exchanges, setExchanges] = useState(0)

  async function submit() {
    const text = answer.trim()
    if (!text) return
    setPhase("thinking")
    if (uid) void saveExplanation(uid, { conceptId, explanation: text }).catch(() => {})
    try {
      const res = await scoreExplanation({ conceptId, explanation: text })
      setScores(res.scores)
      const n = exchanges + 1
      setExchanges(n)
      const allCovered =
        res.scores.length > 0 && res.scores.every((s) => s.verdict === "covered")
      if (allCovered || n >= maxExchanges || !res.weakest) {
        setPhase("done")
        return
      }
      const probe = await requestProbe({
        conceptId,
        propositionId: res.weakest,
        explanation: text,
      })
      if (!probe.question) {
        setPhase("done")
        return
      }
      setQuestion(probe.question)
      setAnswer("")
      setPhase("asking")
    } catch {
      setPhase("done")
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick check
        </p>
        <h2 className="mx-auto mt-2 max-w-sm text-xl font-bold text-foreground lg:text-2xl">
          {question}
        </h2>
      </div>

      {scores.length > 0 && (
        <div className="mt-4 flex justify-center gap-2" aria-label="coverage">
          {scores.map((s) => (
            <span key={s.id} className={cn("size-3 rounded-full", dotClass(s.verdict))} />
          ))}
        </div>
      )}

      <div className="mt-auto min-h-[132px]">
        {phase === "done" ? (
          <div className="animate-fade-in">
            <p className="mb-4 text-center text-sm text-muted-foreground lg:text-base">
              Thanks for explaining. Let us keep going.
            </p>
            <Button variant="tactile" size="lg" className="w-full" onClick={onDone}>
              Continue
            </Button>
          </div>
        ) : (
          <>
            <textarea
              className="mb-3 min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
              placeholder="Type your explanation..."
              value={answer}
              disabled={phase === "thinking"}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {phase === "thinking" && (
              <p className="mb-3 text-center text-sm text-muted-foreground">
                Poly is thinking...
              </p>
            )}
            <Button
              variant="tactile"
              size="lg"
              className="w-full"
              disabled={phase === "thinking" || answer.trim() === ""}
              onClick={submit}
            >
              Submit
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run:

```bash
npx vitest run src/lessons/stacksQueues/PolyCheckpoint.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lessons/stacksQueues/PolyCheckpoint.tsx src/lessons/stacksQueues/PolyCheckpoint.test.tsx
git commit -m "feat: add PolyCheckpoint self-explanation loop component"
```

---

### Task 6: Insert the checkpoint at the concept boundaries

**Files:**
- Modify: `src/lessons/stacksQueues/Stage.tsx`
- Test: `src/lessons/stacksQueues/Stage.checkpoint.test.tsx`

- [ ] **Step 1: Write the failing insertion test**

Create `src/lessons/stacksQueues/Stage.checkpoint.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StacksQueuesStage } from "./Stage"
import { createStacksQueues, type SQState } from "@/features/lesson/stacksQueuesEngine"

// The checkpoint pulls the signed-in user and the client; stub them so this test
// stays a pure renderer check (no Firebase, no network).
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }))
vi.mock("@/lib/ai/polyClient", () => ({
  scoreExplanation: vi.fn().mockResolvedValue({ scores: [{ id: "P1", verdict: "covered" }], weakest: null }),
  requestProbe: vi.fn().mockResolvedValue({ question: null }),
}))
vi.mock("@/features/poly/explanationStore", () => ({ saveExplanation: vi.fn() }))

// A state sitting on the first queues beat (index 5) = just past the stacks section.
function atQueuesStart(): SQState {
  const s = createStacksQueues(1)
  return { ...s, partIndex: 5, question: null, construct: null }
}

describe("S&Q checkpoint insertion", () => {
  it("shows the stacks checkpoint when entering the queues section, then the beat after Continue", async () => {
    render(<StacksQueuesStage state={atQueuesStart()} dispatch={vi.fn()} />)
    expect(screen.getByText(/Quick check/i)).toBeInTheDocument()
    await userEvent.type(screen.getByRole("textbox"), "last in first out")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await userEvent.click(await screen.findByRole("button", { name: /continue/i }))
    // After the checkpoint is dismissed, the normal queue beat renders.
    await waitFor(() => expect(screen.queryByText(/Quick check/i)).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run:

```bash
npx vitest run src/lessons/stacksQueues/Stage.checkpoint.test.tsx
```

Expected: FAIL (no checkpoint rendered; "Quick check" absent).

- [ ] **Step 3: Wire the overlay into `StacksQueuesStage`**

In `src/lessons/stacksQueues/Stage.tsx`, add imports:

```typescript
import { useAuth } from "@/lib/auth"
import { PolyCheckpoint } from "./PolyCheckpoint"
```

(Add `useState` to the existing `react` import if not already present.)

Add this config above the component:

```typescript
// Renderer-layer checkpoints at the concept boundaries. `afterIndex` is the last
// beat of a section; the checkpoint is due once partIndex has moved past it. This
// is non-gating and keeps the pure engine unaware of checkpoints.
const CHECKPOINTS: { id: string; afterIndex: number; conceptId: string; conceptName: string }[] = [
  { id: "cp-stacks", afterIndex: 4, conceptId: "stacks", conceptName: "stacks" },
  { id: "cp-queues", afterIndex: 9, conceptId: "queues", conceptName: "queues" },
]
```

Replace the top of `StacksQueuesStage` (the part routing) so the checkpoint takes precedence:

```typescript
export function StacksQueuesStage({
  state,
  dispatch,
}: {
  state: SQState
  dispatch: Dispatch<LessonAction>
}) {
  const { user } = useAuth()
  const [doneCheckpoints, setDoneCheckpoints] = useState<string[]>([])

  const due = CHECKPOINTS.find(
    (c) => state.partIndex > c.afterIndex && !doneCheckpoints.includes(c.id),
  )
  if (due) {
    return (
      <PolyCheckpoint
        conceptId={due.conceptId}
        conceptName={due.conceptName}
        uid={user?.uid ?? null}
        onDone={() => setDoneCheckpoints((prev) => [...prev, due.id])}
      />
    )
  }

  const part = currentPart(state)
  if (part === "stack-demo") return <DemoPart discipline="stack" dispatch={dispatch} />
  // ... rest of the existing routing unchanged ...
```

Keep the remainder of the routing exactly as it is.

- [ ] **Step 4: Run to verify it passes**

Run:

```bash
npx vitest run src/lessons/stacksQueues/Stage.checkpoint.test.tsx
```

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lessons/stacksQueues/Stage.tsx src/lessons/stacksQueues/Stage.checkpoint.test.tsx
git commit -m "feat: insert Poly checkpoints at the S&Q concept boundaries"
```

---

### Task 7: Full verification

**Files:** none (gates only).

- [ ] **Step 1: All automated gates**

Run:

```bash
npm --prefix functions run build && npm --prefix functions test && npm test && npx tsc -b && npm run lint
```

Expected: functions build exits 0; functions tests 30 passed; root tests pass with 0 failures (report total); `tsc -b` exits 0; oxlint exits 0.

- [ ] **Step 2: Emulator (rules) tests**

Run:

```bash
npm run test:emulator
```

Expected: all emulator tests pass, including the 3 new explanation-storage tests.

- [ ] **Step 3: Confirm the safety invariants**

Run:

```bash
rg -n "answerTokens|\.text" src/lessons/stacksQueues/PolyCheckpoint.tsx || echo "OK: checkpoint UI carries no rubric text"
rg -n "poly/(rubrics|verifier|skillMap)" src || echo "OK: client never imports server-only poly infra"
```

Expected: both print their OK line.

- [ ] **Step 4: Report DONE** with the gate output. The real-OpenAI checkpoint round-trip and the in-app check are a separate manual step (needs a real key) handled by the controller; do NOT push or open a PR.

---

## Manual verification (controller + user, needs a real key; not for the implementer)

```bash
cd "<this worktree>"
printf 'OPENAI_API_KEY="sk-...your key..."\n' > functions/.secret.local
npm --prefix functions run build
npx -y firebase-tools@latest emulators:exec --only functions --project demo-willow \
  'sleep 3 && curl -s -X POST http://127.0.0.1:5001/demo-willow/us-central1/polyScore -H "Content-Type: application/json" -d "{\"data\":{\"conceptId\":\"stacks\",\"explanation\":\"the last card I put on is the first one I take off\"}}"; echo'
```

Expected: `{"result":{"scores":[...],"weakest":...}}` with sensible verdicts (a clear LIFO explanation should score P1 covered). Optionally `npm run dev`, finish the stacks section, and confirm the checkpoint appears, scores, probes a gap, and never blocks.

---

## Out of scope (later chunk)

- Voice (chunk 5): TTS out + STT in on the checkpoint loop.
- Persisting "which checkpoints were shown" across reloads (session-only for now; a mid-lesson reload may re-show a checkpoint).
- App Check / server throttle on the callables (deferred hardening, noted in the spec).
- Updating `docs/architecture.md` / `docs/lesson-design.md` for the determinism reconciliation.

## Self-review checklist (run before requesting review)

- [ ] The engine is untouched (no change under `src/features/lesson/`); the checkpoint dispatches no engine actions and never blocks.
- [ ] The client sends only `{conceptId, explanation}` / `{conceptId, propositionId, explanation}`; it imports no server-only rubric infra; the UI dots carry verdicts only, no rubric text.
- [ ] The prober is verifier-guarded (regenerate once, then null); the scorer degrades to all-covered on a parse failure.
- [ ] Storage writes only when a uid is present; the Firestore rule shape-checks the explanation and is owner-scoped; the emulator tests cover allow + deny + malformed.
- [ ] `npm --prefix functions test` (30), root `npm test`, `npm run test:emulator`, `tsc -b`, and `npm run lint` all green.
