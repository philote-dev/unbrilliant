# Poly Hint Edge-Case Cache Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make complex-segment hints all-AI with a server-side cache that is enabled only for boundary-condition edge cases, and ship it end-to-end on a first live lesson (Linked Lists insert) plus the existing Arrays grow surface.

**Architecture:** The client `diagnose()` for a complex mechanic emits a giveaway-free `ErrorShape` plus a `boundary` flag and a structural `configKey`. The callable `polyHint` branches on `boundary`: boundary cases are cache-first (lookup by a deterministic key, else generate + verify + store); interior mistakes generate live and never touch the cache. A cheap phrasing layer varies wording with no extra call. A finite boundary set is precomputed offline into the same Firestore cache (admin SDK, server-only). Fallback on any failure is the static authored hint.

**Tech Stack:** Firebase Cloud Functions (TypeScript, `firebase-functions`, `openai`, adding `firebase-admin`), Vitest (functions + client), React hooks, oxlint.

---

## Scope of THIS plan

In scope (one shippable increment):
- The lesson-agnostic pipeline: cache key, `HintCache` interface + in-memory + Firestore-admin impls, edge-case branching in `generateHint`, phrasing layer, stall "thinking nudge".
- The offline precompute engine + a runnable script.
- Client plumbing: extend `HintRequest` / `usePolyHint` to carry `diagnosis` / `attempt` / `boundary` / `configKey` / `mode`, plus a stall-nudge hook.
- First live wiring: **Linked Lists insert** (`diagnoseLinkedListInsert` + Stage wiring + LL rubric/skillMap/discipline) and the **Arrays grow** retrofit (boundary-flagged, cacheable).

Out of scope (explicit follow-on plans, each needs its own mechanic `diagnose()`):
- S&Q construct diagnose + retrofit (parallels the LL insert work).
- Linked Lists delete, Hash Tables, Trees, Heaps, Graphs.

> Note on spec ordering: the design spec lists Linked Lists as the pilot and S&Q + Arrays as retrofits. This plan builds the pipeline and validates it on LL insert + Arrays grow first (both fully specifiable now); S&Q construct retrofit is a sibling follow-on because it needs a new construct `diagnose()` of comparable size. Flagged for the owner.

## Design notes (decide-once specifics)

- **Cache key (deterministic, giveaway-free):** `\`${discipline}:${skill}:${mode}:${kind}:${stepNumber}:${configKey}\``, then sanitized to a safe Firestore doc id (`[^A-Za-z0-9_-]` to `_`). `configKey` is a short structural signature authored per mechanic (for example `head-insert`, `tail-insert`, `single-node`, `full-block`); it must never contain answer items.
- **Boundary flag:** the per-mechanic `diagnose()` sets `boundary: true` for degenerate / limit configurations (empty, single element, at-capacity, overflow, first / last position). Only `boundary === true` requests read/write the cache.
- **Cache stores the canonical base hint; phrasing is applied at serve time** (so the same cached hint can vary by attempt without a new entry).
- **`hintCache` Firestore collection is server-only:** written/read via the admin SDK (which bypasses rules); no client rule is added, so default-deny keeps it unreadable from the browser.

## File map

- Create: `functions/src/poly/hintCache.ts` (cache key + `HintCache` interface + `InMemoryHintCache`).
- Create: `functions/src/poly/phrasing.ts` (pure phrasing/tone transform).
- Create: `functions/src/poly/firestoreHintCache.ts` (admin-backed `HintCache`).
- Create: `functions/src/firebaseAdmin.ts` (admin app + `adminDb`).
- Create: `functions/src/poly/boundaryShapes.ts` (authored boundary set per skill).
- Create: `functions/src/poly/precompute.ts` (precompute engine) + `functions/scripts/precomputeHintCache.mjs` (runner).
- Modify: `functions/src/poly/hint.ts` (types: `discipline` union, `boundary`, `configKey`, `mode`; cache + phrasing + nudge branch; callable wiring).
- Create: `src/features/poly/diagnoseLinkedList.ts` + test.
- Create: `src/lib/ai/useStallNudge.ts` + test.
- Modify: `src/lib/ai/polyClient.ts` (extend `HintRequest`), `src/lib/ai/usePolyHint.ts` (pass through new fields).
- Modify: `src/lessons/linkedLists/Stage.tsx` (wire hint on the rewire-insert beat), `functions/src/poly/rubrics.ts`, `functions/src/poly/skillMap.ts`.
- Modify: `src/lessons/arrays/Stage.tsx` (boundary flag on grow).
- Modify: `docs/architecture.md`, `docs/plans/specs/2026-06-27-poly-hint-tiers-design.md`.

---

## Task 1: Cache key + boundary types (server, pure)

**Files:**
- Create: `functions/src/poly/hintCache.ts`
- Modify: `functions/src/poly/hint.ts` (extend `HintArgs`)
- Test: `functions/src/poly/hintCache.test.ts`

- [ ] **Step 1: Extend `HintArgs` (and the diagnosis type) in `functions/src/poly/hint.ts`**

Change the `discipline` union and add the new optional fields:
```ts
export interface HintArgs {
  stageId: string
  skill: string
  discipline: "stack" | "queue" | "array" | "linked-list"
  learnerOrder: string[]
  priorHint?: string
  attempt?: string[]
  diagnosis?: HintDiagnosis
  // Edge-case caching + stall nudge (all client-computed, giveaway-free):
  boundary?: boolean
  configKey?: string
  mode?: "hint" | "nudge"
  // Phrasing variety (no extra model call):
  attemptIndex?: number
}
```

- [ ] **Step 2: Write the failing test**

