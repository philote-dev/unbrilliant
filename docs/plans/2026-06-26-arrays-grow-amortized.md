# Arrays "grow" rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Arrays dynamic-array section into three beats (an animated memory teach, a reframed "cleanest fix" question with a live Poly hint on the teachable wrong answer, and a new average-cost summary) so the learner understands fixed-size memory, feels why grow-by-one is wasteful, and sees why doubling is cheap on average.

**Architecture:** Pure-engine-first TDD. The engine (`arraysEngine.ts`) restructures parts/skills/state and stays deterministic and seedable; a new pure `appendRun` helper computes the amortized tally so the summary numbers are unit-tested. The UI is view-only components (`FullBlockReject`, `GrowByOneLoop`, `GrowSummary`) plus branch rendering in `arrays/Stage.tsx`, all honoring `prefers-reduced-motion`. The live Poly hint reuses the existing `polyHint` callable + withhold/verify guardrails, fired only on the `growone` wrong answer.

**Tech Stack:** TypeScript, React 19, Motion (Framer) for animation, Vitest (node + jsdom projects) + Testing Library, Playwright (e2e), Firebase Functions (Poly backend), oxlint.

---

## Coordination note (read before starting)

- Work proceeds on the current branch (`main`), where the prior Arrays rebuild and the approved spec (`docs/plans/specs/2026-06-26-arrays-grow-amortized-design.md`) already live.
- The Poly backend/client files have **uncommitted in-flight edits** in the working tree: `functions/src/poly/hint.ts`, `functions/src/poly/hint.test.ts`, `src/lib/ai/polyClient.ts` (a separate "diagnose / complex hint" workstream). The code blocks in Tasks 5 and 6 below are written to apply **on top of** that current state (they extend the `discipline` union and add an arrays branch; they do not remove the diagnose work). Integrate, do not clobber.
- Commit the **functions** changes (Task 5) as their own commit, separate from the client/lesson changes, given the concurrent edits.
- House rule: no em dashes anywhere (see `.cursor/rules/no-em-dashes.mdc`). Use periods, colons, parentheses, or a plain hyphen.

## Commands (exact)

- Run one node test file: `npx vitest run <path>` (from repo root).
- Run one dom test file: `npx vitest run <path>` (jsdom project picks up `*.test.tsx`).
- Run the functions tests: `cd functions && npx vitest run <path>` then `cd ..`.
- Typecheck (root): `npx tsc -b`.
- Typecheck (functions): `cd functions && npx tsc --noEmit && cd ..`.
- Lint: `npm run lint`.
- Full test suite (root): `npm run test`.

---

## File Structure

**Engine (pure, node-tested)**
- Modify `src/features/lesson/arraysEngine.ts`: parts/skills/state shape, `makeGrow` reframe, remove `makeGrowVerdict`, remove `growVerdict`/`step`, add `grow-summary` intro, reducer + resume migration, new pure `appendRun` selector.
- Modify `src/features/lesson/arraysEngine.test.ts`: flow/grow/gate/resume tests for 11 parts + 7 skills, `appendRun` tests.

**Lesson UI (dom-tested + gallery)**
- Modify `src/lessons/arrays/CapacityFrame.tsx`: add view-only `FullBlockReject` and `GrowByOneLoop` (reuse the private `Block`).
- Create `src/lessons/arrays/GrowSummary.tsx`: the average-cost summary figure (reads `appendRun`).
- Modify `src/lessons/arrays/Stage.tsx`: upgrade `TeachGrowPart`, rework `GrowPart` (branch + live Poly), add `GrowSummaryPart`, add the `grow-summary` switch case.
- Modify `src/lessons/arrays/Stage.test.tsx`: DOM tests for the reject teach, the grow branches (+ mocked Poly hint), and the summary.

**Poly (live hint)**
- Modify `functions/src/poly/rubrics.ts` (+ `rubrics.test.ts`): add the `arrays` rubric.
- Modify `functions/src/poly/skillMap.ts` (+ `skillMap.test.ts`): map `grow`.
- Modify `functions/src/poly/hint.ts` (+ `hint.test.ts`): relax `discipline`, add the arrays/grow prompt branch.
- Modify `src/lib/ai/polyClient.ts` and `src/lib/ai/usePolyHint.ts` (+ `usePolyHint.test.tsx`): relax `discipline` to include `"array"`.

**Integration surfaces**
- Modify `src/features/progress/concepts.ts`: drop `growVerdict` from the arrays sub-skill list.
- Modify `src/dev/GalleryApp.tsx`: refresh `ARR_PRESETS` (teach reject, grow idle/growone/correct, grow-summary).
- Modify `e2e/tracer.spec.ts`: drive the new grow + grow-summary flow.

Note: `src/features/progress/analytics.ts` (`MASTERY_TOTAL.arrays = ARRAYS_GATE`) and `src/lessons/arrays.tsx` (`totalParts: ARRAYS_TOTAL_PARTS`) read the engine constants dynamically, so they need **no** edits; the drift-guard test in `concepts.test.ts` passes automatically once both the engine counters and `concepts.ts` drop `growVerdict`.

---

## Task 1: Engine restructure (11 parts, 7 skills, reframed single-ask grow)

Rework the engine so the dynamic-array section is three beats: `teach-grow` (intro) -> `grow` (graded, single ask) -> `grow-summary` (intro, completes the lesson). Remove the `growVerdict` skill and the `step` sub-stepper.

**Files:**
- Modify: `src/features/lesson/arraysEngine.ts`
- Test: `src/features/lesson/arraysEngine.test.ts`

- [ ] **Step 1: Update the engine tests to the new flow (write the failing tests first)**

Replace the `happyPath` driver and the `growStep1` helper near the top of `src/features/lesson/arraysEngine.test.ts` (currently lines ~52-68) with:

```ts
/** Drive the whole lesson, every beat correct. */
function happyPath(seed = SEED): ArraysState {
  let s = createArrays(seed)
  s = apply(s, { type: "continue" }) // play-access -> jump
  s = apply(solve(s), { type: "next" }) // jump -> scan
  s = apply(solve(s), { type: "next" }) // scan -> play-mutate
  s = apply(s, { type: "continue" }) // play-mutate -> insert
  s = apply(solve(s), { type: "next" }) // insert -> delete
  s = apply(solve(s), { type: "next" }) // delete -> place-cheapest
  s = apply(solve(s), { type: "next" }) // place-cheapest -> realworld
  s = apply(solve(s), { type: "next" }) // realworld -> teach-grow (intro)
  s = apply(s, { type: "continue" }) // teach-grow -> grow
  s = apply(solve(s), { type: "next" }) // grow -> grow-summary (intro)
  s = apply(s, { type: "continue" }) // grow-summary -> completed
  return s
}
```

(Delete the `const growStep1 = ...` line entirely; it is no longer used.)

Replace the flow `describe` block (the "Arrays ... flow (10 beats ...)" tests, currently lines ~70-95) with:

