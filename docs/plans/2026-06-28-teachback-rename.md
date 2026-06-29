# Teach-back Rename & Finalize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the explain-it-back / "Poly checkpoint" feature to "Teach-back" without touching the unrelated retrieval and trials "checkpoint" systems, split into a mechanical rename (now) and a user-facing finalize (after the hint pipeline).

**Architecture:** Pure rename + copy change, in two parts. Part 1 renames code symbols (`PolyCheckpoint` to `Teachback`, the S&Q stage constants, the PolyLab symbols) and the Firestore subcollection (`checkpointExplanations` to `teachbackExplanations`), leaving every user-facing string unchanged. Part 2 (run after the hint pipeline) flips the user-facing surface: the "Quick check" label becomes "Teach-back", the prompt copy adopts the teach framing, and the video/docs branding follows. Behavior is unchanged throughout; verified by the existing component, stage, and emulator tests.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, Firebase Firestore (+ `@firebase/rules-unit-testing` for the emulator test), oxlint.

---

## Execution phasing (owner-chosen)

1. **Part 1 (mechanical rename) - run FIRST.** Rename code symbols + the Firestore collection. Keep ALL user-facing strings unchanged: the "Quick check" label, the current prompt copy, and the video/docs branding stay as-is. After Part 1 the component is named `Teachback` but still shows "Quick check".
2. **Then the hint pipeline plan** (`docs/plans/2026-06-28-poly-hint-edge-cache-pipeline.md`).
3. **Part 2 (Teach-back finalize) - run LAST.** Flip the user-facing label to "Teach-back", adopt the teach-framed prompt copy, and update video/docs branding + the e2e text.

## Scope guardrail (read first)

Rename ONLY the explain-it-back feature. Do NOT rename these unrelated systems that legitimately use the word "checkpoint":

- `src/features/retrieval/checkpoint.ts` (spaced-repetition retrieval).
- `src/features/trials/reinforceCheckpoint.ts` (trials reinforce step).

## File map

- Rename: `src/lessons/stacksQueues/PolyCheckpoint.tsx` to `src/lessons/stacksQueues/Teachback.tsx` (Part 1: symbols; Part 2: label + prompt copy).
- Rename: `src/lessons/stacksQueues/PolyCheckpoint.test.tsx` to `src/lessons/stacksQueues/Teachback.test.tsx` (Part 1).
- Rename: `src/lessons/stacksQueues/Stage.checkpoint.test.tsx` to `src/lessons/stacksQueues/Stage.teachback.test.tsx` (Part 1: file + imports; Part 2: assertion text).
- Modify: `src/lessons/stacksQueues/Stage.tsx` (Part 1: import, constants, render).
- Modify: `src/lessons/stacksQueues/Stage.test.tsx` (Part 1: the `vi.mock` path).
- Modify: `src/features/poly/explanationStore.ts` + `.emulator.test.ts` + `firestore.rules` (Part 1: collection name).
- Modify: `src/screens/PolyLab.tsx` (Part 1: symbols; Part 2: dev copy strings).
- Modify: `video/src/ui/web/CheckpointWeb.tsx`, `video/src/WillowPoly.tsx`, `video/README.md`, `docs/architecture.md` (Part 2: branding).
- Modify: `e2e/tracer.spec.ts` (Part 2: helper name + text matcher).

---

# PART 1: Mechanical rename (execute first)

## Task 1: Rename the component file and symbols

**Files:**
- Rename: `src/lessons/stacksQueues/PolyCheckpoint.tsx` to `src/lessons/stacksQueues/Teachback.tsx`

- [ ] **Step 1: Move the file with git**

Run:
```bash
git mv "src/lessons/stacksQueues/PolyCheckpoint.tsx" "src/lessons/stacksQueues/Teachback.tsx"
```

- [ ] **Step 2: Rename the props interface**

In `src/lessons/stacksQueues/Teachback.tsx`, change `export interface PolyCheckpointProps {` to `export interface TeachbackProps {`.

- [ ] **Step 3: Rename the component and its props type annotation**

Change the function declaration from `export function PolyCheckpoint({` to `export function Teachback({`, and its closing annotation from `}: PolyCheckpointProps) {` to `}: TeachbackProps) {`. Leave the "Quick check" label (line ~240) and the prompt copy (the `useState(\`In your own words, explain ${conceptName}.\`)` at line ~107) UNCHANGED; those move in Part 2.

- [ ] **Step 4: Typecheck (expect importer failures, do not commit yet)**