Create `functions/src/poly/hintCache.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { hintCacheKey, InMemoryHintCache } from "./hintCache"
import type { HintArgs } from "./hint"

const args: HintArgs = {
  stageId: "linked-lists",
  skill: "llInsert",
  discipline: "linked-list",
  learnerOrder: [],
  diagnosis: { kind: "orphaned-tail", stepNumber: 1 },
  boundary: true,
  configKey: "head-insert",
  mode: "hint",
}

describe("hintCacheKey", () => {
  it("is deterministic and safe as a doc id", () => {
    const k = hintCacheKey(args)
    expect(k).toBe("linked-list_llInsert_hint_orphaned-tail_1_head-insert")
    expect(k).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("ignores phrasing-only fields (attemptIndex)", () => {
    expect(hintCacheKey({ ...args, attemptIndex: 5 })).toBe(hintCacheKey(args))
  })

  it("defaults mode to hint and missing diagnosis to none/0", () => {
    const k = hintCacheKey({ ...args, mode: undefined, diagnosis: undefined })
    expect(k).toBe("linked-list_llInsert_hint_none_0_head-insert")
  })
})

describe("InMemoryHintCache", () => {
  it("stores and returns by key, missing returns null", async () => {
    const c = new InMemoryHintCache()
    expect(await c.get("k")).toBeNull()
    await c.set("k", "a nudge")
    expect(await c.get("k")).toBe("a nudge")
  })
})
```

- [ ] **Step 3: Run it to verify failure**

Run: `npm --prefix functions test -- hintCache`
Expected: FAIL (`hintCache` module not found).

- [ ] **Step 4: Implement `functions/src/poly/hintCache.ts`**

```ts
import type { HintArgs } from "./hint"

export interface HintCache {
  get(key: string): Promise<string | null>
  set(key: string, hint: string): Promise<void>
}

/** Deterministic, giveaway-free cache key. Phrasing-only fields are excluded so
 * wording variety never fragments the cache. Sanitized to a safe Firestore id. */
export function hintCacheKey(args: HintArgs): string {
  const mode = args.mode ?? "hint"
  const kind = args.diagnosis?.kind ?? "none"
  const step = args.diagnosis?.stepNumber ?? 0
  const config = args.configKey ?? ""
  const raw = `${args.discipline}:${args.skill}:${mode}:${kind}:${step}:${config}`
  return raw.replace(/[^A-Za-z0-9_-]/g, "_")
}

export class InMemoryHintCache implements HintCache {
  private store = new Map<string, string>()
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async set(key: string, hint: string): Promise<void> {
    this.store.set(key, hint)
  }
}
```

- [ ] **Step 5: Run it to verify pass**

Run: `npm --prefix functions test -- hintCache`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/poly/hintCache.ts functions/src/poly/hintCache.test.ts functions/src/poly/hint.ts
git commit -m "feat(hint): add deterministic cache key + HintCache interface"
```

---

## Task 2: Phrasing/tone layer (server, pure)

**Files:**
- Create: `functions/src/poly/phrasing.ts`
- Test: `functions/src/poly/phrasing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/phrasing.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { applyPhrasing } from "./phrasing"

describe("applyPhrasing", () => {
  it("returns the hint unchanged on the first attempt", () => {
    expect(applyPhrasing("Look at your first move.", { attemptIndex: 0 })).toBe(
      "Look at your first move.",
    )
  })
  it("adds a gentle lead-in on the second attempt", () => {
    expect(applyPhrasing("Look again.", { attemptIndex: 1 })).toBe("One more look: Look again.")
  })
  it("caps the lead-in variety for later attempts", () => {
    expect(applyPhrasing("Look again.", { attemptIndex: 9 })).toBe("Try this angle: Look again.")
  })
  it("treats a missing attemptIndex as the first attempt", () => {
    expect(applyPhrasing("Hi.", {})).toBe("Hi.")
  })
})
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm --prefix functions test -- phrasing`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `functions/src/poly/phrasing.ts`**

```ts
// Authored, giveaway-free lead-ins. Applied AFTER verification, so they must
// never contain answer items (they are fixed strings, so they cannot).
const LEADINS = ["", "One more look: ", "Try this angle: "] as const

/** Vary wording by attempt without a new model call. The base hint is cached;
 * this transform is applied at serve time so repeats do not feel identical. */