```ts
describe("Arrays: flow (11 beats, intro vs graded)", () => {
  it("starts on the access playground and steps to the first graded beat", () => {
    const s = createArrays(SEED)
    expect(currentPartArrays(s)).toBe("play-access")
    expect(ARRAYS_TOTAL_PARTS).toBe(11)
    expect(ARRAYS_GATE).toBe(7)
    expect(currentPartArrays(apply(s, { type: "continue" }))).toBe("jump")
  })

  it("teaches dynamic-array context (an intro beat) right before the grow problem", () => {
    const teach = at("teach-grow")
    expect(partQuotaArrays(teach)).toBeNull() // intro, not graded
    expect(currentPartArrays(apply(teach, { type: "continue" }))).toBe("grow")
  })

  it("grow advances to the non-graded average-cost summary, which completes the lesson", () => {
    const grown = apply(solve(at("grow")), { type: "next" })
    expect(currentPartArrays(grown)).toBe("grow-summary")
    expect(partQuotaArrays(grown)).toBeNull() // intro
    const done = apply(grown, { type: "continue" })
    expect(done.completed).toBe(true)
  })

  it("a graded beat ignores continue (advances via next, not continue)", () => {
    const s = at("jump")
    expect(apply(s, { type: "continue" })).toBe(s)
  })

  it("shows n/7 only on graded beats", () => {
    expect(partQuotaArrays(createArrays(SEED))).toBeNull() // play-access
    expect(partQuotaArrays(at("jump"))).toEqual({ done: 0, total: 7 })
    expect(partQuotaArrays(at("play-mutate"))).toBeNull()
  })
})
```

Replace the grow `describe` block (the "Arrays ... grow synthesis ..." tests, currently lines ~202-224) with:

```ts
describe("Arrays: grow (pick the cleanest fix, single ask)", () => {
  it("is a single graded ask whose answer is to double + copy; clears grow", () => {
    const s = at("grow")
    expect(s.question!.answer).toBe("grow")
    expect(s.question!.options!.map((o) => o.id).sort()).toEqual(["grow", "growone", "inplace"])
    expect(s.question!.resize).toMatchObject({ resizes: true })
    expect(s.question!.resize!.size).toBe(s.question!.resize!.capacity) // full
    expect(solve(s).grow).toBe(1)
  })

  it("the grow chip uses the locked house word, gloss in why only", () => {
    const q = at("grow").question!
    expect(q.cost.word).toBe("usually free")
    expect(q.cost.word).not.toBe("scales")
    expect(q.why).toMatch(/usually free, with the occasional big reshuffle/i)
  })

  it("does not split into a second verdict step (next leaves grow)", () => {
    const after = apply(solve(at("grow")), { type: "next" })
    expect(currentPartArrays(after)).toBe("grow-summary")
  })
})
```

Replace the first test of the gate/flame/completion `describe` block (currently lines ~227-233) with:

```ts
  it("completes only after all 7 graded beats; combo spans every correct check", () => {
    const s = happyPath()
    expect(gradedCleared(s)).toBe(7)
    expect(isCompleteArrays(s)).toBe(true)
    expect(s.completed).toBe(true)
    expect(s.combo).toBe(7) // jump, scan, insert, delete, place, realworld, grow
  })
```

Replace the resume/progress `describe` block (currently lines ~253-305) with:

```ts
describe("Arrays: resume / progress", () => {
  it("squashes to the 7-skill counters map (plus attempts)", () => {
    const p = toProgressArrays(happyPath())
    expect(p.counters).toEqual({
      accessIndex: 1,
      accessScan: 1,
      insertCount: 1,
      deleteCount: 1,
      placeCheapest: 1,
      realworld: 1,
      grow: 1,
      attempts: 7,
    })
    expect(p.completed).toBe(true)
  })

  it("restores the persisted part + counts with a cold combo", () => {
    const s = resumeArrays(
      { counters: { accessIndex: 1, accessScan: 1 }, currentPart: "insert", completed: false },
      SEED,
    )
    expect(currentPartArrays(s)).toBe("insert")
    expect(s.accessIndex).toBe(1)
    expect(s.accessScan).toBe(1)
    expect(s.combo).toBe(0)
    expect(hasProgressArrays(s)).toBe(true)
  })

  it("migrates an old run: maps old counters, drops removed skills, unknown part restarts", () => {
    const migrated = resumeArrays(
      {
        counters: { a1: 1, a3: 1, a2: 1, a2Skin: 1, a4: 1, a5: 1, a6Grow: 1, a6Cheap: 1 },
        currentPart: "a6-grow",
        completed: false,
      },
      SEED,
    )
    expect(currentPartArrays(migrated)).toBe("play-access") // unknown part -> restart
    expect(migrated.accessIndex).toBe(1)
    expect(migrated.accessScan).toBe(1)
    expect(migrated.insertCount).toBe(1)
    expect(migrated.realworld).toBe(1)
    expect(migrated.placeCheapest).toBe(1)
    expect(migrated.grow).toBe(1)
    expect(migrated.deleteCount).toBe(0) // new skill, re-earned
    expect(gradedCleared(migrated)).toBe(6) // a6Cheap/growVerdict is no longer a skill

    const done = resumeArrays({ counters: {}, currentPart: "resize", completed: true }, SEED)
    expect(done.completed).toBe(true) // a finished old run stays finished
  })
})
```

- [ ] **Step 2: Run the engine tests to verify they fail**

Run: `npx vitest run src/features/lesson/arraysEngine.test.ts`
Expected: FAIL (e.g. `ARRAYS_TOTAL_PARTS` is 10 not 11, `grow-summary` not a part, `growVerdict` still present).

- [ ] **Step 3: Restructure parts, skills, and state in `arraysEngine.ts`**

Replace `ARRAYS_PARTS` (currently lines ~36-47) with:

```ts
export const ARRAYS_PARTS = [
  "play-access", // 1 free play: tap to read, jump to an index (intro)
  "jump", // 2 de-cued "go to index k" - one hop (graded)
  "scan", // 3 same idea inverted: search a value by walking the row (graded)
  "play-mutate", // 4 free play: insert into a gap / delete a cell, watch the ripple (intro)
  "insert", // 5 predict the insert shift count (graded)
  "delete", // 6 predict the delete shift count (graded)
  "place-cheapest", // 7 drop one cell where it costs least (meaningful gap drag) (graded)
  "realworld", // 8 spreadsheet row insert/delete: the same shift, concrete (graded)
  "teach-grow", // 9 dynamic-array setup: a full block rejects a new cell (intro)
  "grow", // 10 capacity full: pick the cleanest fix (double + copy) (graded)
  "grow-summary", // 11 average-cost summary: doubling vs grow-by-one (intro)
] as const
```

Replace `ARRAYS_SKILLS` (currently lines ~51-63) with:

```ts
/** The 7 graded sub-skills; mastery = all 7 cleared. */
export const ARRAYS_SKILLS = [
  "accessIndex",
  "accessScan",
  "insertCount",
  "deleteCount",
  "placeCheapest",
  "realworld",
  "grow",
] as const
export type ArraysSkill = (typeof ARRAYS_SKILLS)[number]
export const ARRAYS_GATE = ARRAYS_SKILLS.length // 7
```

In `interface ArraysState`, delete the `growVerdict: number` field and the `step: number` field (and its comment). The graded-counters comment becomes `// the 7 graded counters (each 0 | 1)`.

- [ ] **Step 4: Reframe `makeGrow`, delete `makeGrowVerdict`, add the `grow-summary` intro**

Replace `makeGrow` (currently lines ~458-489) with:

```ts
/** `grow` (beat 10): pick the cleanest fix for a full block (always double + copy). */
function makeGrow(seed: number): { question: ArraysQuestion; next: number } {
  let a = seed
  // Capacity 4 (doubling to 8) keeps the backing block legible on a phone.
  const capacity = 4
  const size = capacity // seeded full so the synthesis always plays
  const sh = shuffle(
    [
      { id: "grow", label: "Make a block twice as big and copy everything over" },
      { id: "inplace", label: "Drop it in the next slot" },
      { id: "growone", label: "Make a block one bigger and copy everything over" },
    ],
    a,
  )
  a = sh.next
  return {
    question: {
      kind: "grow",
      prompt: "The block is full. What's the cleanest way to make room for one more?",
      cells: LETTERS.slice(0, size),
      options: sh.result,
      answer: "grow",
      resize: { size, capacity, resizes: true },
      cost: { word: "usually free", count: size, unit: "items copied" },
      hint: "",
      nudge: "There's no next slot. The block has to move somewhere bigger first.",
      correct: `Right: it doubles to ${capacity * 2} and copies all ${capacity} across.`,
      why: "A full block has no room, so it makes a bigger one and copies every item over. Make it twice as big and those copies stay rare. Usually free, with the occasional big reshuffle.",
    },
    next: a,
  }
}
```

Delete the entire `makeGrowVerdict` function (currently lines ~491-521).

In `makeIntro` (currently lines ~204-233), add a `grow-summary` branch. Replace the function body's tail so it reads:

```ts
  if (part === "teach-grow") {
    return {
      ...base,
      kind: "teach-grow",
      prompt: "Real arrays have a fixed size. What happens when you append past the end?",
    }
  }
  if (part === "grow-summary") {
    return {
      ...base,
      kind: "grow-summary",
      prompt: "Across many appends, what does growing actually cost on average?",
    }
  }
  return {
    ...base,
    kind: "play-mutate",
    prompt: "Drop a cell into a gap, or remove one, and watch the rest slide over.",
  }
}
```

- [ ] **Step 5: Add `grow-summary` to the intro set and update construction**

Replace `INTRO_PARTS` (currently line ~533) with:

```ts
const INTRO_PARTS = new Set<ArraysPart>([
  "play-access",
  "play-mutate",
  "teach-grow",
  "grow-summary",
])
```

In `enterPart` (currently lines ~539-581), remove `step: 0` from the `base` object, and make the `grow` case explicit. The switch's terminal section becomes:

```ts
    case "realworld": {
      const { question, next } = makeRealworld(state.rngState)
      return { ...base, question, rngState: next }
    }
    case "grow": {
      const { question, next } = makeGrow(state.rngState)
      return { ...base, question, rngState: next }
    }
    default:
      return base
  }
}
```

In `createArrays` (currently lines ~583-608), delete the `growVerdict: 0,` line and the `step: 0,` line from the init object.

- [ ] **Step 6: Simplify `beatSkill` and the reducer (`continue` / `next` / `reattempt`)**

In `beatSkill` (currently lines ~613-633), replace the `grow` case with:

```ts
    case "grow":
      return "grow"
```

In `arraysReducer`, replace the `continue` case (currently lines ~639-643) with one that completes the lesson on the final intro beat:

```ts
    case "continue": {
      if (isGradedPartArrays(part)) return state // graded beats advance via `next`
      if (state.partIndex >= ARRAYS_TOTAL_PARTS - 1) {
        return { ...state, ...FRESH, completed: true } // finishing grow-summary completes
      }
      return enterPart(state, state.partIndex + 1)
    }
```

In the `reattempt` case, replace the `grow` branch (currently lines ~716-723) with a single fresh ask:

```ts
        case "grow": {
          const { question, next } = makeGrow(state.rngState)
          return { ...state, ...FRESH, question, rngState: next }
        }
```

Replace the entire `next` case (currently lines ~729-743) with:

```ts
    case "next": {
      if (state.feedback !== "correct") return state
      if (state.partIndex >= ARRAYS_TOTAL_PARTS - 1) {
        return { ...state, ...FRESH, completed: true }
      }
      return enterPart(state, state.partIndex + 1)
    }
```

- [ ] **Step 7: Update progress + resume migration**

In `toProgressArrays` (currently lines ~976-992), delete the `growVerdict: s.growVerdict,` line from the `counters` object.

In `resumeArrays` (currently lines ~999-1021), delete the `growVerdict: clampUnit(c.growVerdict ?? c.a6Cheap),` line. Leave the rest of the migration intact (old `a6Cheap`/`growVerdict` counters are simply ignored, never read).

- [ ] **Step 8: Run the engine tests to verify they pass**

Run: `npx vitest run src/features/lesson/arraysEngine.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck the engine consumers**

Run: `npx tsc -b`
Expected: PASS. (If `src/dev/GalleryApp.tsx` errors on the removed `grow-verdict` preset or `growVerdict`, that is fixed in Task 8; for now you may temporarily expect that single file to error, but prefer to do Task 8's gallery edit before the final typecheck. The engine, `arrays.tsx`, and `analytics.ts` must compile.)

- [ ] **Step 10: Commit**

```bash
git add src/features/lesson/arraysEngine.ts src/features/lesson/arraysEngine.test.ts
git commit -m "feat(arrays): single-ask grow + grow-summary beat (drop growVerdict)"
```

---

## Task 2: Pure amortized tally helper (`appendRun`)

Add a deterministic helper that simulates a run of appends under doubling vs grow-by-one, so the summary figure's numbers are real and unit-tested.

**Files:**
- Modify: `src/features/lesson/arraysEngine.ts`
- Test: `src/features/lesson/arraysEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this block at the end of `src/features/lesson/arraysEngine.test.ts` (and add `appendRun` to the imports from `./arraysEngine` at the top of the file):

```ts
describe("Arrays: appendRun (amortized tally)", () => {
  it("doubling copies 7 items across 8 appends (rare, growing copies)", () => {
    const run = appendRun(8, "double")
    expect(run.count).toBe(8)
    expect(run.steps).toHaveLength(8)
    expect(run.totalCopied).toBe(7)
    expect(run.steps.map((s) => s.copied)).toEqual([0, 1, 2, 0, 4, 0, 0, 0])
    expect(run.steps.filter((s) => s.grew).map((s) => s.n)).toEqual([2, 3, 5])
  })

  it("grow-by-one copies 28 items across 8 appends (a copy almost every time)", () => {
    const run = appendRun(8, "plusOne")
    expect(run.totalCopied).toBe(28)
    expect(run.steps.map((s) => s.copied)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it("is pure: identical args yield identical runs", () => {
    expect(appendRun(8, "double")).toEqual(appendRun(8, "double"))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/lesson/arraysEngine.test.ts`
Expected: FAIL with "appendRun is not exported" / "not a function".

- [ ] **Step 3: Implement `appendRun`**

Add to `src/features/lesson/arraysEngine.ts`, in the "frame selectors (pure, view-only)" section (e.g. right after `resizeFrames`):