Run: `npm run build`
Expected: FAILS in `Stage.tsx`, `Stage.test.tsx`, `PolyCheckpoint.test.tsx`, `PolyLab.tsx` (they still import `PolyCheckpoint`). Tasks 2-5 fix every importer.

---

## Task 2: Update the S&Q Stage wiring

**Files:**
- Modify: `src/lessons/stacksQueues/Stage.tsx`

- [ ] **Step 1: Update the import**

Change `import { PolyCheckpoint } from "./PolyCheckpoint"` to `import { Teachback } from "./Teachback"`.

- [ ] **Step 2: Rename the constants and ids**

Change:
```tsx
const CHECKPOINTS: { id: string; afterIndex: number; conceptId: string; conceptName: string }[] = [
  { id: "cp-stacks", afterIndex: 4, conceptId: "stacks", conceptName: "stacks" },
  { id: "cp-queues", afterIndex: 9, conceptId: "queues", conceptName: "queues" },
]

// Poly voice on the S&Q checkpoints (the Friday demo target). Fails soft to the
// text loop if TTS, the mic, or transcription is unavailable.
const CHECKPOINT_VOICE = true
```
to:
```tsx
const TEACHBACKS: { id: string; afterIndex: number; conceptId: string; conceptName: string }[] = [
  { id: "tb-stacks", afterIndex: 4, conceptId: "stacks", conceptName: "stacks" },
  { id: "tb-queues", afterIndex: 9, conceptId: "queues", conceptName: "queues" },
]

// Poly voice on the S&Q teach-backs. Fails soft to the text loop if TTS, the mic,
// or transcription is unavailable.
const TEACHBACK_VOICE = true
```
Also change the comment "Renderer-layer checkpoints at the concept boundaries." to "Renderer-layer teach-backs at the concept boundaries."

- [ ] **Step 3: Update the state + render block**

Change `const [doneCheckpoints, setDoneCheckpoints] = useState<string[]>([])` to `const [doneTeachbacks, setDoneTeachbacks] = useState<string[]>([])`, then:
```tsx
  const due = state.completed
    ? undefined
    : TEACHBACKS.find(
        (c) => state.partIndex > c.afterIndex && !doneTeachbacks.includes(c.id),
      )
  if (due) {
    return (
      <Teachback
        conceptId={due.conceptId}
        conceptName={due.conceptName}
        uid={user?.uid ?? null}
        voice={TEACHBACK_VOICE}
        onDone={() => setDoneTeachbacks((prev) => [...prev, due.id])}
      />
    )
  }
```

---

## Task 3: Rename + update the component / stage tests (keep "Quick check")

**Files:**
- Rename: `src/lessons/stacksQueues/PolyCheckpoint.test.tsx` to `src/lessons/stacksQueues/Teachback.test.tsx`
- Rename: `src/lessons/stacksQueues/Stage.checkpoint.test.tsx` to `src/lessons/stacksQueues/Stage.teachback.test.tsx`
- Modify: `src/lessons/stacksQueues/Stage.test.tsx`

- [ ] **Step 1: Move the two test files**

```bash
git mv "src/lessons/stacksQueues/PolyCheckpoint.test.tsx" "src/lessons/stacksQueues/Teachback.test.tsx"
git mv "src/lessons/stacksQueues/Stage.checkpoint.test.tsx" "src/lessons/stacksQueues/Stage.teachback.test.tsx"
```

- [ ] **Step 2: Update names in `Teachback.test.tsx`**

Replace every `PolyCheckpoint` with `Teachback`: the import becomes `import { Teachback } from "./Teachback"`; describe blocks become `describe("Teachback (keyboard mode)", ...)` and `describe("Teachback (voice mode)", ...)`; the prop helper becomes `Parameters<typeof Teachback>[0]`; each `<PolyCheckpoint {...props} />` becomes `<Teachback {...props} />`. Do NOT change any "Quick check" text (there is none in this file).

- [ ] **Step 3: Keep "Quick check" assertions in `Stage.teachback.test.tsx`**

The label is still "Quick check" after Part 1, so leave the `getByText(/Quick check/i)` and `queryByText(/Quick check/i)` assertions unchanged. Only update the inline comment "real PolyCheckpoint" to "real Teachback". (Part 2 flips these assertions to "Teach-back".)

- [ ] **Step 4: Update the mock in `Stage.test.tsx`**