export function applyPhrasing(hint: string, opts: { attemptIndex?: number }): string {
  const i = Math.max(0, opts.attemptIndex ?? 0)
  const lead = LEADINS[Math.min(i, LEADINS.length - 1)]
  return lead ? lead + hint : hint
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npm --prefix functions test -- phrasing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/poly/phrasing.ts functions/src/poly/phrasing.test.ts
git commit -m "feat(hint): add no-extra-call phrasing layer"
```

---

## Task 3: Edge-case cache branching in `generateHint` (server)

**Files:**
- Modify: `functions/src/poly/hint.ts`
- Test: `functions/src/poly/hint.cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/poly/hint.cache.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest"
import { generateHint } from "./hint"
import { InMemoryHintCache, hintCacheKey } from "./hintCache"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

const boundaryArgs = {
  stageId: "arrays",
  skill: "grow",
  discipline: "array" as const,
  learnerOrder: ["grow the block by one slot"],
  boundary: true,
  configKey: "full-block",
  diagnosis: { kind: "grow-by-one", stepNumber: 0 },
}

describe("generateHint cache branching", () => {
  it("stores a boundary hint on a miss, then serves it without a model call", async () => {
    const cache = new InMemoryHintCache()
    const c1 = completer("What does the next add make you redo?")
    const r1 = await generateHint(c1, "m", boundaryArgs, cache)
    expect(r1.hint).toBe("What does the next add make you redo?")
    expect(await cache.get(hintCacheKey(boundaryArgs))).toBe(
      "What does the next add make you redo?",
    )

    const c2 = completer("SHOULD NOT BE CALLED")
    const r2 = await generateHint(c2, "m", boundaryArgs, cache)
    expect(r2.hint).toBe("What does the next add make you redo?")
    expect(c2.complete).not.toHaveBeenCalled()
  })

  it("does NOT touch the cache for an interior (non-boundary) mistake", async () => {
    const cache = new InMemoryHintCache()
    const getSpy = vi.spyOn(cache, "get")
    const setSpy = vi.spyOn(cache, "set")
    const c = completer("A live, uncached nudge.")
    const r = await generateHint(c, "m", { ...boundaryArgs, boundary: false }, cache)
    expect(r.hint).toBe("A live, uncached nudge.")
    expect(getSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
  })

  it("applies phrasing at serve time on both miss and hit", async () => {
    const cache = new InMemoryHintCache()
    await generateHint(completer("Look again."), "m", boundaryArgs, cache)
    const hit = await generateHint(
      completer("UNUSED"),
      "m",
      { ...boundaryArgs, attemptIndex: 1 },
      cache,
    )
    expect(hit.hint).toBe("One more look: Look again.")
  })
})
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm --prefix functions test -- hint.cache`
Expected: FAIL (`generateHint` ignores the 4th arg and has no caching).

- [ ] **Step 3: Refactor `generateHint` in `functions/src/poly/hint.ts`**

Add imports at the top:
```ts
import { HintCache, hintCacheKey } from "./hintCache"
import { applyPhrasing } from "./phrasing"
```

Replace the body of `generateHint` (currently lines ~112-134) with:
```ts
async function generateVerified(
  completer: Completer,
  model: string,
  user: string,
  withheld: Proposition[],
): Promise<string | null> {
  const first = (await completer.complete({ system: BASE_SYSTEM, user, model })).trim()
  if (findGiveaway(first, withheld).ok) return first || null
  const second = (
    await completer.complete({ system: STRICTER + BASE_SYSTEM, user, model })
  ).trim()
  if (findGiveaway(second, withheld).ok) return second || null
  return null
}

export async function generateHint(
  completer: Completer,
  model: string,
  rawArgs: HintArgs,
  cache?: HintCache,
): Promise<HintResult> {
  const args = sanitizeHintArgs(rawArgs)
  const target = targetsForSkill(args.skill)
  if (!target) return { hint: null }
  const rubric = rubricFor(target.conceptId)
  if (!rubric) return { hint: null }
  const withheld = propositionsByIds(rubric, target.propositionIds)

  // Cache is enabled ONLY for boundary-condition edge cases.
  const key = cache && args.boundary === true ? hintCacheKey(args) : null
  if (key && cache) {
    const hit = await cache.get(key)
    if (hit) return { hint: applyPhrasing(hit, args) }
  }

  const user = buildUser(args, withheld)
  const base = await generateVerified(completer, model, user, withheld)
  if (base && key && cache) await cache.set(key, base)
  return { hint: base ? applyPhrasing(base, args) : null }
}
```

- [ ] **Step 4: Run both hint suites to verify pass + no regressions**

Run: `npm --prefix functions test -- hint`
Expected: PASS (existing `hint.test.ts` still green: it calls `generateHint(c, "m", args)` with no cache, so the cache branch is skipped; new `hint.cache.test.ts` green).

- [ ] **Step 5: Commit**

```bash
git add functions/src/poly/hint.ts functions/src/poly/hint.cache.test.ts
git commit -m "feat(hint): cache only boundary edge cases; interior mistakes stay live"
```

---

## Task 4: Stall "thinking nudge" (server prompt branch + client timer)

**Files:**
- Modify: `functions/src/poly/hint.ts` (nudge system + user branch; thread `system` through `generateVerified`)
- Create: `src/lib/ai/useStallNudge.ts` + `src/lib/ai/useStallNudge.test.tsx`
- Test: `functions/src/poly/hint.nudge.test.ts`

- [ ] **Step 1: Write the failing server test**

Create `functions/src/poly/hint.nudge.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest"
import { generateHint } from "./hint"
import type { Completer } from "../openai"

function completer(...replies: string[]): Completer {
  const fn = vi.fn()
  for (const r of replies) fn.mockResolvedValueOnce(r)
  return { complete: fn }
}

const nudgeArgs = {
  stageId: "linked-lists",
  skill: "llInsert",
  discipline: "linked-list" as const,
  learnerOrder: [],
  mode: "nudge" as const,
  diagnosis: { kind: "incomplete", stepNumber: 1 },
}

describe("generateHint nudge mode", () => {
  it("asks for an orienting nudge, not a direct hint", async () => {
    const c = completer("What is the very first pointer you must protect?")
    const res = await generateHint(c, "m", nudgeArgs)
    expect(res.hint).toBe("What is the very first pointer you must protect?")
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.system).toContain("where to think")
    expect(call.user).toContain("stuck")
  })
})
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm --prefix functions test -- hint.nudge`
Expected: FAIL (no nudge branch; `system` is always `BASE_SYSTEM`).

- [ ] **Step 3: Add the nudge system + user branch in `functions/src/poly/hint.ts`**

Add the constant near `BASE_SYSTEM`:
```ts
const NUDGE_SYSTEM =
  "The learner has been stuck for a while on a data-structures problem. Give ONE short " +
  "metacognitive nudge about WHERE to think next, never the step itself. Ask a single " +
  "orienting question. NEVER state the correct move, the order, or name the concept. " +
  "Use plain punctuation; never use an em dash."

function systemFor(args: HintArgs): string {
  return args.mode === "nudge" ? NUDGE_SYSTEM : BASE_SYSTEM
}
```

Add a nudge branch at the TOP of `buildUser` (before the array branch):
```ts
  if (args.mode === "nudge") {
    const where = args.diagnosis
      ? ` They look stuck around move ${args.diagnosis.stepNumber}.`
      : ""
    return (
      `Structure: ${args.discipline}\n` +
      `The learner is stuck and has not acted for a while.${where}\n` +
      `Ask one short orienting question about where to focus next. ` +
      `Do NOT state any move or the order.`
    )
  }
```

Thread the system through `generateVerified` (update the helper and its call site from Task 3):
```ts
async function generateVerified(
  completer: Completer,
  model: string,
  system: string,
  user: string,
  withheld: Proposition[],
): Promise<string | null> {
  const first = (await completer.complete({ system, user, model })).trim()
  if (findGiveaway(first, withheld).ok) return first || null
  const second = (
    await completer.complete({ system: STRICTER + system, user, model })
  ).trim()
  if (findGiveaway(second, withheld).ok) return second || null
  return null
}
```
And in `generateHint`, change the call to:
```ts
  const user = buildUser(args, withheld)
  const base = await generateVerified(completer, model, systemFor(args), user, withheld)
```

- [ ] **Step 4: Run server suites to verify pass**

Run: `npm --prefix functions test -- hint`
Expected: PASS (nudge + existing + cache suites; `hint.test.ts` still passes because its prompts use the default `hint` mode -> `BASE_SYSTEM`).

- [ ] **Step 5: Write the failing client hook test**

Create `src/lib/ai/useStallNudge.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStallNudge } from "./useStallNudge"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useStallNudge", () => {
  it("fires once after the delay when enabled", () => {
    const onStall = vi.fn()
    renderHook(() => useStallNudge({ enabled: true, resetKey: 0, delayMs: 20000, onStall }))
    vi.advanceTimersByTime(19999)
    expect(onStall).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onStall).toHaveBeenCalledTimes(1)
  })

  it("resets the timer when resetKey changes (activity)", () => {
    const onStall = vi.fn()
    const { rerender } = renderHook(
      ({ k }) => useStallNudge({ enabled: true, resetKey: k, delayMs: 20000, onStall }),
      { initialProps: { k: 0 } },
    )
    vi.advanceTimersByTime(15000)
    rerender({ k: 1 })
    vi.advanceTimersByTime(15000)
    expect(onStall).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(onStall).toHaveBeenCalledTimes(1)
  })

  it("does nothing when disabled", () => {
    const onStall = vi.fn()
    renderHook(() => useStallNudge({ enabled: false, resetKey: 0, delayMs: 20000, onStall }))
    vi.advanceTimersByTime(60000)
    expect(onStall).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run it to verify failure**

Run: `npm test -- useStallNudge`
Expected: FAIL (module not found).

- [ ] **Step 7: Implement `src/lib/ai/useStallNudge.ts`**

```ts
import { useEffect, useRef } from "react"

export interface UseStallNudgeArgs {
  /** Only arm the timer on a complex beat that can show a nudge. */
  enabled: boolean
  /** Change this on any learner action to reset the idle timer. */
  resetKey: unknown
  /** Idle window before a nudge fires. */
  delayMs?: number
  onStall: () => void
}

/** Fires `onStall` once after `delayMs` of inactivity. The timer restarts when
 * `resetKey` changes (an action) or `enabled` toggles. */
export function useStallNudge({
  enabled,
  resetKey,
  delayMs = 20000,
  onStall,
}: UseStallNudgeArgs): void {
  const onStallRef = useRef(onStall)
  onStallRef.current = onStall

  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(() => onStallRef.current(), delayMs)
    return () => clearTimeout(t)
  }, [enabled, resetKey, delayMs])
}
```

- [ ] **Step 8: Run it to verify pass**

Run: `npm test -- useStallNudge`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add functions/src/poly/hint.ts functions/src/poly/hint.nudge.test.ts src/lib/ai/useStallNudge.ts src/lib/ai/useStallNudge.test.tsx
git commit -m "feat(hint): add stall thinking-nudge (server prompt + client timer)"
```

---

## Task 5: Firestore-admin cache + callable wiring (server)

**Files:**
- Modify: `functions/package.json` (add `firebase-admin`)
- Create: `functions/src/firebaseAdmin.ts`
- Create: `functions/src/poly/firestoreHintCache.ts` + `functions/src/poly/firestoreHintCache.test.ts`
- Modify: `functions/src/poly/hint.ts` (wire the cache into the `polyHint` callable)

- [ ] **Step 1: Add the dependency**

Run:
```bash
npm --prefix functions install firebase-admin
```
Expected: `firebase-admin` added to `functions/package.json` dependencies.

- [ ] **Step 2: Create the lazy admin accessor `functions/src/firebaseAdmin.ts`**

Lazy so importing `hint.ts` in unit tests never initializes admin:
```ts
import { getApps, initializeApp } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let db: Firestore | undefined

export function getAdminDb(): Firestore {
  if (!db) {
    if (getApps().length === 0) initializeApp()
    db = getFirestore()
  }
  return db
}
```

- [ ] **Step 3: Write the failing cache-impl test (no emulator; fake db)**

Create `functions/src/poly/firestoreHintCache.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest"
import { firestoreHintCache } from "./firestoreHintCache"

function fakeDb(existing?: string) {
  const docRef = {
    get: vi.fn().mockResolvedValue({
      exists: existing !== undefined,
      get: (_f: string) => existing,
    }),
    set: vi.fn().mockResolvedValue(undefined),
  }
  const db = { collection: vi.fn(() => ({ doc: vi.fn(() => docRef) })) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { cache: firestoreHintCache(db as any), docRef }
}

describe("firestoreHintCache", () => {
  it("returns the stored hint when the doc exists", async () => {
    const { cache } = fakeDb("cached nudge")
    expect(await cache.get("k")).toBe("cached nudge")
  })
  it("returns null when the doc is missing", async () => {
    const { cache } = fakeDb(undefined)
    expect(await cache.get("k")).toBeNull()
  })
  it("writes the hint on set", async () => {
    const { cache, docRef } = fakeDb()
    await cache.set("k", "h")
    expect(docRef.set).toHaveBeenCalledWith(expect.objectContaining({ hint: "h" }))
  })
})
```

- [ ] **Step 4: Run it to verify failure**

Run: `npm --prefix functions test -- firestoreHintCache`
Expected: FAIL (module not found).

- [ ] **Step 5: Implement `functions/src/poly/firestoreHintCache.ts`**

```ts
import type { Firestore } from "firebase-admin/firestore"
import type { HintCache } from "./hintCache"

/** Server-only hint cache. Read/written via the admin SDK, which bypasses
 * security rules; no client rule is added, so the browser cannot read it. */
export function firestoreHintCache(db: Firestore, collection = "hintCache"): HintCache {
  return {
    async get(key) {
      const snap = await db.collection(collection).doc(key).get()
      return snap.exists ? ((snap.get("hint") as string) ?? null) : null
    },
    async set(key, hint) {
      await db.collection(collection).doc(key).set({ hint, updatedAt: Date.now() })
    },
  }
}
```

- [ ] **Step 6: Run it to verify pass**

Run: `npm --prefix functions test -- firestoreHintCache`
Expected: PASS.

- [ ] **Step 7: Wire the cache into the `polyHint` callable in `functions/src/poly/hint.ts`**

Add imports:
```ts
import { getAdminDb } from "../firebaseAdmin"
import { firestoreHintCache } from "./firestoreHintCache"
import { HintCache } from "./hintCache"
```
Add a lazily-built singleton and pass it into `generateHint` (replace the existing `polyHint` export):
```ts
let cacheSingleton: HintCache | undefined
function hintCache(): HintCache {
  if (!cacheSingleton) cacheSingleton = firestoreHintCache(getAdminDb())
  return cacheSingleton
}

export const polyHint = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<HintResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await generateHint(
        completer,
        resolveModel(),
        request.data as HintArgs,
        hintCache(),
      )
    } catch (err) {
      logger.error("polyHint failed", err)
      return { hint: null }
    }
  },
)
```

- [ ] **Step 8: Typecheck + full functions suite**

Run: `npm --prefix functions run build && npm --prefix functions test`
Expected: PASS (unit tests never call `getAdminDb`, so admin is not initialized in tests).

- [ ] **Step 9: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/src/firebaseAdmin.ts functions/src/poly/firestoreHintCache.ts functions/src/poly/firestoreHintCache.test.ts functions/src/poly/hint.ts
git commit -m "feat(hint): server-only Firestore hint cache wired into polyHint"
```

