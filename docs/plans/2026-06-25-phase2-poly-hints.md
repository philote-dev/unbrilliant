# Phase 2 Chunk 3: Poly Hints (construct beats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate AI hints for the hard, multi-step construct beats in Stacks & Queues: when a learner submits a wrong build, Poly produces a one-line nudge grounded in the violated concept, verified to not give the answer away, with automatic fallback to the static hint.

**Architecture:** A new `polyHint` callable composes chunk 2's server-only rubric + skill map + verifier with chunk 1's OpenAI seam: it resolves the violated propositions from the skill, prompts the model, runs the no-giveaway verifier, regenerates once on a leak, and returns the hint or null (the fallback signal). The client gets a thin `requestHint` helper and a `usePolyHint` hook that fires on a wrong construct build (capturing the submitted order in the React layer so the pure engine is untouched), caps at 2 hints per problem, and feeds an optional AI-hint slot on the shared `FeedbackFooter`. Safety: the callable never receives the correct order, so the model cannot reveal it.

**Tech Stack:** Firebase callable (`firebase-functions` v2), OpenAI seam + `poly/` infra from chunks 1-2, React 19 hook + Vitest (node + jsdom projects).

---

## Context and prerequisites

- This is **chunk 3 of 5** from `docs/plans/specs/2026-06-25-phase2-ai-features-design.md`. Chunks 1 (functions seam, `polyHealthCheck`, OpenAI `Completer`) and 2 (`functions/src/poly/` rubric, skillMap, verifier) are merged into `main`.
- Work happens in the worktree on branch `feat/phase2-poly-hints`. Root + `functions/` deps are installed; baseline is green (functions 16, root 716).
- **Scope:** AI hints fire ONLY on the two construct beats (`stackConstruct`, `queueConstruct`). All other beats keep their static hints. No Poly checkpoint work (chunk 4), no voice (chunk 5).
- **Engine is untouched.** Do not modify `src/features/lesson/stacksQueuesEngine.ts` or any engine. The learner's submitted order is captured in the React layer.
- **Safety invariants:** the OpenAI key stays server-side (chunk 1 secret); the client sends NO rubric/proposition data and NO correct order; the callable resolves the withheld propositions server-side and runs the verifier before returning; never return an unverified giveaway (return `{ hint: null }` instead).
- **Fallback:** any failure, an unverified giveaway after one retry, or exceeding the 2-hint cap results in `{ hint: null }` / no AI text, and the UI shows the existing static hint.
- House rule: never use an em-dash (U+2014), including comments and commit messages. No narration comments.
- Tests must mock OpenAI; no real network calls in the suite.
- Commands run from the worktree root unless they `cd functions`.

### Reference (already in the repo)

- `functions/src/openai.ts`: `Completer`, `createClient`, `openAICompleter`.
- `functions/src/healthCheck.ts`: the `onCall` + secret pattern (`OPENAI_API_KEY`, model from `process.env.OPENAI_MODEL`).
- `functions/src/poly/{types,rubrics,skillMap,verifier}.ts`: `Proposition`, `rubricFor`, `propositionsByIds`, `targetsForSkill`, `findGiveaway`.
- `src/lib/ai/polyClient.ts`: the `httpsCallable` client pattern.
- `src/components/willow/FeedbackFooter.tsx`: the shared verdict footer (renders `copy.nudge` on `nudge`, a fail line on `fail`).
- `src/lessons/stacksQueues/Stage.tsx` `ConstructPart` (around line 619): construct UI; renders `FeedbackFooter` at the bottom; `q.skill` is `stackConstruct`/`queueConstruct`; `q.discipline` is `stack`/`queue`; `state.attempts` increments on each check; `work.pushed` holds the push order (reset to `loose` on a wrong check).

---

### Task 1: Shared OpenAI config (DRY the secret + model)

So `polyHint` and `polyHealthCheck` share one secret definition and one model resolver.

**Files:**
- Create: `functions/src/openaiConfig.ts`
- Modify: `functions/src/healthCheck.ts`

- [ ] **Step 1: Create the shared config**

Create `functions/src/openaiConfig.ts`:

```typescript
import { defineSecret } from "firebase-functions/params"

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY")

// Overridable per environment via process.env (functions/.env, .env.local, or
// deploy env vars). Read as a plain env var to avoid the interactive param
// prompt the emulator shows for defineString.
export const DEFAULT_MODEL = "gpt-4o-mini"

export function resolveModel(): string {
  return process.env.OPENAI_MODEL ?? DEFAULT_MODEL
}
```

- [ ] **Step 2: Refactor `healthCheck.ts` to use it**

In `functions/src/healthCheck.ts`, remove the local `defineSecret`/`DEFAULT_MODEL` and the inline model read, and import from the shared config. The file becomes:

```typescript
import { logger } from "firebase-functions"
import { onCall, HttpsError } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "./openai"
import { OPENAI_API_KEY, resolveModel } from "./openaiConfig"

const HEALTH_SYSTEM = "You are a health check. Reply with exactly the single word: pong"
const HEALTH_USER = "ping"

export interface HealthResult {
  ok: boolean
  model: string
  reply: string
  uid: string | null
}

export async function runHealthCheck(
  completer: Completer,
  model: string,
  uid: string | null,
): Promise<HealthResult> {
  const reply = await completer.complete({
    system: HEALTH_SYSTEM,
    user: HEALTH_USER,
    model,
  })
  return { ok: true, model, reply: reply.trim(), uid }
}

export const polyHealthCheck = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<HealthResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await runHealthCheck(completer, resolveModel(), request.auth?.uid ?? null)
    } catch (err) {
      logger.error("polyHealthCheck failed", err)
      throw new HttpsError("internal", "OpenAI health check failed")
    }
  },
)
```

- [ ] **Step 3: Verify the refactor builds and existing tests pass**

Run:

```bash
npm --prefix functions run build && npm --prefix functions test
```

Expected: build exits 0; 16 tests still pass (`healthCheck.test.ts` tests `runHealthCheck`, which is unchanged).

- [ ] **Step 4: Commit**

```bash
git add functions/src/openaiConfig.ts functions/src/healthCheck.ts
git commit -m "refactor: share OpenAI secret and model resolver across functions"
```

---

### Task 2: `polyHint` callable (TDD)

**Files:**
- Create: `functions/src/poly/hint.ts`
- Test: `functions/src/poly/hint.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/hint.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { generateHint } from "./hint"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

const base = {
  stageId: "stacks-and-queues",
  skill: "stackConstruct",
  discipline: "stack" as const,
  learnerOrder: ["A", "B", "C"],
}

describe("generateHint", () => {
  it("returns a clean hint on the first try (one model call)", async () => {
    const c = completer("Think about which card you can actually reach first.")
    const res = await generateHint(c, "m", base)
    expect(res.hint).toBe("Think about which card you can actually reach first.")
    expect(c.complete).toHaveBeenCalledTimes(1)
  })

  it("regenerates once when the first hint leaks a withheld concept token", async () => {
    // "LIFO" is a withheld P1 token for stackConstruct -> first is rejected.
    const c = completer("Remember it is LIFO.", "Look at the card you placed first.")
    const res = await generateHint(c, "m", base)
    expect(res.hint).toBe("Look at the card you placed first.")
    expect(c.complete).toHaveBeenCalledTimes(2)
  })

  it("returns null when even the retry leaks (never render a giveaway)", async () => {
    const c = completer("It is LIFO.", "Still last in first out.")
    const res = await generateHint(c, "m", base)
    expect(res.hint).toBeNull()
    expect(c.complete).toHaveBeenCalledTimes(2)
  })

  it("returns null without calling the model for an unmapped skill", async () => {
    const c = completer("unused")
    const res = await generateHint(c, "m", { ...base, skill: "stackPredict" })
    expect(res.hint).toBeNull()
    expect(c.complete).not.toHaveBeenCalled()
  })

  it("passes the prior hint into the prompt to force a different angle", async () => {
    const c = completer("A fresh angle.")
    await generateHint(c, "m", { ...base, priorHint: "earlier hint" })
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.user).toContain("earlier hint")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/poly/hint.test.ts; cd ..
```

Expected: FAIL with a resolve/import error (`./hint` not found).

- [ ] **Step 3: Write the implementation**