```ts
/** One append in a run: how many items it had to copy, and whether it grew. */
export interface AppendStep {
  n: number // 1-based append number
  copied: number // items copied on this append (0 if it just lands)
  grew: boolean // whether this append triggered a grow
}

/** A whole run of appends under one growth policy. */
export interface AmortizedRun {
  steps: AppendStep[]
  totalCopied: number
  count: number
}

/**
 * Deterministic amortized tally: append `count` items into a block that starts at
 * `startCapacity`, growing by the policy when full ("double" = capacity * 2,
 * "plusOne" = capacity + 1). A grow copies every current item, so `totalCopied`
 * is the headline cost. PURE and view-only: same args, same run. Used by the
 * grow-summary figure to contrast doubling (rare copies) with grow-by-one (a copy
 * on almost every append).
 */
export function appendRun(
  count: number,
  mode: "double" | "plusOne",
  startCapacity = 1,
): AmortizedRun {
  let capacity = Math.max(1, startCapacity)
  let size = 0
  let totalCopied = 0
  const steps: AppendStep[] = []
  for (let n = 1; n <= count; n++) {
    let copied = 0
    let grew = false
    if (size === capacity) {
      grew = true
      copied = size
      capacity = mode === "double" ? capacity * 2 : capacity + 1
    }
    totalCopied += copied
    size += 1
    steps.push({ n, copied, grew })
  }
  return { steps, totalCopied, count }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/lesson/arraysEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lesson/arraysEngine.ts src/features/lesson/arraysEngine.test.ts
git commit -m "feat(arrays): pure appendRun amortized tally helper"
```

---

## Task 3: `FullBlockReject` component + upgraded memory teach (beat 9)

Add a view-only reject animation (a full block bounces a new cell) and wire it into `TeachGrowPart`.

**Files:**
- Modify: `src/lessons/arrays/CapacityFrame.tsx`
- Modify: `src/lessons/arrays/Stage.tsx` (`TeachGrowPart`)
- Test: `src/lessons/arrays/Stage.test.tsx`

- [ ] **Step 1: Write the failing DOM test**

Add to `src/lessons/arrays/Stage.test.tsx`:

```ts
describe("Arrays stage: teach-grow shows a full block rejecting a new cell", () => {
  it("renders the reject figure and lands on the 'no room' end-state", () => {
    render(<Harness initial={at("teach-grow")} />)
    expect(screen.getByTestId("full-block-reject")).toBeInTheDocument()
    expect(screen.getByText(/No room/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx`
Expected: FAIL ("Unable to find ... full-block-reject").

- [ ] **Step 3: Add `FullBlockReject` to `CapacityFrame.tsx`**

At the top of `src/lessons/arrays/CapacityFrame.tsx`, add `Fragment` to the React import surface (add a new line):

```ts
import { Fragment } from "react"
```

Append this exported component to the end of `src/lessons/arrays/CapacityFrame.tsx` (it reuses the private `Block`):