---

## Task 6: Offline precompute engine + runner (server)

**Files:**
- Create: `functions/src/poly/boundaryShapes.ts`
- Create: `functions/src/poly/precompute.ts` + `functions/src/poly/precompute.test.ts`
- Create: `functions/scripts/precomputeHintCache.ts`
- Modify: `functions/package.json` (add `tsx` devDep + a `precompute` script), `firebase.json` (ignore `scripts`)

- [ ] **Step 1: Author the boundary set `functions/src/poly/boundaryShapes.ts`**

Start with the fully-known `grow` boundary; LL shapes are appended in Task 8:
```ts
import type { HintArgs } from "./hint"

/** Authored, finite boundary set per skill. Each entry is a boundary-condition
 * shape worth precomputing. Extend alongside each mechanic's diagnose(). */
export const BOUNDARY_SHAPES: HintArgs[] = [
  {
    stageId: "arrays",
    skill: "grow",
    discipline: "array",
    learnerOrder: ["grow the block by one slot"],
    boundary: true,
    configKey: "full-block",
    diagnosis: { kind: "grow-by-one", stepNumber: 0 },
    mode: "hint",
  },
]
```

- [ ] **Step 2: Write the failing precompute test**

Create `functions/src/poly/precompute.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest"
import { precomputeBoundaryHints } from "./precompute"
import { InMemoryHintCache, hintCacheKey } from "./hintCache"
import type { Completer } from "../openai"
import type { HintArgs } from "./hint"

const shape: HintArgs = {
  stageId: "arrays",
  skill: "grow",
  discipline: "array",
  learnerOrder: ["grow the block by one slot"],
  boundary: true,
  configKey: "full-block",
  diagnosis: { kind: "grow-by-one", stepNumber: 0 },
}

function completer(reply: string): Completer {
  return { complete: vi.fn().mockResolvedValue(reply) }
}

describe("precomputeBoundaryHints", () => {
  it("generates and stores each boundary shape", async () => {
    const cache = new InMemoryHintCache()
    const res = await precomputeBoundaryHints({
      completer: completer("What does the next add make you redo?"),
      model: "m",
      cache,
      shapes: [shape],
    })
    expect(res).toEqual({ attempted: 1, cached: 1 })
    expect(await cache.get(hintCacheKey(shape))).toBe("What does the next add make you redo?")
  })

  it("does not count a shape whose hint never verifies", async () => {
    const cache = new InMemoryHintCache()
    // "double" is a withheld P3 token for grow -> both attempts rejected -> null.
    const res = await precomputeBoundaryHints({
      completer: { complete: vi.fn().mockResolvedValue("Just double it.") },
      model: "m",
      cache,
      shapes: [shape],
    })
    expect(res).toEqual({ attempted: 1, cached: 0 })
  })
})
```