Create `functions/src/poly/hint.ts`:

```typescript
import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "../openai"
import { OPENAI_API_KEY, resolveModel } from "../openaiConfig"
import { targetsForSkill } from "./skillMap"
import { rubricFor, propositionsByIds } from "./rubrics"
import { findGiveaway } from "./verifier"
import { Proposition } from "./types"

export interface HintArgs {
  stageId: string
  skill: string
  discipline: "stack" | "queue"
  learnerOrder: string[]
  priorHint?: string
}

export interface HintResult {
  hint: string | null
}

const BASE_SYSTEM =
  "You write one short tutoring hint (at most two sentences) for a data-structures lesson. " +
  "You are given the structure type, the order the learner built, and the concept they violated. " +
  "Point them at their specific mistake. NEVER state the correct order or which item goes where. " +
  "NEVER name the concept or use its key terms. No analogies unless asked."

const STRICTER =
  "Your previous attempt revealed too much. Be more indirect: do not name the concept, " +
  "do not use its key terms, and do not state any ordering. "

function buildUser(args: HintArgs, withheld: Proposition[]): string {
  const concepts = withheld.map((p) => p.text).join("; ")
  const prior = args.priorHint
    ? `\nYour previous hint was: "${args.priorHint}". Take a different angle.`
    : ""
  return (
    `Structure: ${args.discipline}\n` +
    `Learner built (in push order): ${args.learnerOrder.join(", ")}\n` +
    `Concept(s) they violated: ${concepts}\n` +
    `Write the hint.${prior}`
  )
}

export async function generateHint(
  completer: Completer,
  model: string,
  args: HintArgs,
): Promise<HintResult> {
  const target = targetsForSkill(args.skill)
  if (!target) return { hint: null }
  const rubric = rubricFor(target.conceptId)
  if (!rubric) return { hint: null }
  const withheld = propositionsByIds(rubric, target.propositionIds)
  const user = buildUser(args, withheld)

  const first = (await completer.complete({ system: BASE_SYSTEM, user, model })).trim()
  if (findGiveaway(first, withheld).ok) return { hint: first || null }

  const second = (
    await completer.complete({ system: STRICTER + BASE_SYSTEM, user, model })
  ).trim()
  if (findGiveaway(second, withheld).ok) return { hint: second || null }

  return { hint: null }
}

export const polyHint = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<HintResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await generateHint(completer, resolveModel(), request.data as HintArgs)
    } catch (err) {
      logger.error("polyHint failed", err)
      return { hint: null }
    }
  },
)
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/poly/hint.test.ts; cd ..
```

Expected: PASS (5 tests).

- [ ] **Step 5: Export the callable**

Edit `functions/src/index.ts` to:

```typescript
export { polyHealthCheck } from "./healthCheck"
export { polyHint } from "./poly/hint"
```

- [ ] **Step 6: Build and run all functions tests**

Run:

```bash
npm --prefix functions run build && npm --prefix functions test
```

Expected: build exits 0; 21 tests pass (16 + 5 new).

- [ ] **Step 7: Commit**

```bash
git add functions/src/poly/hint.ts functions/src/poly/hint.test.ts functions/src/index.ts
git commit -m "feat: add polyHint callable composing rubric, verifier, and OpenAI"
```

---

### Task 3: Client `requestHint` helper (TDD)