Change:
```tsx
vi.mock("./PolyCheckpoint", async () => {
  const { useLayoutEffect } = await import("react")
  return {
    PolyCheckpoint: ({
      onDone,
      conceptId,
    }: {
      onDone: () => void
      conceptId: string
    }) => {
```
to:
```tsx
vi.mock("./Teachback", async () => {
  const { useLayoutEffect } = await import("react")
  return {
    Teachback: ({
      onDone,
      conceptId,
    }: {
      onDone: () => void
      conceptId: string
    }) => {
```

- [ ] **Step 5: Run the S&Q tests**

Run: `npm test -- src/lessons/stacksQueues`
Expected: PASS (label still "Quick check").

- [ ] **Step 6: Commit**

```bash
git add "src/lessons/stacksQueues"
git commit -m "refactor: rename PolyCheckpoint symbols to Teachback (no copy change)"
```

---

## Task 4: Rename the Firestore collection

**Files:**
- Modify: `src/features/poly/explanationStore.ts`, `src/features/poly/explanationStore.emulator.test.ts`, `firestore.rules`

- [ ] **Step 1: Update the emulator test assertions first (failing test)**

In `src/features/poly/explanationStore.emulator.test.ts`, change both `checkpointExplanations` paths to `teachbackExplanations`:
```tsx
    const snap = await getDocs(collection(db, "users", "alice", "teachbackExplanations"))
```
and:
```tsx
      setDoc(doc(db, "users", "alice", "teachbackExplanations", "x"), {
```

- [ ] **Step 2: Run the emulator test to verify it fails**