- [ ] **Step 3: Run it to verify failure**

Run: `npm --prefix functions test -- precompute`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `functions/src/poly/precompute.ts`**

```ts
import type { Completer } from "../openai"
import { generateHint, type HintArgs } from "./hint"
import type { HintCache } from "./hintCache"

export interface PrecomputeResult {
  attempted: number
  cached: number
}

/** Generate + verify + store each boundary shape. Reuses generateHint with the
 * cache, so a verified hint is written and a rejected one is simply skipped. */
export async function precomputeBoundaryHints(deps: {
  completer: Completer
  model: string
  cache: HintCache
  shapes: HintArgs[]
}): Promise<PrecomputeResult> {
  let cached = 0
  for (const shape of deps.shapes) {
    const r = await generateHint(
      deps.completer,
      deps.model,
      { ...shape, boundary: true },
      deps.cache,
    )
    if (r.hint) cached += 1
  }
  return { attempted: deps.shapes.length, cached }
}
```

- [ ] **Step 5: Run it to verify pass**

Run: `npm --prefix functions test -- precompute`
Expected: PASS.

- [ ] **Step 6: Add the runner `functions/scripts/precomputeHintCache.ts`**

```ts
import { createClient, openAICompleter } from "../src/openai"
import { resolveModel } from "../src/openaiConfig"
import { getAdminDb } from "../src/firebaseAdmin"
import { firestoreHintCache } from "../src/poly/firestoreHintCache"
import { precomputeBoundaryHints } from "../src/poly/precompute"
import { BOUNDARY_SHAPES } from "../src/poly/boundaryShapes"

const key = process.env.OPENAI_API_KEY
if (!key) throw new Error("OPENAI_API_KEY is required to precompute hints")

precomputeBoundaryHints({
  completer: openAICompleter(createClient(key)),
  model: resolveModel(),
  cache: firestoreHintCache(getAdminDb()),
  shapes: BOUNDARY_SHAPES,
})
  .then((r) => {
    console.log("precompute complete:", r)
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
```