```tsx
/**
 * Beat 9 memory teach: a full backing block, and a new item that tries to drop in
 * but bounces off because there is no slot (shake + a red flash, repeated once).
 * Reduced motion snaps to the static rejected end-state. Pure and view-only.
 */
export function FullBlockReject({
  cells,
  reduced,
}: {
  cells: string[]
  reduced?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const capacity = cells.length
  return (
    <div className="flex flex-col items-center gap-3" data-testid="full-block-reject">
      <Block
        slots={capacity}
        fill={cells}
        reduced={isReduced}
        label={`Backing block · ${capacity} of ${capacity}`}
      />
      <div className="flex items-center gap-2">
        <motion.span
          data-testid="reject-incoming"
          className="flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-bold text-amber-900"
          initial={false}
          animate={
            isReduced
              ? { backgroundColor: "#fecaca" }
              : { x: [0, 34, 6, 0], backgroundColor: ["#fde68a", "#fecaca", "#fecaca", "#fde68a"] }
          }
          transition={
            isReduced
              ? { duration: 0 }
              : { duration: 1.2, repeat: 1, repeatDelay: 0.5, ease: "easeInOut" }
          }
        >
          {NEW_LABEL}
        </motion.span>
        <span className="text-xs font-bold uppercase tracking-wide text-danger">No room</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Upgrade `TeachGrowPart` in `Stage.tsx`**

In `src/lessons/arrays/Stage.tsx`, update the `CapacityFrame` import line to also import the new component:

```ts
import { CapacityFrame, FullBlockReject } from "./CapacityFrame"
```

Replace the `TeachGrowPart` function (currently lines ~826-860) with:

```tsx
function TeachGrowPart({ dispatch }: { dispatch: Dispatch<LessonAction> }) {
  return (
    <StageCenter maxWidthClass="max-w-xl">
      <div className="mt-8 text-center animate-fade-in">
        <Eyebrow>Dynamic arrays</Eyebrow>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
          When the block fills up
        </h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-6">
        <FullBlockReject cells={["A", "B", "C", "D"]} />
        <p className="mx-auto max-w-md text-pretty text-center text-xl leading-relaxed text-foreground/90 lg:text-2xl">
          Real memory hands you one{" "}
          <span className="concept" style={{ animationDelay: "200ms" }}>
            fixed-size
          </span>{" "}
          block up front: it only holds so many cells. When it is full a new item has{" "}
          <span className="concept" style={{ animationDelay: "650ms" }}>
            nowhere to go
          </span>
          , so a new, bigger block has to be made. How would you make room for one more?
        </p>
      </div>

      <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
        Continue
      </Button>
    </StageCenter>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx`
Expected: PASS (the reject test passes; existing tests stay green).

- [ ] **Step 6: Lint + commit**

Run: `npm run lint`

```bash
git add src/lessons/arrays/CapacityFrame.tsx src/lessons/arrays/Stage.tsx src/lessons/arrays/Stage.test.tsx
git commit -m "feat(arrays): animated full-block reject on the grow teach beat"
```

---

## Task 4: `GrowByOneLoop` component (repetitive-copy visual)

Add a view-only component that shows grow-by-one re-copying everything again and again. Used by `GrowPart` on the `growone` wrong answer (Task 6).

**Files:**
- Modify: `src/lessons/arrays/CapacityFrame.tsx`
- Test: `src/lessons/arrays/Stage.test.tsx` (a focused render test via a tiny harness)

- [ ] **Step 1: Write the failing DOM test**

Add to `src/lessons/arrays/Stage.test.tsx` (add `GrowByOneLoop` to the imports; it comes from the lesson's `./CapacityFrame`, so import it directly):

```ts
import { GrowByOneLoop } from "./CapacityFrame"

describe("Arrays stage: GrowByOneLoop conveys repeated copying", () => {
  it("renders a growing run of blocks and the 'again' caption", () => {
    render(<GrowByOneLoop start={4} steps={3} />)
    expect(screen.getByTestId("grow-by-one-loop")).toBeInTheDocument()
    expect(screen.getByText(/copy everything again\. And again\./i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx`
Expected: FAIL ("GrowByOneLoop is not exported").

- [ ] **Step 3: Add `GrowByOneLoop` to `CapacityFrame.tsx`**

Append to `src/lessons/arrays/CapacityFrame.tsx`:

```tsx
/**
 * Beat 10 wrong-answer (growone) visual: grow the block by ONE slot, copy
 * everything, then do it all again for the next item, and the next. A staggered
 * sequence of ever-bigger fully-copied blocks makes the repetition felt. Reduced
 * motion shows the whole sequence at once. Pure and view-only.
 */
export function GrowByOneLoop({
  start = 4,
  steps = 3,
  reduced,
}: {
  start?: number
  steps?: number
  reduced?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const MINI = 16
  const sizes = Array.from({ length: steps + 1 }, (_, i) => start + i)
  return (
    <div className="flex flex-col items-center gap-2" data-testid="grow-by-one-loop">
      <div className="flex items-end gap-1.5 overflow-x-auto">
        {sizes.map((size, i) => (
          <Fragment key={size}>
            {i > 0 && (
              <motion.span
                aria-hidden
                className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-danger"
                initial={isReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={isReduced ? { duration: 0 } : { delay: i * 0.55 }}
              >
                copy {size - 1}
              </motion.span>
            )}
            <motion.div
              className="flex"
              initial={isReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={isReduced ? { duration: 0 } : { delay: i * 0.55 + 0.2 }}
            >
              {Array.from({ length: size }).map((_, s) => (
                <div
                  key={s}
                  className="box-border border-y-2 border-l-2 first:rounded-l-md last:rounded-r-md last:border-r-2"
                  style={{ width: MINI, height: MINI }}
                >
                  <span
                    className={cn(
                      "block size-full",
                      s === size - 1 ? "bg-amber-300" : "bg-lilac-soft",
                    )}
                  />
                </div>
              ))}
            </motion.div>
          </Fragment>
        ))}
      </div>
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Grow by one and the next item makes you copy everything again. And again.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`

```bash
git add src/lessons/arrays/CapacityFrame.tsx src/lessons/arrays/Stage.test.tsx
git commit -m "feat(arrays): GrowByOneLoop repetitive-copy visual"
```

---

## Task 5: Poly backend (arrays rubric + grow skill mapping + hint branch)

Teach the backend hint generator about the arrays grow concept, withholding the "double / proportional" idea so the model never leaks the fix. Commit these `functions/` changes on their own (see the coordination note).

**Files:**
- Modify: `functions/src/poly/rubrics.ts` (+ `functions/src/poly/rubrics.test.ts`)
- Modify: `functions/src/poly/skillMap.ts` (+ `functions/src/poly/skillMap.test.ts`)
- Modify: `functions/src/poly/hint.ts` (+ `functions/src/poly/hint.test.ts`)

- [ ] **Step 1: Write failing backend tests**

Add to `functions/src/poly/rubrics.test.ts` (inside `describe("rubrics", ...)`):

```ts
  it("exposes an arrays rubric with three token-bearing propositions", () => {
    const arrays = rubricFor("arrays")
    expect(arrays?.conceptId).toBe("arrays")
    expect(arrays?.propositions.map((p) => p.id)).toEqual(["P1", "P2", "P3"])
  })
```

Add to `functions/src/poly/skillMap.test.ts` (inside `describe("skillMap", ...)`):

```ts
  it("maps the arrays grow skill to the arrays concept and its withheld propositions", () => {
    expect(targetsForSkill("grow")).toEqual({
      conceptId: "arrays",
      propositionIds: ["P2", "P3"],
    })
  })
```

Add to `functions/src/poly/hint.test.ts` (inside `describe("generateHint", ...)`):

```ts
  const growBase = {
    stageId: "arrays",
    skill: "grow",
    discipline: "array" as const,
    learnerOrder: ["grow the block by one slot"],
  }

  it("builds a grow hint from the arrays concept and never states the fix", async () => {
    const c = completer("What happens the very next time you add one after that?")
    const res = await generateHint(c, "m", growBase)
    expect(res.hint).toBe("What happens the very next time you add one after that?")
    const call = (c.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.user).toContain("grow the block by one slot")
    expect(call.user).toContain("Never state the fix")
  })

  it("rejects a grow hint that leaks the doubling fix, then regenerates", async () => {
    // "double" is a withheld P3 token for the arrays grow skill -> first is rejected.
    const c = completer("Just double the block.", "Think about the next add, and the one after.")
    const res = await generateHint(c, "m", growBase)
    expect(res.hint).toBe("Think about the next add, and the one after.")
    expect(c.complete).toHaveBeenCalledTimes(2)
  })
```

- [ ] **Step 2: Run the backend tests to verify they fail**

Run: `cd functions && npx vitest run src/poly/rubrics.test.ts src/poly/skillMap.test.ts src/poly/hint.test.ts; cd ..`
Expected: FAIL (no arrays rubric, `grow` unmapped, `discipline: "array"` is a type error / branch missing).

- [ ] **Step 3: Add the arrays rubric**

In `functions/src/poly/rubrics.ts`, add this rubric (after `queuesRubric`) and register it in `RUBRICS`:

```ts
const arraysRubric: Rubric = {
  conceptId: "arrays",
  propositions: [
    {
      id: "P1",
      text: "A full fixed-size block has no spare room for another item",
      answerTokens: ["no spare room", "no room", "no free slot", "no space", "already full"],
    },
    {
      id: "P2",
      text: "Growing by a fixed small amount forces a copy on almost every later append",
      answerTokens: [
        "copy every time",
        "copy each time",
        "copy again each time",
        "copy on every",
        "every append",
        "recopy",
        "over and over",
        "again and again",
      ],
    },
    {
      id: "P3",
      text: "A proportionally bigger block makes copies rare",
      answerTokens: [
        "double",
        "twice as big",
        "twice the size",
        "proportional",
        "bigger block makes",
        "rarely",
        "rare",
      ],
    },
  ],
}
```

Update `RUBRICS`:

```ts
export const RUBRICS: Record<string, Rubric> = {
  stacks: stacksRubric,
  queues: queuesRubric,
  arrays: arraysRubric,
}
```

- [ ] **Step 4: Map the `grow` skill**

In `functions/src/poly/skillMap.ts`, add the `grow` entry to `skillTargets`:

```ts
export const skillTargets: Record<string, SkillTarget> = {
  stackConstruct: { conceptId: "stacks", propositionIds: ["P1", "P3"] },
  queueConstruct: { conceptId: "queues", propositionIds: ["P1", "P3"] },
  // Arrays grow: the learner who picks "grow by one" violates P2 (copies pile up)
  // and implicates P3 (a proportionally bigger block keeps copies rare). Both are
  // withheld so the model nudges without naming "double".
  grow: { conceptId: "arrays", propositionIds: ["P2", "P3"] },
}
```

- [ ] **Step 5: Relax `discipline` and add the grow prompt branch in `hint.ts`**

In `functions/src/poly/hint.ts`, change the `discipline` field on `HintArgs` to:

```ts
  discipline: "stack" | "queue" | "array"
```

In `buildUser`, add an arrays branch BEFORE the existing `diagnosis`/generic returns (so the grow path is distinct). Insert right after the `const prior = ...` line:

```ts
  if (args.discipline === "array") {
    return (
      `Structure: a fixed-size memory block that is full.\n` +
      `The learner was asked the cleanest way to make room for one more item.\n` +
      `They chose: ${args.learnerOrder.join(", ")}.\n` +
      `Concept(s) they violated: ${concepts}\n` +
      `Write a hint that makes them feel this choice repeats the same work on the next add, and the next. ` +
      `Never state the fix and never say how much bigger to make the block.${prior}`
    )
  }
```

- [ ] **Step 6: Run the backend tests + typecheck to verify they pass**

Run: `cd functions && npx vitest run src/poly/rubrics.test.ts src/poly/skillMap.test.ts src/poly/hint.test.ts && npx tsc --noEmit; cd ..`
Expected: PASS and clean typecheck.

- [ ] **Step 7: Commit (functions only)**

```bash
git add functions/src/poly/rubrics.ts functions/src/poly/rubrics.test.ts functions/src/poly/skillMap.ts functions/src/poly/skillMap.test.ts functions/src/poly/hint.ts functions/src/poly/hint.test.ts
git commit -m "feat(poly): arrays grow hint concept (withhold the doubling fix)"
```

---

## Task 6: Client Poly types + `GrowPart` rework (branch + live hint)

Relax the client hint `discipline` to include `"array"`, then rework `GrowPart` to branch on the chosen option: correct reveals the doubling, `growone` plays `GrowByOneLoop` and fires a live Poly hint, `inplace` nudges.

**Files:**
- Modify: `src/lib/ai/polyClient.ts`
- Modify: `src/lib/ai/usePolyHint.ts` (+ `src/lib/ai/usePolyHint.test.tsx`)
- Modify: `src/lessons/arrays/Stage.tsx` (`GrowPart`)
- Test: `src/lessons/arrays/Stage.test.tsx`

- [ ] **Step 1: Relax the client `discipline` type**

In `src/lib/ai/polyClient.ts`, change the `HintRequest.discipline` field to:

```ts
  discipline: "stack" | "queue" | "array"
```

In `src/lib/ai/usePolyHint.ts`, change the `discipline` field on `UsePolyHintArgs` to:

```ts
  discipline: "stack" | "queue" | "array"
```

- [ ] **Step 2: Add a hook test for the array discipline (write failing test)**

Add to `src/lib/ai/usePolyHint.test.tsx`:

```ts
  it("forwards the array discipline and the chosen wrong option", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValue({ hint: "again and again" })
    const { result } = renderHook(() =>
      usePolyHint({
        stageId: "arrays",
        skill: "grow",
        discipline: "array",
        wrongAttempt: { id: 1, learnerOrder: ["grow the block by one slot"] },
        requestHint,
      }),
    )
    await waitFor(() => expect(result.current.text).toBe("again and again"))
    expect(requestHint.mock.calls[0][0]).toMatchObject({
      discipline: "array",
      skill: "grow",
      learnerOrder: ["grow the block by one slot"],
    })
  })
```

- [ ] **Step 3: Run the hook test to verify it passes**

Run: `npx vitest run src/lib/ai/usePolyHint.test.tsx`
Expected: PASS (the hook is generic; the type relax is all that was needed). If it fails to typecheck before the relax, that confirms Step 1 was required.

- [ ] **Step 4: Write the failing GrowPart DOM tests**

In `src/lessons/arrays/Stage.tsx` is the only arrays consumer of `usePolyHint`, so mock the hook in the stage test to keep Firebase out and make the hint deterministic. At the TOP of `src/lessons/arrays/Stage.test.tsx`, add `vi` to the vitest import and add the mock (place the `vi.mock` immediately after the imports):

```ts
import { describe, it, expect, beforeAll, vi } from "vitest"
```

```ts
// Mock the live Poly hook: deterministic, no Firebase. It returns hint text only
// when a wrong attempt is in flight (GrowPart only sets one for the "growone"
// answer), so the inplace path falls through to the static nudge.
vi.mock("@/lib/ai/usePolyHint", () => ({
  usePolyHint: ({ wrongAttempt }: { wrongAttempt: { id: number } | null }) => ({
    loading: false,
    text: wrongAttempt ? "Picture doing that copy for the next item, and the next." : null,
  }),
}))
```

Add these tests to `src/lessons/arrays/Stage.test.tsx`:

```ts
describe("Arrays stage: grow (cleanest fix, branching consequences)", () => {
  const growoneCard = () =>
    screen.getByRole("button", { name: /Make a block one bigger and copy everything over/ })
  const inplaceCard = () => screen.getByRole("button", { name: /Drop it in the next slot/ })

  it("growone plays the repetitive-copy loop and shows the live Poly hint, then lets you retry", () => {
    render(<Harness initial={at("grow")} />)

    fireEvent.click(growoneCard())
    fireEvent.click(screen.getByRole("button", { name: "Check" }))

    // wrong (growone): the repetitive-copy loop and the AI hint both appear
    expect(screen.getByTestId("grow-by-one-loop")).toBeInTheDocument()
    expect(
      screen.getByText("Picture doing that copy for the next item, and the next."),
    ).toBeInTheDocument()

    // retry with the correct fix: the doubling reveal lands and the lesson can continue
    fireEvent.click(document.querySelector('[data-answer="1"]') as HTMLElement)
    fireEvent.click(screen.getByRole("button", { name: "Check" }))
    expect(screen.getByText("Doubled to 8 · copied 4")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("inplace nudges with the static line and never shows the loop or an AI hint", () => {
    render(<Harness initial={at("grow")} />)

    fireEvent.click(inplaceCard())
    fireEvent.click(screen.getByRole("button", { name: "Check" }))

    expect(screen.queryByTestId("grow-by-one-loop")).toBeNull()
    expect(
      screen.queryByText("Picture doing that copy for the next item, and the next."),
    ).toBeNull()
    expect(
      screen.getByText("There's no next slot. The block has to move somewhere bigger first."),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the DOM tests to verify they fail**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx`
Expected: FAIL (GrowPart does not yet branch / call the hook).

- [ ] **Step 6: Rework `GrowPart` in `Stage.tsx`**

In `src/lessons/arrays/Stage.tsx`, add the hook import near the other imports:

```ts
import { usePolyHint } from "@/lib/ai/usePolyHint"
```

Update the `CapacityFrame` import to also bring in `GrowByOneLoop`:

```ts
import { CapacityFrame, FullBlockReject, GrowByOneLoop } from "./CapacityFrame"
```

Replace the entire `GrowPart` function (currently lines ~864-919) with:

```tsx
function GrowPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const prefersReduced = useReducedMotion()
  const reduced = prefersReduced ?? false
  const q = state.question
  const wrong = state.feedback === "nudge" || state.feedback === "fail"
  const wrongGrowOne = wrong && state.selected === "growone"

  // Live Poly hint: fire ONLY on a "grow by one" wrong attempt. The chosen option
  // rides along as the learner's order; the backend withholds the doubling fix.
  // (Hooks run before any early return so the order stays stable across renders.)
  const aiHint = usePolyHint({
    stageId: "arrays",
    skill: "grow",
    discipline: "array",
    wrongAttempt: wrongGrowOne
      ? { id: state.attempts, learnerOrder: ["grow the block by one slot"] }
      : null,
  })

  if (!q || !q.options) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalA(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)

  return (
    <StageSplit
      header={
        <>
          <Header kicker="Grow · dynamic array" prompt={q.prompt} />
          <Quota state={state} />
        </>
      }
      figure={
        <div className="flex flex-col items-center gap-3 py-4">
          {reveal && q.resize ? (
            <CapacityFrame resize={q.resize} cells={q.cells} reveal={reveal} />
          ) : wrongGrowOne ? (
            <GrowByOneLoop start={q.cells.length} reduced={reduced} />
          ) : q.resize ? (
            <motion.div
              key={wrong ? state.attempts : "idle"}
              animate={
                wrong && !reduced ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }
              }
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              <CapacityFrame resize={q.resize} cells={q.cells} reveal={false} />
            </motion.div>
          ) : null}
          {reveal && <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />}
        </div>
      }
      interaction={
        <>
          <div className="flex flex-col gap-2.5">
            {q.options.map((opt, i) => (
              <AnswerCard
                key={opt.id}
                letter={String.fromCharCode(65 + i)}
                label={opt.label}
                state={mcqCardState(opt.id, q.answer, selected, feedback, showWhy)}
                disabled={terminal}
                answerMarker={opt.id === q.answer}
                onSelect={() => dispatch({ type: "select", letter: opt.id })}
              />
            ))}
          </div>

          <FeedbackFooter
            feedback={feedback}
            selected={selected}
            showWhy={showWhy}
            hideFailHint
            copy={copyOf(q)}
            dispatch={dispatch}
            aiHint={aiHint}
          />
        </>
      }
    />
  )
}
```

- [ ] **Step 7: Run the DOM tests + typecheck to verify they pass**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx && npx tsc -b`
Expected: PASS (note `tsc -b` may still flag `src/dev/GalleryApp.tsx` until Task 8; the lesson + lib files must be clean).

- [ ] **Step 8: Lint + commit**

Run: `npm run lint`

```bash
git add src/lib/ai/polyClient.ts src/lib/ai/usePolyHint.ts src/lib/ai/usePolyHint.test.tsx src/lessons/arrays/Stage.tsx src/lessons/arrays/Stage.test.tsx
git commit -m "feat(arrays): branch grow consequences + live Poly hint on grow-by-one"
```

---

## Task 7: `GrowSummary` figure + `GrowSummaryPart` (beat 11)

Add the average-cost summary: a doubling tally plus a doubling-vs-grow-by-one contrast, then wire the new beat into the stage switch.

**Files:**
- Create: `src/lessons/arrays/GrowSummary.tsx`
- Modify: `src/lessons/arrays/Stage.tsx` (`ArraysStage` switch + `GrowSummaryPart`)
- Test: `src/lessons/arrays/Stage.test.tsx`

- [ ] **Step 1: Write the failing DOM test**

Add to `src/lessons/arrays/Stage.test.tsx`:

```ts
describe("Arrays stage: grow-summary contrasts doubling with grow-by-one", () => {
  it("renders the tally and both running totals, then completes on continue", () => {
    render(<Harness initial={at("grow-summary")} />)
    expect(screen.getByTestId("grow-summary")).toBeInTheDocument()
    expect(screen.getByText(/8 appends/i)).toBeInTheDocument()
    expect(screen.getByText("7 copies")).toBeInTheDocument()
    expect(screen.getByText("28 copies")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx`
Expected: FAIL (the `grow-summary` case is unhandled; the switch is non-exhaustive).

- [ ] **Step 3: Create `GrowSummary.tsx`**

Create `src/lessons/arrays/GrowSummary.tsx`:

```tsx
import { Fragment } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { appendRun } from "@/features/lesson/arraysEngine"

/**
 * The average-cost summary figure (beat 11). It runs the same 8 appends two ways:
 * doubling (rare, growing copies) and grow-by-one (a copy almost every time), then
 * contrasts the running totals. Numbers come from the pure `appendRun` helper, so
 * they are deterministic and unit-tested. Reveal animates in; reduced motion shows
 * it at rest. Pure and view-only (no Big-O, no "amortization" wording).
 */
const APPENDS = 8

export function GrowSummary({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const doubling = appendRun(APPENDS, "double")
  const plusOne = appendRun(APPENDS, "plusOne")
  const copies = doubling.steps.filter((s) => s.grew).length

  return (
    <div className="flex flex-col items-center gap-6" data-testid="grow-summary">
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5">
          {doubling.steps.map((s, i) => (
            <motion.div
              key={s.n}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-xs font-bold",
                s.grew ? "bg-amber-200 text-amber-900" : "bg-lilac-soft text-foreground",
              )}
              initial={isReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={isReduced ? { duration: 0 } : { delay: i * 0.08 }}
              title={s.grew ? `copied ${s.copied}` : "just landed"}
            >
              {s.grew ? s.copied : ""}
            </motion.div>
          ))}
        </div>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          {APPENDS} appends, only {copies} had to copy. Spread out, that is about one step each.
        </p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <ContrastColumn
          title="Double the block"
          total={doubling.totalCopied}
          blurb="copies stay rare"
          tone="good"
        />
        <ContrastColumn
          title="Grow by one"
          total={plusOne.totalCopied}
          blurb="copies pile up"
          tone="bad"
        />
      </div>
    </div>
  )
}

function ContrastColumn({
  title,
  total,
  blurb,
  tone,
}: {
  title: string
  total: number
  blurb: string
  tone: "good" | "bad"
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center",
        tone === "good" ? "border-success/40 bg-success-soft/40" : "border-danger/40 bg-danger-soft/40",
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "good" ? "text-success" : "text-danger",
        )}
      >
        {total} copies
      </span>
      <span className="text-xs text-muted-foreground">{blurb}</span>
    </div>
  )
}
```

(The `Fragment` import is harmless if unused; remove it if oxlint flags it. If oxlint reports it as unused, drop the `Fragment` import line.)

- [ ] **Step 4: Add `GrowSummaryPart` and the switch case in `Stage.tsx`**

In `src/lessons/arrays/Stage.tsx`, add the import:

```ts
import { GrowSummary } from "./GrowSummary"
```

In the `ArraysStage` switch (currently lines ~41-60), add a case after `grow`:

```tsx
    case "grow":
      return <GrowPart state={state} dispatch={dispatch} />
    case "grow-summary":
      return <GrowSummaryPart dispatch={dispatch} />
  }
}
```

Add the `GrowSummaryPart` component (place it right after `GrowPart`, at the end of the file):

```tsx
/* ----------------------------- grow: average-cost summary ----------------------------- */

/**
 * The closing teach page: most appends just land, and the rare copy is shared
 * across all of them, so doubling is cheap on average; grow-by-one pays a copy
 * almost every time. Finishing it completes the lesson.
 */
function GrowSummaryPart({ dispatch }: { dispatch: Dispatch<LessonAction> }) {
  return (
    <StageCenter maxWidthClass="max-w-xl">
      <div className="mt-8 text-center animate-fade-in">
        <Eyebrow>Dynamic arrays</Eyebrow>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground lg:text-5xl">
          What it costs on average
        </h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 py-6">
        <GrowSummary />
        <p className="mx-auto max-w-md text-pretty text-center text-xl leading-relaxed text-foreground/90 lg:text-2xl">
          Most appends just{" "}
          <span className="concept" style={{ animationDelay: "200ms" }}>
            land
          </span>
          , and the rare copy is shared across all of them. Grow by one and you pay a copy almost
          every time. That is why arrays{" "}
          <span className="concept" style={{ animationDelay: "650ms" }}>
            double
          </span>
          .
        </p>
      </div>

      <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
        Continue
      </Button>
    </StageCenter>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lessons/arrays/Stage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

Run: `npm run lint`

```bash
git add src/lessons/arrays/GrowSummary.tsx src/lessons/arrays/Stage.tsx src/lessons/arrays/Stage.test.tsx
git commit -m "feat(arrays): average-cost summary beat (doubling vs grow-by-one)"
```

---

## Task 8: Integration surfaces (registry, gallery, e2e tracer)

Bring the progress registry, dev gallery, and e2e flow in line with the new 11-beat / 7-skill shape.

**Files:**
- Modify: `src/features/progress/concepts.ts`
- Modify: `src/dev/GalleryApp.tsx`
- Modify: `e2e/tracer.spec.ts`
- Test: `src/features/progress/concepts.test.ts` (no edit needed; it is a drift guard that should now pass)

- [ ] **Step 1: Drop `growVerdict` from the arrays sub-skill registry**

In `src/features/progress/concepts.ts`, update the `arrays` entry of `LESSON_SUBSKILLS` (currently lines ~21-30) to remove `"growVerdict"`:

```ts
  arrays: [
    "accessIndex",
    "accessScan",
    "insertCount",
    "deleteCount",
    "placeCheapest",
    "realworld",
    "grow",
  ],
```

- [ ] **Step 2: Refresh the gallery arrays presets**

In `src/dev/GalleryApp.tsx`, replace the `ARR_PRESETS` grow entries. Specifically, replace the three grow presets (currently the `grow`, `grow-correct`, and `grow-verdict` entries, lines ~454-460) with:

```ts
  { id: "teach-grow", label: "Teach · grow (reject)", make: () => arrAt("teach-grow") },
  { id: "grow", label: "Grow · idle", make: () => arrAt("grow") },
  {
    id: "grow-growone",
    label: "Grow · grow-by-one (hint + loop)",
    make: () => arrRun(arrAt("grow"), { type: "select", letter: "growone" }, { type: "check" }),
  },
  { id: "grow-correct", label: "Grow · correct (burst)", make: () => arrSolve(arrAt("grow")) },
  { id: "grow-summary", label: "Grow · summary", make: () => arrAt("grow-summary") },
```

- [ ] **Step 3: Update the e2e tracer's arrays grow flow**

In `e2e/tracer.spec.ts`, update the arrays section (currently lines ~277-289). Replace the comment block and the two grow lines:

```ts
  // Arrays (rebuild): play-access -> jump -> scan -> play-mutate -> insert -> delete ->
  // place-cheapest -> realworld -> teach-grow -> grow -> grow-summary. 7 graded beats.
  await continueOn(page) // play-access (read the strip)
  await answerCellTap(page) // jump (tap the de-cued cell)
  await walkScanArrays(page) // scan (walk the row until the value turns up)
  await continueOn(page) // play-mutate (insert/delete playground)
  await answerArrays(page) // insert (predict the shift count)
  await answerArrays(page) // delete (predict the shift count)
  await rewireInOrder(page) // place-cheapest (drop the cell on the cheapest gap)
  await answerArrays(page) // realworld (spreadsheet row shift)
  await continueOn(page) // teach-grow (full block rejects a new cell)
  await answerArrays(page) // grow (pick the cleanest fix: double + copy)
  await continueOn(page) // grow-summary (average-cost teach) -> completes the lesson
```

- [ ] **Step 4: Run the registry drift guard + typecheck**

Run: `npx vitest run src/features/progress/concepts.test.ts && npx tsc -b`
Expected: PASS, and `tsc -b` is now fully clean (the gallery's removed `growVerdict`/`grow-verdict` references are gone).

- [ ] **Step 5: Commit**

```bash
git add src/features/progress/concepts.ts src/dev/GalleryApp.tsx e2e/tracer.spec.ts
git commit -m "chore(arrays): align progress registry, gallery, and e2e to the grow rework"
```

---

## Task 9: Full verification + visual review

Run the whole suite, lint, and prototype the three new visuals in the live gallery for an eyeball review before declaring done.

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS (node + dom projects).

- [ ] **Step 2: Run the functions tests**

Run: `cd functions && npx vitest run && cd ..`
Expected: PASS.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc -b && (cd functions && npx tsc --noEmit && cd ..) && npm run lint`
Expected: all clean.

- [ ] **Step 4: Visual review in the live gallery**

The gallery is already running (`npm run gallery`, port 5174). It is frozen (HMR off), so refresh the tab to pull the new code. Open the Arrays lab and step through the new presets, then capture screenshots with the Playwright MCP (`browser_take_screenshot`) into `docs/reference/` (kebab-case names), per the use-playwright rule:
  - `teach-grow` -> `arrays-teach-grow-reject.png` (the full block + "No room").
  - `grow` idle -> `arrays-grow-idle.png` (the three reframed options).
  - `grow-growone` -> `arrays-grow-growone.png` (the GrowByOneLoop + "Poly is thinking..." or the live hint).
  - `grow-correct` -> `arrays-grow-correct.png` (the doubling burst + cost readout).
  - `grow-summary` -> `arrays-grow-summary.png` (the tally + the 7-vs-28 contrast).

Confirm with the user, then delete any screenshots that were only for this review (keep only ones worth retaining as reference).

- [ ] **Step 5: Optional e2e (emulator) smoke**

If the Java/emulator toolchain is available, run the wiring proof:
Run: `npm run e2e`
Expected: the tracer drives Arrays to "You mastered Arrays." If the emulator toolchain is unavailable in this environment, note it and rely on the unit/DOM coverage plus the visual review.

---

## Self-Review (completed by plan author)

**1. Spec coverage:**
- Beat 9 memory teach (animated reject): Task 3 (`FullBlockReject` + `TeachGrowPart`). Covered.
- Beat 10 reframed grow (single ask, seed-shuffled options, teachable wrong answers): Task 1 (`makeGrow`) + Task 6 (`GrowPart` branch). Covered.
- Beat 10 repetitive-copy visual: Task 4 (`GrowByOneLoop`) + Task 6 wiring. Covered.
- Beat 10 live Poly on `growone`: Task 5 (backend) + Task 6 (client + wiring). Covered.
- Beat 11 average-cost summary + pure tally: Task 2 (`appendRun`) + Task 7 (`GrowSummary` + `GrowSummaryPart`). Covered.
- Engine/state changes (parts/skills/total/intro/migration; drop `growVerdict`): Task 1. Covered.
- Mastery gate impact (7 not 8): Task 1 (engine, `ARRAYS_GATE` dynamic) + Task 8 (`concepts.ts`); `analytics.ts` reads `ARRAYS_GATE` so it adjusts automatically. Covered.
- Determinism + testing contract (engine, DOM, backend, gallery presets): Tasks 1, 2, 3, 4, 5, 6, 7, 8, 9. Covered.

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; every test step shows assertions; commands include expected outcomes.

**3. Type consistency:** `discipline: "stack" | "queue" | "array"` is widened in `polyClient.ts`, `usePolyHint.ts`, and `functions/.../hint.ts` together (Tasks 5, 6). Option ids stay `grow` / `inplace` / `growone` across engine, UI, and gallery. The new pure types `AppendStep` / `AmortizedRun` / `appendRun` are defined in Task 2 and consumed in Task 7. `FullBlockReject`, `GrowByOneLoop`, and `GrowSummary` are exported where defined and imported where used. State no longer carries `growVerdict` or `step`; every reader (engine reducer/selectors/progress, `concepts.ts`, gallery) is updated in Tasks 1 and 8.