Run: `npm run test:emulator -- src/features/poly/explanationStore.emulator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update the store**

In `src/features/poly/explanationStore.ts`, change `collection(db, "users", uid, "checkpointExplanations")` to `collection(db, "users", uid, "teachbackExplanations")`, and the doc comment "Persist a raw checkpoint explanation" to "Persist a raw teach-back explanation".

- [ ] **Step 4: Update the Firestore rule**

In `firestore.rules`, change `match /checkpointExplanations/{id} {` to `match /teachbackExplanations/{id} {` (leave the `allow` lines unchanged).

- [ ] **Step 5: Run the emulator test to verify it passes**

Run: `npm run test:emulator -- src/features/poly/explanationStore.emulator.test.ts`
Expected: PASS. (Old `checkpointExplanations` demo docs are abandoned; no migration.)

- [ ] **Step 6: Commit**

```bash
git add src/features/poly/explanationStore.ts src/features/poly/explanationStore.emulator.test.ts firestore.rules
git commit -m "refactor: rename checkpointExplanations collection to teachbackExplanations"
```

---

## Task 5: Rename PolyLab symbols (keep dev copy)

**Files:**
- Modify: `src/screens/PolyLab.tsx`

- [ ] **Step 1: Update the import + render symbol**

Change `import { PolyCheckpoint } from "@/lessons/stacksQueues/PolyCheckpoint"` to `import { Teachback } from "@/lessons/stacksQueues/Teachback"`, and the `<PolyCheckpoint ... />` render (line ~901) to `<Teachback ... />` (keep all props).

- [ ] **Step 2: Rename the dev-only code symbols (not the display strings)**

Rename the helper `makeMockCheckpoint` to `makeMockTeachback` (and its call sites) and the component `function CheckpointPanel` to `function TeachbackPanel` (and its `<CheckpointPanel ...>` call site). Leave the display strings ("Self-explanation checkpoint", "Checkpoint complete.", "and self-explanation checkpoints.") unchanged; Part 2 updates them.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS (all importers now reference `Teachback`).

- [ ] **Step 4: Commit**

```bash
git add src/screens/PolyLab.tsx
git commit -m "refactor: rename PolyCheckpoint usages in PolyLab to Teachback"
```

---

## Task 6: Part 1 verification

- [ ] **Step 1: Confirm the symbol + collection are gone, label intentionally remains**

```bash
rg -n "PolyCheckpoint|checkpointExplanations|CHECKPOINT_VOICE|cp-stacks|cp-queues|doneCheckpoints" src
rg -n "Quick check" src
```
Expected: first command returns nothing; second still finds "Quick check" in `Teachback.tsx` and `Stage.teachback.test.tsx` (intended; Part 2 flips it). The retrieval/trials checkpoint files are untouched.

- [ ] **Step 2: Typecheck + lint + tests + emulator**

Run: `npm run build && npm run lint && npm test && npm run test:emulator`
Expected: all PASS. Part 1 is complete; proceed to the hint pipeline plan, then Part 2.

---

# PART 2: Teach-back finalize (execute AFTER the hint pipeline)

## Task 7: Flip the user-facing label + prompt copy

**Files:**
- Modify: `src/lessons/stacksQueues/Teachback.tsx`
- Modify: `src/lessons/stacksQueues/Stage.teachback.test.tsx`

- [ ] **Step 1: Update the assertions first (failing test)**

In `src/lessons/stacksQueues/Stage.teachback.test.tsx`, change `getByText(/Quick check/i)` to `getByText(/Teach-back/i)` and `queryByText(/Quick check/i)` to `queryByText(/Teach-back/i)`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lessons/stacksQueues/Stage.teachback`
Expected: FAIL (label is still "Quick check").

- [ ] **Step 3: Change the label**

In `src/lessons/stacksQueues/Teachback.tsx`, change:
```tsx
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Quick check
          </span>
```
to use `Teach-back` in place of `Quick check`.

- [ ] **Step 4: Adopt the teach-framing prompt copy**

Change:
```tsx
  const [question, setQuestion] = useState(`In your own words, explain ${conceptName}.`)
```
to:
```tsx
  const [question, setQuestion] = useState(
    `Teach it back: explain ${conceptName} in your own words.`,
  )
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- src/lessons/stacksQueues`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lessons/stacksQueues/Teachback.tsx src/lessons/stacksQueues/Stage.teachback.test.tsx
git commit -m "feat: flip Teach-back user-facing label + teach-framed prompt"
```

---

## Task 8: PolyLab dev copy

**Files:**
- Modify: `src/screens/PolyLab.tsx`

- [ ] **Step 1: Update the display strings**

Change `"and self-explanation checkpoints."` to `"and self-explanation teach-backs."`; the panel `title="3 · Self-explanation checkpoint"` to `title="3 · Teach-back"`; and `"Checkpoint complete."` to `"Teach-back complete."`

- [ ] **Step 2: Typecheck + commit**

Run: `npm run build`
Expected: PASS.
```bash
git add src/screens/PolyLab.tsx
git commit -m "chore: update PolyLab dev copy to Teach-back"
```

---

## Task 9: Video + docs branding

**Files:**
- Modify: `video/src/ui/web/CheckpointWeb.tsx`, `video/src/WillowPoly.tsx`, `video/README.md`, `docs/architecture.md`

- [ ] **Step 1: Update video copy + URL**

In `video/src/ui/web/CheckpointWeb.tsx`, change the comment `Desktop checkpoint ("Poly Guide")` to `Desktop teach-back ("Poly Guide")`. In `video/src/WillowPoly.tsx`, change `url="willow.app/learn/checkpoint"` to `url="willow.app/learn/teach-back"`. In `video/README.md`, change `checkpoint / guide` to `teach-back / guide`.

- [ ] **Step 2: Update architecture doc**

In `docs/architecture.md`, replace references to "Poly checkpoints" / the explain-it-back "Quick check" with "Teach-back".

- [ ] **Step 3: Commit**

```bash
git add video docs/architecture.md
git commit -m "docs: rename Poly checkpoint to Teach-back in video + architecture"
```

---

## Task 10: E2E tracer + final verification

**Files:**
- Modify: `e2e/tracer.spec.ts`

- [ ] **Step 1: Update the tracer**

In `e2e/tracer.spec.ts` (around lines 47-53), rename the `polyCheckpoint()` helper to `teachback()` (update call sites) and change any "quick check" text matcher to "teach-back".

- [ ] **Step 2: Final grep**

```bash
rg -n "PolyCheckpoint|checkpointExplanations|Quick check|cp-stacks|cp-queues" src e2e video
```
Expected: no matches (retrieval/trials checkpoint files remain untouched and are outside these paths' explain-it-back usage).

- [ ] **Step 3: Full verification**

Run: `npm run build && npm run lint && npm test && npm run test:emulator && npm run e2e`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/tracer.spec.ts
git commit -m "test: rename quick-check tracer helper to teach-back"
```

---

## Self-review checklist (run after the plan, before execution)

- **Phasing honored:** Part 1 changes NO user-facing string (label stays "Quick check", prompt unchanged); Part 2 flips them after the hint pipeline.
- **Every importer of `PolyCheckpoint` updated** in Part 1: `Stage.tsx`, `Stage.test.tsx`, `Teachback.test.tsx`, `PolyLab.tsx`.
- **No collision** with `src/features/retrieval/checkpoint.ts` or `src/features/trials/reinforceCheckpoint.ts`.
- **Collection rename consistent** across store, emulator test, and `firestore.rules` (Part 1, Task 4).
- **Test order:** assertion edits precede the code change they test (Part 1 Task 4, Part 2 Task 7).