- [ ] **Step 7: Add the tsx devDep + script, and ignore `scripts` on deploy**

Run:
```bash
npm --prefix functions install --save-dev tsx
```
Add to `functions/package.json` scripts:
```json
    "precompute": "tsx scripts/precomputeHintCache.ts",
```
In `firebase.json`, add `"scripts"` to the functions `ignore` array so the offline runner is not deployed:
```json
      "ignore": ["node_modules", ".git", "*.local", "scripts", "**/*.test.ts"],
```

- [ ] **Step 8: Commit**

```bash
git add functions/src/poly/boundaryShapes.ts functions/src/poly/precompute.ts functions/src/poly/precompute.test.ts functions/scripts/precomputeHintCache.ts functions/package.json functions/package-lock.json firebase.json
git commit -m "feat(hint): offline boundary-set precompute engine + runner"
```

> Running it (offline, manual): set `OPENAI_API_KEY` and Firestore admin creds (or point at the emulator), then `npm --prefix functions run precompute`. Re-run after adding boundary shapes.

---

## Task 7: Client request plumbing

**Files:**
- Modify: `src/lib/ai/polyClient.ts` (extend `HintRequest`)
- Modify: `src/lib/ai/usePolyHint.ts` (accept + forward the new fields)
- Test: `src/lib/ai/usePolyHint.test.tsx` (extend if present; otherwise add an assertion)

- [ ] **Step 1: Extend `HintRequest` in `src/lib/ai/polyClient.ts`**

Change the interface to:
```ts
export interface HintRequest {
  stageId: string
  skill: string
  discipline: "stack" | "queue" | "array" | "linked-list"
  learnerOrder: string[]
  priorHint?: string
  /** Multi-step beats: the learner's operation trace as readable steps. */
  attempt?: string[]
  /** Structural read from the client diagnose engine (kind + 1-based step). */
  diagnosis?: { kind: string; stepNumber: number }
  /** Edge-case caching + stall nudge + phrasing. */
  boundary?: boolean
  configKey?: string
  mode?: "hint" | "nudge"
  attemptIndex?: number
}
```

- [ ] **Step 2: Extend `UsePolyHintArgs` and forward the fields in `src/lib/ai/usePolyHint.ts`**

Add to `UsePolyHintArgs`:
```ts
  discipline: "stack" | "queue" | "array" | "linked-list"
  /** Optional structural diagnosis carried on the wrong attempt (complex beats). */
  diagnosis?: { kind: string; stepNumber: number }
  attempt?: string[]
  boundary?: boolean
  configKey?: string
```
In the effect, change the `requestHint` call to forward them and the attempt index (for phrasing):
```ts
        const res = await requestHint({
          stageId,
          skill,
          discipline,
          learnerOrder: wrongAttempt.learnerOrder,
          priorHint: priorRef.current,
          diagnosis,
          attempt,
          boundary,
          configKey,
          mode: "hint",
          attemptIndex: countRef.current,
        })
```
(Read `diagnosis`/`attempt`/`boundary`/`configKey` from the hook args; like `stageId`, they are intentionally not effect deps so a re-render does not refetch.)

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: FAILS in `src/lessons/arrays/Stage.tsx` and `src/lessons/stacksQueues/Stage.tsx` only if the new `discipline` union is stricter; both already pass a valid discipline, so it should PASS. If a `discipline` literal type error appears, it is fixed when wiring those stages (Tasks 8-9).

- [ ] **Step 4: Run client tests**

Run: `npm test -- usePolyHint polyClient`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/polyClient.ts src/lib/ai/usePolyHint.ts src/lib/ai/usePolyHint.test.tsx
git commit -m "feat(hint): forward diagnosis/boundary/configKey/mode from client hook"
```

---

## Task 8: Linked Lists insert pilot (first live wiring)

**Files:**
- Create: `src/features/poly/diagnoseLinkedList.ts` + `src/features/poly/diagnoseLinkedList.test.ts`
- Modify: `functions/src/poly/rubrics.ts`, `functions/src/poly/skillMap.ts`, `functions/src/poly/boundaryShapes.ts`
- Modify: `src/lessons/linkedLists/Stage.tsx`

- [ ] **Step 1: Write the failing diagnose test**

Create `src/features/poly/diagnoseLinkedList.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { diagnoseLinkedListInsert } from "./diagnoseLinkedList"
import { pointerId, NIL } from "@/features/lesson/linkedListsEngine"

// Insert X after A in A -> B -> ∅ (so prev=A, at=B, head=A).
const q = {
  head: "A",
  prev: "A",
  at: "B",
  newNode: "X",
  nodes: ["A", "B"],
  correctNext: { [pointerId("X")]: "B", [pointerId("A")]: "X", [pointerId("B")]: NIL },
}