**Files:**
- Modify: `src/lib/ai/polyClient.ts`
- Test: `src/lib/ai/polyClient.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append to the existing describe blocks)**

Add to `src/lib/ai/polyClient.test.ts` (keep the existing `polyHealthCheck` test; reuse the existing `mockCallable`/mocks at the top of the file):

```typescript
describe("requestHint client", () => {
  beforeEach(() => mockCallable.mockReset())

  it("calls the polyHint callable and returns its data", async () => {
    const { requestHint } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { hint: "a nudge" } })

    const res = await requestHint({
      stageId: "stacks-and-queues",
      skill: "stackConstruct",
      discipline: "stack",
      learnerOrder: ["A", "B", "C"],
    })

    expect(res).toEqual({ hint: "a nudge" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyHint")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/polyClient.test.ts
```

Expected: FAIL (no `requestHint` export).

- [ ] **Step 3: Add the implementation to `src/lib/ai/polyClient.ts`**

Append (keep the existing imports and `polyHealthCheck`):

```typescript
export interface HintRequest {
  stageId: string
  skill: string
  discipline: "stack" | "queue"
  learnerOrder: string[]
  priorHint?: string
}

export interface HintResponse {
  hint: string | null
}

export async function requestHint(req: HintRequest): Promise<HintResponse> {
  const callable = httpsCallable<HintRequest, HintResponse>(functions, "polyHint")
  const res = await callable(req)
  return res.data
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/polyClient.test.ts
```

Expected: PASS (2 tests: the existing health check + the new hint).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/polyClient.ts src/lib/ai/polyClient.test.ts
git commit -m "feat: add requestHint client helper for the polyHint callable"
```

---

### Task 4: `usePolyHint` hook (TDD)

The hook owns the per-problem cap, the fetch-once-per-wrong-attempt logic, the prior-hint angle, and the loading/text state. The fetcher is injectable for tests.

**Files:**
- Create: `src/lib/ai/usePolyHint.ts`
- Test: `src/lib/ai/usePolyHint.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/usePolyHint.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { usePolyHint } from "./usePolyHint"
import type { HintRequest, HintResponse } from "./polyClient"

const baseProps = {
  stageId: "stacks-and-queues",
  skill: "stackConstruct",
  discipline: "stack" as const,
}

describe("usePolyHint", () => {
  it("does nothing while there is no wrong attempt", () => {
    const requestHint = vi.fn()
    const { result } = renderHook(() =>
      usePolyHint({ ...baseProps, wrongAttempt: null, requestHint }),
    )
    expect(result.current).toEqual({ loading: false, text: null })
    expect(requestHint).not.toHaveBeenCalled()
  })

  it("fetches once for a wrong attempt and exposes the hint", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValue({ hint: "a nudge" })
    const { result, rerender } = renderHook((props) => usePolyHint(props), {
      initialProps: {
        ...baseProps,
        wrongAttempt: { id: 1, learnerOrder: ["A", "B", "C"] },
        requestHint,
      },
    })
    await waitFor(() => expect(result.current.text).toBe("a nudge"))
    expect(requestHint).toHaveBeenCalledTimes(1)
    // A re-render with the SAME attempt id must not refetch.
    rerender({
      ...baseProps,
      wrongAttempt: { id: 1, learnerOrder: ["A", "B", "C"] },
      requestHint,
    })
    expect(requestHint).toHaveBeenCalledTimes(1)
  })

  it("falls back (text null) after the 2-hint cap, passing the prior hint between calls", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValueOnce({ hint: "hint 1" })
      .mockResolvedValueOnce({ hint: "hint 2" })
    const { result, rerender } = renderHook((props) => usePolyHint(props), {
      initialProps: {
        ...baseProps,
        wrongAttempt: { id: 1, learnerOrder: ["A"] },
        requestHint,
      },
    })
    await waitFor(() => expect(result.current.text).toBe("hint 1"))

    rerender({ ...baseProps, wrongAttempt: { id: 2, learnerOrder: ["A"] }, requestHint })
    await waitFor(() => expect(result.current.text).toBe("hint 2"))
    expect(requestHint.mock.calls[1][0].priorHint).toBe("hint 1")

    // Third wrong attempt is over the cap -> no fetch, fall back to static.
    rerender({ ...baseProps, wrongAttempt: { id: 3, learnerOrder: ["A"] }, requestHint })
    await waitFor(() => expect(result.current).toEqual({ loading: false, text: null }))
    expect(requestHint).toHaveBeenCalledTimes(2)
  })

  it("resets the cap when the beat (skill) changes", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValue({ hint: "x" })
    const { rerender } = renderHook((props) => usePolyHint(props), {
      initialProps: {
        ...baseProps,
        wrongAttempt: { id: 1, learnerOrder: ["A"] },
        requestHint,
      },
    })
    await waitFor(() => expect(requestHint).toHaveBeenCalledTimes(1))
    rerender({ ...baseProps, wrongAttempt: { id: 2, learnerOrder: ["A"] }, requestHint })
    await waitFor(() => expect(requestHint).toHaveBeenCalledTimes(2))
    // New beat: cap resets, so a wrong attempt fetches again.
    rerender({
      ...baseProps,
      skill: "queueConstruct",
      wrongAttempt: { id: 3, learnerOrder: ["A"] },
      requestHint,
    })
    await waitFor(() => expect(requestHint).toHaveBeenCalledTimes(3))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/usePolyHint.test.tsx
```

Expected: FAIL (no `./usePolyHint`).

- [ ] **Step 3: Write the implementation**

Create `src/lib/ai/usePolyHint.ts`:

```typescript
import { useEffect, useRef, useState } from "react"

import {
  requestHint as defaultRequestHint,
  type HintRequest,
  type HintResponse,
} from "@/lib/ai/polyClient"

export interface UsePolyHintArgs {
  stageId: string
  skill: string
  discipline: "stack" | "queue"
  /** Non-null when a wrong build just happened. `id` is a monotonically rising
   * attempt marker so each new wrong attempt triggers at most one fetch. */
  wrongAttempt: { id: number; learnerOrder: string[] } | null
  maxHints?: number
  requestHint?: (req: HintRequest) => Promise<HintResponse>
}

export interface PolyHintState {
  loading: boolean
  text: string | null
}

export function usePolyHint({
  stageId,
  skill,
  discipline,
  wrongAttempt,
  maxHints = 2,
  requestHint = defaultRequestHint,
}: UsePolyHintArgs): PolyHintState {
  const [state, setState] = useState<PolyHintState>({ loading: false, text: null })
  const countRef = useRef(0)
  const priorRef = useRef<string | undefined>(undefined)
  const handledIdRef = useRef<number | null>(null)
  const skillRef = useRef(skill)

  // Reset the per-problem cap when the beat (skill) changes.
  if (skillRef.current !== skill) {
    skillRef.current = skill
    countRef.current = 0
    priorRef.current = undefined
    handledIdRef.current = null
  }

  const attemptId = wrongAttempt?.id ?? null

  useEffect(() => {
    if (!wrongAttempt) {
      setState({ loading: false, text: null })
      return
    }
    if (handledIdRef.current === wrongAttempt.id) return
    handledIdRef.current = wrongAttempt.id

    if (countRef.current >= maxHints) {
      setState({ loading: false, text: null })
      return
    }

    let cancelled = false
    setState({ loading: true, text: null })
    void (async () => {
      try {
        const res = await requestHint({
          stageId,
          skill,
          discipline,
          learnerOrder: wrongAttempt.learnerOrder,
          priorHint: priorRef.current,
        })
        if (cancelled) return
        countRef.current += 1
        if (res.hint) priorRef.current = res.hint
        setState({ loading: false, text: res.hint })
      } catch {
        if (cancelled) return
        setState({ loading: false, text: null })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  return state
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/usePolyHint.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/usePolyHint.ts src/lib/ai/usePolyHint.test.tsx
git commit -m "feat: add usePolyHint hook (per-problem cap, fetch-once, fallback)"
```

---

### Task 5: Render the hint (FeedbackFooter slot + ConstructPart wiring)

**Files:**
- Modify: `src/components/willow/FeedbackFooter.tsx`
- Test: `src/components/willow/FeedbackFooter.test.tsx` (create)
- Modify: `src/lessons/stacksQueues/Stage.tsx`

- [ ] **Step 1: Write the failing FeedbackFooter test**

Create `src/components/willow/FeedbackFooter.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { FeedbackFooter } from "./FeedbackFooter"
import type { QuestionCopy } from "@/features/lesson/engine"

const copy: QuestionCopy = {
  prompt: "p",
  hint: "static idle hint",
  nudge: "static nudge",
  correct: "c",
  why: "w",
}

function renderFooter(extra: Partial<Parameters<typeof FeedbackFooter>[0]>) {
  return render(
    <FeedbackFooter
      feedback="nudge"
      selected={null}
      showWhy={false}
      copy={copy}
      dispatch={vi.fn()}
      canCheck
      {...extra}
    />,
  )
}

describe("FeedbackFooter aiHint slot", () => {
  it("shows the static nudge when no aiHint is provided", () => {
    renderFooter({})
    expect(screen.getByText("static nudge")).toBeInTheDocument()
  })

  it("shows the thinking indicator while the aiHint is loading", () => {
    renderFooter({ aiHint: { loading: true, text: null } })
    expect(screen.getByText(/Poly is thinking/i)).toBeInTheDocument()
    expect(screen.queryByText("static nudge")).not.toBeInTheDocument()
  })

  it("shows the AI hint text when present", () => {
    renderFooter({ aiHint: { loading: false, text: "an ai nudge" } })
    expect(screen.getByText("an ai nudge")).toBeInTheDocument()
  })

  it("falls back to the static nudge when the aiHint resolved to null", () => {
    renderFooter({ aiHint: { loading: false, text: null } })
    expect(screen.getByText("static nudge")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/components/willow/FeedbackFooter.test.tsx
```

Expected: FAIL (the `aiHint` prop does not exist; thinking text not rendered).

- [ ] **Step 3: Add the `aiHint` slot to FeedbackFooter**

In `src/components/willow/FeedbackFooter.tsx`, add to the prop type (after `hideFailHint`):

```typescript
  /** Optional AI hint slot. When provided, it replaces the static nudge / fail
   * hint line: a thinking indicator while loading, the AI text when present, or
   * the static line when it resolved to null (the fallback). */
  aiHint?: { loading: boolean; text: string | null }
```

Add `aiHint` to the destructured params. Add this helper above the `return`:

```typescript
  const THINKING = "Poly is thinking..."
  function hintLine(fallback: string): string {
    if (!aiHint) return fallback
    if (aiHint.loading) return THINKING
    return aiHint.text ?? fallback
  }
```

Change the `nudge` branch to use it:

```typescript
      {feedback === "nudge" && (
        <div className="animate-fade-in">
          <FeedbackChip chip="hint" text={hintLine(copy.nudge)} />
          <CheckButton selected={selected} dispatch={dispatch} canCheck={canCheck} />
        </div>
      )}
```

Change the `fail` branch's hint text (the non-`showWhy` line) to use it. Replace the `hideFailHint`/chip block with:

```typescript
      {feedback === "fail" && (
        <div className="animate-fade-in">
          {hideFailHint && !showWhy && !aiHint?.loading && !aiHint?.text ? (
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <StatusChip status="fail" />
              <p role="status" className="sr-only">
                Try again. Tap Why for the answer, or reattempt.
              </p>
            </div>
          ) : (
            <FeedbackChip
              chip="fail"
              text={
                showWhy
                  ? copy.why
                  : hintLine("Not quite. Tap Why for the answer, or reattempt.")
              }
            />
          )}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              disabled={showWhy}
              onClick={() => dispatch({ type: "reveal" })}
            >
              Why?
            </Button>
            <Button
              variant="soft"
              size="lg"
              className="flex-1"
              onClick={() => dispatch({ type: "reattempt" })}
            >
              Reattempt
            </Button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run src/components/willow/FeedbackFooter.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 5: Wire ConstructPart to capture the order and feed the hook**

In `src/lessons/stacksQueues/Stage.tsx`, add the imports near the top:

```typescript
import { useRef } from "react"
import { usePolyHint } from "@/lib/ai/usePolyHint"
```

(If `useRef`/`useEffect`/`useState` are already imported from `react`, just add `usePolyHint`; do not duplicate the React import.)

Inside `ConstructPart`, after `const labels = ...` (around line 631), add the capture + hook wiring:

```typescript
  // Capture the learner's submitted push order (as labels) on the ready-to-check
  // render, BEFORE a wrong check resets the bin. This keeps the pure engine
  // untouched while still letting Poly reference what they actually did.
  const submittedRef = useRef<string[]>([])
  useEffect(() => {
    if (ready && state.feedback === "idle") {
      submittedRef.current = work.pushed.map((id) => labels[id])
    }
  }, [ready, state.feedback, work.pushed, labels])

  const wrongAttempt =
    state.feedback === "nudge" || state.feedback === "fail"
      ? { id: state.attempts, learnerOrder: submittedRef.current }
      : null

  const aiHint = usePolyHint({
    stageId: "stacks-and-queues",
    skill: q.skill,
    discipline: q.discipline,
    wrongAttempt,
  })
```

Then pass `aiHint` to the construct `FeedbackFooter` (around line 770):

```typescript
        <FeedbackFooter
          feedback={state.feedback}
          selected={null}
          showWhy={state.showWhy}
          copy={q}
          dispatch={dispatch}
          canCheck={ready}
          hideFailHint
          aiHint={aiHint}
        />
```

- [ ] **Step 6: Verify the full root suite and typecheck**

Run:

```bash
npm test && npx tsc -b && npm run lint
```

Expected: root Vitest passes with the new tests (it was 716; +4 FeedbackFooter +4 usePolyHint +1 requestHint, and the em-dash guard auto-scans the new `.ts`/`.tsx` non-test files: `usePolyHint.ts`. Confirm 0 failures and report the new total). `tsc -b` exits 0; oxlint exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/willow/FeedbackFooter.tsx src/components/willow/FeedbackFooter.test.tsx src/lessons/stacksQueues/Stage.tsx
git commit -m "feat: render Poly hints in the construct feedback footer"
```

---

### Task 6: Full verification

**Files:** none (gates only).

- [ ] **Step 1: All automated gates**

Run:

```bash
npm --prefix functions run build && npm --prefix functions test && npm test && npx tsc -b && npm run lint
```

Expected: functions build exits 0; functions tests 21 passed; root tests pass with 0 failures; `tsc -b` exits 0; oxlint exits 0.

- [ ] **Step 2: Confirm the safety invariants**

Run:

```bash
rg -n "correctPush|correctOrder" src/lib/ai functions/src/poly/hint.ts || echo "OK: callable + client never handle the correct order"
rg -n "answerTokens|propositions" src/ || echo "OK: client never sees rubric internals"
```

Expected: both print their OK line (the correct order is never sent to the model; the client never imports rubric internals).

- [ ] **Step 3: Report DONE** with the gate output. The real-OpenAI round-trip and in-app check are a separate manual step (needs a real key) handled by the controller; do NOT push or open a PR.

---

## Manual verification (controller + user, needs a real key; not for the implementer)

After the implementer is done and reviewed, verify the live hint via the emulator:

```bash
cd "<this worktree>"
printf 'OPENAI_API_KEY="sk-...your key..."\n' > functions/.secret.local
npm --prefix functions run build
npx -y firebase-tools@latest emulators:exec --only functions --project demo-willow \
  'sleep 3 && curl -s -X POST http://127.0.0.1:5001/demo-willow/us-central1/polyHint -H "Content-Type: application/json" -d "{\"data\":{\"stageId\":\"stacks-and-queues\",\"skill\":\"stackConstruct\",\"discipline\":\"stack\",\"learnerOrder\":[\"A\",\"B\",\"C\"]}}"; echo'
```

Expected: `{"result":{"hint":"<a nudge that does not say LIFO or give the order>"}}` or `{"result":{"hint":null}}` (fallback). Optionally run `npm run dev` and fail a construct build to see "Poly is thinking..." then the hint in the footer.

---

## Out of scope (later chunks)

- Poly self-explanation checkpoints (chunk 4).
- Voice (chunk 5).
- Verifier word-boundary / P2-token curation (carry-over noted in chunk 2; relevant when chunk 4 withholds P2).
- Updating `docs/architecture.md` / `docs/lesson-design.md` for the determinism reconciliation.

## Self-review checklist (run before requesting review)

- [ ] AI hints fire only on construct beats; other beats unchanged.
- [ ] The engine is untouched (no change under `src/features/lesson/`).
- [ ] The callable never receives the correct order; the client never imports rubric internals.
- [ ] `generateHint` regenerates once on a leak and returns null rather than an unverified giveaway.
- [ ] The 2-hint cap holds per problem and resets when the beat changes; the prior hint is passed for a different angle.
- [ ] FeedbackFooter falls back to the static line when `aiHint.text` is null; other lessons (no `aiHint`) render exactly as before.
- [ ] `npm --prefix functions test` (21), root `npm test`, `tsc -b`, and `npm run lint` all green.