describe("diagnoseLinkedListInsert", () => {
  it("returns null when nothing has been written yet", () => {
    expect(diagnoseLinkedListInsert(q, [])).toBeNull()
  })

  it("flags repointing prev before saving the tail (orphan)", () => {
    const d = diagnoseLinkedListInsert(q, [{ from: pointerId("A"), to: "X" }])
    expect(d?.kind).toBe("repointed-before-saving")
    expect(d?.stepNumber).toBe(1)
  })

  it("treats the save-first move as a safe-but-incomplete attempt", () => {
    const d = diagnoseLinkedListInsert(q, [{ from: pointerId("X"), to: "B" }])
    expect(d?.kind).toBe("incomplete")
  })

  it("marks a head insert as a boundary case", () => {
    const d = diagnoseLinkedListInsert(q, [{ from: pointerId("A"), to: "X" }])
    expect(d?.boundary).toBe(true)
    expect(d?.configKey).toBe("head-insert")
  })
})
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- diagnoseLinkedList`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/features/poly/diagnoseLinkedList.ts`**

```ts
import { pointerId, NIL, type RewirePair } from "@/features/lesson/linkedListsEngine"

export type LLErrorKind =
  | "repointed-before-saving" // aimed prev -> new before new -> at (orphans the tail)
  | "wrong-target" // a write aimed at a node outside the correct map
  | "incomplete" // safe so far, not yet complete
  | "off-path"

export interface LLInsertQuestion {
  head: string
  prev: string
  at: string
  newNode: string
  nodes: string[]
  correctNext: Record<string, string>
}

export interface LLDiagnosis {
  kind: LLErrorKind
  stepNumber: number // 1-based index of the offending write
  boundary: boolean
  configKey: string
}

function configFor(q: LLInsertQuestion): { boundary: boolean; configKey: string } {
  if (q.prev === q.head) return { boundary: true, configKey: "head-insert" }
  if (q.at === NIL) return { boundary: true, configKey: "tail-insert" }
  if (q.nodes.length <= 2) return { boundary: true, configKey: "single-node" }
  return { boundary: false, configKey: "interior" }
}

/** Structural, giveaway-free read of an insert attempt. Names no correct move,
 * only WHICH of the learner's writes first left the safe line. */
export function diagnoseLinkedListInsert(
  q: LLInsertQuestion,
  writes: RewirePair[],
): LLDiagnosis | null {
  if (writes.length === 0) return null
  const cfg = configFor(q)
  const savedAt = writes.findIndex((w) => w.from === pointerId(q.newNode) && w.to === q.at)
  const repointAt = writes.findIndex((w) => w.from === pointerId(q.prev) && w.to === q.newNode)

  if (repointAt >= 0 && (savedAt < 0 || savedAt > repointAt)) {
    return { kind: "repointed-before-saving", stepNumber: repointAt + 1, ...cfg }
  }
  const correctTargets = new Set(Object.values(q.correctNext))
  const badTarget = writes.findIndex((w) => !correctTargets.has(w.to))
  if (badTarget >= 0) {
    return { kind: "wrong-target", stepNumber: badTarget + 1, ...cfg }
  }
  const done =
    savedAt >= 0 && writes.some((w) => w.from === pointerId(q.prev) && w.to === q.newNode)
  if (!done) return { kind: "incomplete", stepNumber: writes.length, ...cfg }
  return { kind: "off-path", stepNumber: writes.length, ...cfg }
}
```

- [ ] **Step 4: Run it to verify pass**

Run: `npm test -- diagnoseLinkedList`
Expected: PASS.

- [ ] **Step 5: Add the LL rubric (server) in `functions/src/poly/rubrics.ts`**

Add this rubric and register it:
```ts
const linkedListsRubric: Rubric = {
  conceptId: "linked-lists",
  propositions: [
    {
      id: "P1",
      text: "Save the rest of the list (aim the new node at the tail) before repointing",
      answerTokens: ["save the rest", "save first", "new node first", "aim x", "new.next", "point the new node"],
    },
    {
      id: "P2",
      text: "Repointing the predecessor first orphans the tail (unreachable from the head)",
      answerTokens: ["orphan", "orphaned", "unreachable", "floats off", "stranded", "lost the tail"],
    },
  ],
}
```
And add to the `RUBRICS` record:
```ts
export const RUBRICS: Record<string, Rubric> = {
  stacks: stacksRubric,
  queues: queuesRubric,
  arrays: arraysRubric,
  "linked-lists": linkedListsRubric,
}
```

- [ ] **Step 6: Add the skill map entry in `functions/src/poly/skillMap.ts`**

```ts
  llInsert: { conceptId: "linked-lists", propositionIds: ["P1", "P2"] },
```

- [ ] **Step 7: Append LL boundary shapes in `functions/src/poly/boundaryShapes.ts`**

Add inside `BOUNDARY_SHAPES`:
```ts
  {
    stageId: "linked-lists",
    skill: "llInsert",
    discipline: "linked-list",
    learnerOrder: ["A", "B"],
    boundary: true,
    configKey: "head-insert",
    diagnosis: { kind: "repointed-before-saving", stepNumber: 1 },
    attempt: ["aim p:A -> X"],
    mode: "hint",
  },
  {
    stageId: "linked-lists",
    skill: "llInsert",
    discipline: "linked-list",
    learnerOrder: ["A", "B"],
    boundary: true,
    configKey: "tail-insert",
    diagnosis: { kind: "repointed-before-saving", stepNumber: 1 },
    attempt: ["aim p:A -> X"],
    mode: "hint",
  },
```

- [ ] **Step 8: Run the server suite**

Run: `npm --prefix functions test`
Expected: PASS (rubric + skill map additions do not break existing tests).

- [ ] **Step 9: Wire the hint into the rewire-insert beat in `src/lessons/linkedLists/Stage.tsx`**

First locate the feedback render in `RewirePart` (it renders a feedback line/footer on `nudge`/`fail`):
```bash
rg -n "FeedbackFooter|feedback ===|aiHint" src/lessons/linkedLists/Stage.tsx
```
Add these imports at the top of the file:
```tsx
import { usePolyHint } from "@/lib/ai/usePolyHint"
import { diagnoseLinkedListInsert } from "@/features/poly/diagnoseLinkedList"
```
At the TOP of `RewirePart` (before any early return, alongside the other hooks), add:
```tsx
  const q = state.question
  const wrong = state.feedback === "nudge" || state.feedback === "fail"
  const diag =
    wrong && q && q.kind === "rewire-insert" && q.prev && q.at && q.newNode
      ? diagnoseLinkedListInsert(
          {
            head: q.head,
            prev: q.prev,
            at: q.at,
            newNode: q.newNode,
            nodes: q.nodes,
            correctNext: q.correctNext,
          },
          state.writes,
        )
      : null
  const aiHint = usePolyHint({
    stageId: "linked-lists",
    skill: "llInsert",
    discipline: "linked-list",
    wrongAttempt: wrong && diag ? { id: state.attempts, learnerOrder: q!.nodes } : null,
    diagnosis: diag ? { kind: diag.kind, stepNumber: diag.stepNumber } : undefined,
    attempt: state.writes.map((w) => `aim ${w.from} -> ${w.to}`),
    boundary: diag?.boundary,
    configKey: diag?.configKey,
  })
```
Then pass `aiHint={aiHint}` to the `FeedbackFooter` that `RewirePart` renders (mirroring `src/lessons/arrays/Stage.tsx` line ~946 and `src/lessons/stacksQueues/Stage.tsx` line ~936). If `RewirePart` does not currently render a `FeedbackFooter`, wrap its feedback line so the `aiHint` slot is shown using the same `{ loading, text }` shape `FeedbackFooter` expects.

- [ ] **Step 10: Typecheck + LL tests**

Run: `npm run build && npm test -- linkedLists`
Expected: PASS. (If LL Stage tests render the rewire beat and now call the real `usePolyHint`, mock it like the S&Q/arrays Stage tests do: `vi.mock("@/lib/ai/usePolyHint", () => ({ usePolyHint: () => ({ loading: false, text: null }) }))`.)

- [ ] **Step 11: Commit**

```bash
git add src/features/poly/diagnoseLinkedList.ts src/features/poly/diagnoseLinkedList.test.ts functions/src/poly/rubrics.ts functions/src/poly/skillMap.ts functions/src/poly/boundaryShapes.ts src/lessons/linkedLists/Stage.tsx
git commit -m "feat(hint): Linked Lists insert pilot (diagnose + rubric + skill map + wiring)"
```

---

## Task 9: Retrofit Arrays grow into the cacheable pipeline

**Files:**
- Modify: `src/lessons/arrays/Stage.tsx`

- [ ] **Step 1: Flag the grow hint as a boundary case**

In `GrowPart`, change the `usePolyHint` call to:
```tsx
  const aiHint = usePolyHint({
    stageId: "arrays",
    skill: "grow",
    discipline: "array",
    wrongAttempt: wrongGrowOne
      ? { id: state.attempts, learnerOrder: ["grow the block by one slot"] }
      : null,
    boundary: true,
    configKey: "full-block",
    diagnosis: { kind: "grow-by-one", stepNumber: 0 },
  })
```

- [ ] **Step 2: Typecheck + arrays tests**

Run: `npm run build && npm test -- arrays`
Expected: PASS (the arrays Stage test mocks `usePolyHint`, so the extra fields are inert there; the wiring just forwards them).

- [ ] **Step 3: Commit**

```bash
git add src/lessons/arrays/Stage.tsx
git commit -m "feat(hint): make Arrays grow a cacheable boundary hint"
```

---

## Task 10: Docs + full verification

**Files:**
- Modify: `docs/architecture.md`, `docs/plans/specs/2026-06-27-poly-hint-tiers-design.md`

- [ ] **Step 1: Update the docs**

In `docs/architecture.md`, document the hint AI seam and the server-only boundary-condition `hintCache`. In `docs/plans/specs/2026-06-27-poly-hint-tiers-design.md`, change the status line to note it is un-deferred and superseded by `docs/plans/specs/2026-06-28-poly-hints-and-teachback-design.md`, and that the personalization question is resolved (personalize to the mistake; per-learner deferred).

- [ ] **Step 2: Full verification sweep**

Run each and confirm PASS:
```bash
npm --prefix functions run build
npm --prefix functions test
npm run build
npm run lint
npm test
npm run test:emulator
```
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md docs/plans/specs/2026-06-27-poly-hint-tiers-design.md
git commit -m "docs: document hint edge-case cache seam; un-defer tiers spec"
```

---

## Self-review checklist (run after the plan, before execution)

**Spec coverage:** all-AI complex hints (Tasks 3, 8-9), authored only as fallback (preserved in `generateHint`), boundary-only cache (Tasks 1, 3), hybrid fill = precompute + lazy (Tasks 3, 6), phrasing layer (Task 2), ~20s stall nudge (Task 4), OpenAI provider (unchanged), no-giveaway verifier before cache/serve (Task 3), Linked Lists pilot (Task 8), Arrays retrofit (Task 9). Out-of-scope items (S&Q construct diagnose, other lessons) are flagged as follow-on, not silently dropped.

**Type consistency:** `HintArgs` (server) and `HintRequest` (client) both carry `discipline` (incl. `linked-list`), `boundary`, `configKey`, `mode`, `attemptIndex`; `HintDiagnosis` is `{ kind, stepNumber }` on both; `HintCache` is `{ get, set }` everywhere; `applyPhrasing(hint, { attemptIndex })` signature matches its callers; `diagnoseLinkedListInsert(q, writes)` returns `{ kind, stepNumber, boundary, configKey }` consumed by the Stage wiring.

**Placeholder scan:** no TBD/TODO; every code step shows real code; the one judgement call (where `RewirePart` renders its feedback footer) is bounded by a grep step + the arrays/S&Q pattern to copy.

**Open follow-ups (separate plans):** S&Q construct `diagnose()` + retrofit; Linked Lists delete; Hash Tables / Trees / Heaps / Graphs diagnose + wiring; richer phrasing; emulator-level test of the live Firestore cache.

