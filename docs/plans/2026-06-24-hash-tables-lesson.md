# Plan: Willow (Hash Tables Lesson (L4)) learner-runnable `HashBox` + key→bucket rewire + chaining

> Source of truth: `docs/lessons/hash-tables.md`, the LOCKED, grilled spec. Honor it exactly: **12 beats, gate = 9 (clean 3/3/3: Hash ×3 / Collision ×3 / Lookup ×3)**; mechanics **Locate-the-position + Predict-next-state**; hash rule **"sum letter values (a=1…z=26), then `mod B`", B=5**; the box scaffolds the running sum, the learner performs `mod` and **drags the key into its bucket** (shared rewire infra); collisions **append to the tail**; collision distractors = overwrite / reject / probe; lookup pairs **`free` (1 jump) vs `scales` scan**; **"not found" = absent in one jump**; real-world skin = **contacts**. Binding parents: `docs/lesson-design.md` (Principles 1–7, determinism rules, cost house-words), `docs/design/design-system.md` (visual system, reduced-motion §7/§14), `docs/design/design-system.md` (D1 SR-only fail copy + reveal-on-Why order). Structure modeled on `docs/plans/2026-06-24-linked-lists-lesson.md`.
>
> Constraints (verified in `package.json`): lint `oxlint` (`npm run lint`), unit `vitest run` node+dom (`npm run test`), typecheck/build `tsc -b` (`npx tsc -b`), emulator (`npm run test:emulator`), e2e (`npm run e2e`). Strict TS: `import type` (verbatimModuleSyntax), no enums/namespaces (erasableSyntaxOnly), `noUnusedLocals/Parameters`. Don't touch git.

## Goal

Ship **Hash Tables** as the fourth playable `LessonModule` on the existing shared seam: a learner-runnable **`HashBox`** (Step reveals each letter's value + running sum; the learner supplies `mod B` by **dragging the key into a bucket**), a **bucket array** of `B=5` indexed buckets that are drop targets, and **chaining** (a mini boxes+`next`-arrow chain inside a bucket). Twelve beats; **9 graded** behind the until-correct wall, aggregated into a clean **3/3/3** gate across three bins (Hash / Collision / Lookup). It reuses (unchanged) the shared feedback machine + flame (`gradeAnswer`), `FeedbackFooter` (incl. its `canCheck` gate), `AnswerCard`, `CostReadout`, the durable `LessonProgress` shape, and the pure rewire infra (`src/components/rewire/*`). Wire it live (register → make the catalog entry playable → delete the preview). **No shared-engine edit, no new `LessonAction`, no heavy libs**, it ships eager/playable like Arrays.

**Reused vs lesson-specific**

| Reused unchanged | Lesson-specific (new) |
|---|---|
| `gradeAnswer` / `LessonAction` / `LessonProgress` / `CostWord` (`engine.ts`) | `src/features/lesson/hashTablesEngine.ts` (+ `.test.ts`). `BucketOf`, curated 12-beat flow, 3 bin counters, verdicts |
| `FeedbackFooter` (with `canCheck`), `AnswerCard` (`data-answer`), `CostReadout`, `StatusChip` | `src/lessons/hashTables/HashBox.tsx`: runnable compute + key-in-flight |
| Rewire infra `RewireSurface`/`RewireSource`/`RewireTarget`/`core.ts` (consumer only) | `src/lessons/hashTables/HashTable.tsx`: vertical bucket array (drop targets) + `BucketChain.tsx` (in-bucket chain) |
| `LessonModule` contract, `LessonPlayer`, `useLessonRun`, persistence repo, catalog derivation | `src/lessons/hashTables/Stage.tsx`, `src/lessons/hashTables.tsx` (the module) |
| `LessonLab` gallery harness, the emulator test + Playwright tracer patterns | wiring edits (`lessons.ts`, `catalog.ts`), gallery presets, emulator case, E2E leg |

## Grounding in the repo (verified: read before slicing)

**The `rewire` action already exists on the shared union**: no `engine.ts` change:

```
// src/features/lesson/engine.ts
  // Shared, cross-lesson rewire gesture (drag/tap/keyboard "connect from → to").
  | { type: "rewire"; from: string; to: string }
```

**The Check-gate for non-`selected` beats already exists.** `FeedbackFooter` takes an optional `canCheck` override; LL's rewire beat uses `canCheck={state.writes.length > 0}`. Hash's drag beats use `canCheck={state.placement != null}`; MCQ/tap beats use the default `selected`-based gate.

**The shared, stable seams to build on (do not edit):**
- `gradeAnswer`: nudge on first wrong, fail at `WRONG_LIMIT=2`, combo climbs on correct and breaks only on a full fail. Only "which counter to bump" is lesson-specific.
- `LessonProgress`: durable slice = `counters: Record<string, number>` + `currentPart: string` + `completed`. **Counters are numbers only**, new keys `hash`/`collision`/`lookup` (+`attempts`) ride it with no shape change.
- `LessonModule` contract: `create`, `reducer`, `toProgress`, `resume`, `hasProgress`, `totalParts`, `filledParts`, `combo`, `completed`, `Stage`.
- The pure rewire core (`core.ts`): `isWithin` / `resolveDropTarget` / `resolveIntent` / `cycleTarget`. `RewireSurface` already does registry + pointer-drag + tap + keyboard + one `aria-live` + DEV hooks; `RewireTarget` is ≥44px and emits a drop **for any registered target, legal or not** (legality = highlight only).
- Reference engine/stage to mirror: `arraysEngine.ts` (const-tuple `PARTS`, copied seeded `rngNext/rngInt/shuffle`, MCQ recipe: correct-first → deterministic distractors → de-dupe → seed-shuffle) and `linkedListsEngine.ts` (curated 1:1 part-per-beat flow, 0/1 graded counters, `enterPart`/`resume`, the rewire-action handling). `arrays/Stage.tsx` (quota header → figure → `AnswerCard` → `CostReadout` on correct → `FeedbackFooter`) and `linkedLists/Stage.tsx` `RewirePart` (the `RewireSurface` + `canCheck` + cost-on-correct pattern).
- `CostWord` is the locked union `"free" | "barely grows" | "scales" | "usually free"`; Hash uses only **`free`** (jump) and **`scales`** (the scan it replaces). **Never `usually free`** (Arrays-only; resize/rehash is cut here).
- Test infra ready: `vitest.config.ts` → **node** project (`src/**/*.test.ts`) + **dom** project (`src/**/*.test.tsx`, jsdom + Testing Library). Emulator round-trip pattern: `firestoreProgressRepository.emulator.test.ts` (has S&Q + Arrays + **Linked Lists** cases to copy). Single Playwright tracer: `e2e/tracer.spec.ts` (today: S&Q → Arrays → Linked Lists, incl. `rewireByKeyboard`/`answerArrays` helpers). Global reduced-motion CSS neutralizes CSS transitions (`src/index.css`), so only JS/`motion` animation needs a `useReducedMotion()` guard.

### Grounding corrections: locked *assumptions* that are wrong against the code

1. **L3 ships `NodeGraph.tsx`, not `NodeChain.tsx`.** `NodeChain.tsx` was retired. The shipped figure is `src/lessons/linkedLists/NodeGraph.tsx`: an SVG literal-arrow figure tightly coupled to the LL engine (`pointerId`, `sourceNode`, `NIL`, reachability). Reusing it verbatim would drag in pointer-rewire affordances + a `∅` terminator that don't belong in a bucket. Its pure geometry (`graphLayout.ts`) **is** reusable. → **Build a small `BucketChain` styled to the `NodeGraph` node+arrow vocabulary** (optionally over `graphLayout`), not a literal `NodeGraph` reuse.
2. **L2's `ArrayRow` is horizontal and not a container.** It renders a `flex` of fixed cells (value-on-top / index-beneath). The hash **bucket array is a vertical stack of `B` indexed buckets, each a `RewireTarget` holding a chain**: `ArrayRow` cannot be that container. → **Build a new vertical `HashTable` figure styled to `ArrayRow`'s indexed-strip tokens**, and reuse `ArrayRow` *verbatim* only for the `scales`-scan counterfactual (a flat row being scanned).
3. **The playable registry lives in `src/features/lesson/lessons.ts` (`LESSONS`), not `src/lessons/registry.tsx`** (which now exports the derived `FUTURE_LESSONS`). Verified current state:

```
// src/features/lesson/lessons.ts
export const LESSONS: Record<string, LessonModule<any>> = {
  [stacksQueuesModule.id]: stacksQueuesModule,
  [arraysModule.id]: arraysModule,
  [linkedListsModule.id]: linkedListsModule,
}
```

**L3 status (verified):** Linked Lists is **already wired live**, no `load` thunk in `catalog.ts`, registered in `lessons.ts`, and `e2e/tracer.spec.ts` plays all LL beats to completion. So "L3 mid-build" coordination is largely moot; the real coordination is **don't break `NodeGraph`/`graphLayout`/`rewire/*`** while reusing their primitives (Hash is downstream).

## Decisions (settled before slicing)

- **Engine location:** `src/features/lesson/hashTablesEngine.ts` (matches every shipped engine; node test glob `src/**/*.test.ts`). Stage + figures colocate under `src/lessons/hashTables/`.
- **Parts model:** **12 parts, one per beat** (curated, 1:1, like `LL_PARTS`), advanced linearly via `next`/`continue`. **Gate counters aggregate by bin** (like Arrays): `hashCorrect` / `collisionCorrect` / `lookupCorrect`, each capped at 3. `isComplete = hash≥3 && collision≥3 && lookup≥3`. `totalParts=12` drives the progress bar.

```ts
export const HASH_PARTS = [
  "demo",            // 1  intro free-play (Step the box, watch the key fly)
  "teach-hash",      // 2  teach: key→location; sum letters · mod B; deterministic
  "hash-cat",        // 3  H1 place cat → bucket 4 (drag)                  Hash      ✓
  "hash-cat-again",  // 4  H2 re-run on cat → SAME bucket (determinism)    Hash      ✓
  "hash-dog",        // 5  H1 place dog → bucket 1 (drag)                  Hash      ✓
  "teach-collision", // 6  teach: collision; chaining = a mini linked list,
  "collide-sun",     // 7  H3 sun → bucket 4 (cat→sun)                     Collision ✓
  "collide-ant",     // 8  H3 ant → bucket 0 (owl→fox→ant, deeper)         Collision ✓
  "collide-pig",     // 9  H3 pig → bucket 2 (bee→pig, squash)             Collision ✓
  "lookup-found",    // 10 H4 find fox: free (1 jump) vs scales            Lookup    ✓
  "lookup-absent",   // 11 H4 is bat here? absent in one jump (free)       Lookup    ✓
  "realworld",       // 12 H5 contacts: route a name, then look up         Lookup    ✓
] as const
```

- **Hash bin = key→bucket drag; Lookup bin = tap the bucket.** Beats 3/4/5 (and the H5 route, beat 12) use the **rewire drag** (`{from: keyId, to: "bucket-"+i}`); beats 10/11 use **tap-locate** (a bucket `select`). Both deterministic Locate. H2 (beat 4) re-drags the *same* key so it visibly lands in the **same** bucket. The determinism demo.
- **`legalBuckets` = all buckets** (every bucket keyboard-reachable; surface highlights, **engine grades the drop**). Simpler than LL's reachability gate.
- **Hash-box stepped-sum is local UI state, not engine state** (like LL's `cursor`). Never affects the verdict (`placement === "bucket-"+bucket`), so determinism + persisted shape are untouched.
- **No new `LessonAction`, no new shared widget, no heavy libs.** Key→bucket reuses `{type:"rewire"}`; else `select`/`check`/`continue`/`next`/`reveal`/`reattempt`. Plain React + `motion`.

### Proposed engine shapes (for the executor)

```ts
// hashTablesEngine.ts. Pure helpers (a=1…z=26)
const letterValue = (c: string) => c.charCodeAt(0) - 96
export const keySum   = (key: string) => [...key].reduce((s, c) => s + letterValue(c), 0)
export const bucketOf = (key: string, B: number) => keySum(key) % B
export const chainAfter = (chain: string[], key: string) => [...chain, key]            // append-to-tail
export const present   = (key: string, table: Record<number, string[]>, B: number) =>
  (table[bucketOf(key, B)] ?? []).includes(key)

export const bucketTargetId = (i: number) => `bucket-${i}`
export type HashBin = "hash" | "collision" | "lookup"

export interface HashOption { id: string; label: string }

export interface HashQuestion {
  kind: typeof HASH_PARTS[number]
  bin: HashBin | null
  prompt: string
  key: string | null
  B: number
  sum: number
  bucket: number
  table: Record<number, string[]>
  options: HashOption[]
  answer: string                               // winning option id, or bucketTargetId(bucket)
  present: boolean
  contacts: boolean
  cost: { word: CostWord; count: number; unit: string }
  scanCost?: { word: CostWord; count: number; unit: string }
  hint: string; nudge: string; correct: string; why: string
}

export interface HashTablesState {
  seed: number; rngState: number; partIndex: number
  hashCorrect: number; collisionCorrect: number; lookupCorrect: number   // 0..3 each
  attempts: number
  question: HashQuestion | null
  placement: string | null     // bucket id the key was dropped on (drag), transient
  selected: string | null      // MCQ choice / tapped bucket
  wrongCount: number; feedback: Feedback; revealed: boolean; showWhy: boolean
  combo: number; completed: boolean
}
```

- **Grading** (in `check`, mirroring `linkedListsEngine`): drag beats → `correct = placement === bucketTargetId(q.bucket)`; tap/MCQ beats → `correct = selected === q.answer`; then `gradeAnswer` (nudge → fail at `WRONG_LIMIT`, combo). `canCheck` = `placement != null` (drag) or `selected != null` (default).
- **`rewire` handler:** drag beat → `{ placement: action.to, feedback: "idle" }`; `legalBuckets` is highlight-only.
- **Curated seed data (worked-values fixture: the test's ground truth):**

| beat | key | sum | `mod 5` | pre-placed table (given) | graded as |
|---|---|---|---|---|---|
| 3 `hash-cat` | `cat` | 24 | **4** | `{}` | drag → bucket-4 |
| 4 `hash-cat-again` | `cat` | 24 | **4** | `{4:[cat]}` | tap → bucket-4 |
| 5 `hash-dog` | `dog` | 26 | **1** | `{4:[cat]}` | drag → bucket-1 |
| 7 `collide-sun` | `sun` | 54 | **4** | `{4:[cat]}` | MCQ → `cat→sun` |
| 8 `collide-ant` | `ant` | 35 | **0** | `{0:[owl,fox]}` | MCQ → `owl→fox→ant` |
| 9 `collide-pig` | `pig` | 32 | **2** | `{2:[bee]}` | MCQ → `bee→pig` |
| 10 `lookup-found` | `fox` | 45 | **0** | `{0:[owl,fox,ant]}` | tap → bucket-0 (present) |
| 11 `lookup-absent` | `bat` | 23 | **3** | `{3:[elk]}` | tap → bucket-3 (absent) |
| 12 `realworld` | curated contact name | - | - | curated contacts table | drag → its slot |

- **H3 options (seeded shuffle; one distractor per named misconception):** `append` (`[...chain,key]`, **correct**), `overwrite` (`[key]`), `reject` (`chain` unchanged), `probe` (key in the next empty bucket. The cut open-addressing move, **only ever a wrong answer**). Correct-first → deterministic distractors → `shuffle(options, seed)`.
- **Lookup cost (paired, pure):** found/absent → `cost = { word:"free", count:1, unit:"jump to the bucket" }`; `scanCost = { word:"scales", count: <list length>, unit:"items scanned" }`. Two `CostReadout`s side-by-side. Never `usually free`.

## Tracer-bullet slices (smallest-first, each full-stack + tests)

Slices 1–3 ship behind the Gallery lab + node/dom tests; Slice 4 flips the lesson live and adds emulator + Playwright. **Build the riskiest beat first** (beat 3 run-the-hash drag) before fan-out.

### Slice 1, Run-the-hash / Locate (de-risking tracer): beats 1–5 (Hash bin)

**Engine (pure-first):** `hashTablesEngine.ts`, `bucketOf`/`keySum`; `HASH_PARTS`; `createHashTables`/`enterPart`/reducer for `demo`/`teach-hash`/`hash-cat`/`hash-cat-again`/`hash-dog`; the `rewire` handler (records `placement`); `select` for H2; `check` grading the Hash bin; `legalBuckets`; selectors (`currentPartHash`/`isTerminalHash`/`partQuotaHash` "n of 9"); `hashCorrect` bumping; seeded makers per beat over the curated keys.

**Figures (the biggest risk):**
- `hashTables/HashBox.tsx`, runnable compute: **Step** walks the key letter-by-letter (each letter lights with its value, running sum ticks), lands on `sum`, presents `sum mod B = ?`. Local `step` state. On a correct drop, the **key-in-flight** animation. `useReducedMotion()` → snap + SR. Never pre-lights the answer bucket. DEV hook on the key `RewireSource`: `data-rewire-correct-target="bucket-N"` (the L3 tracer pattern).
- `hashTables/HashTable.tsx`, the **vertical bucket array**: `B` rows, each `index ruler + RewireTarget` styled to `ArrayRow` tokens. Renders each chain via `BucketChain` (stub this slice). ≥44px targets.

**Stage + gallery:** `hashTables/Stage.tsx` routes `demo`/`teach-hash` (Continue) + a `HashPart` (drags inside `RewireSurface`, `legalTargets={legalBuckets(state)}`, `canCheck={placement!=null}`) + a tap-locate variant for H2. Add a `hash-tables` `LessonLab` group + presets to `GalleryApp.tsx`. **Do not** make the catalog entry live yet.

**Acceptance:** `bucketOf` correct for every curated key; beat 3 drag onto `bucket-4` → correct/combo+1/`hashCorrect=1`, wrong → nudge→fail at `WRONG_LIMIT`, counter untouched on fail; beat 4 grades the **same** bucket; `legalBuckets`=all; same seed → identical questions; `canCheck` false until a drop; keyboard-only matches drag intent; reduced-motion snaps (dom test); lint + tsc + test green.

### Slice 2, Collision → chain (Predict-next-state): beats 6–9 (Collision bin)

**Engine:** makers for `teach-collision` + `collide-sun`/`collide-ant`/`collide-pig`, pre-placed `table`, four seeded options (`append`✓ / `overwrite` / `reject` / `probe`), `answer=append`, `chainAfter` verdict, seed-shuffled; `collisionCorrect` bumping; MCQ `check`.

**Figure:** `hashTables/BucketChain.tsx`, in-bucket chain (boxes + `next` arrow) at small scale, styled to `NodeGraph` vocabulary (reuse `graphLayout` geometry if a curved SVG arrow is wanted). Display-only. Reduced-motion snap; SR announces the chain as an ordered list. `HashTable` renders `BucketChain` per occupied bucket.

**Stage:** a `CollisionPart` reusing `AnswerCard` for the four options + the colliding bucket; correct plays the append (why-replay shows append; overwrite distractor replays "no. The old key is still here, they chain"). Gallery presets per beat.

**Acceptance:** `chainAfter` correct for each; each distractor correct-by-construction, distinct, wrong; `probe` never correct; correct → `collisionCorrect` bumps; options deterministic per seed; reduced-motion snaps; SR reads the chain; gate not yet complete; green.

### Slice 3, Lookup: found / absent / real-world (Locate · cost): beats 10–12 (Lookup bin)

**Engine:** makers for `lookup-found` (tap → bucket(fox)=0, present), `lookup-absent` (tap → bucket(bat)=3 over `[elk]`, absent), `realworld` (contacts skin: route name → slot via drag; found & absent). Paired `cost` (`free`,1) + `scanCost` (`scales`). `lookupCorrect` bumping; `present` selector; `isCompleteHash`.

**Stage:** a `LookupPart` (tap a bucket; reveal found/absent on the chain + two `CostReadout`s `free` vs `scales`) + a `RealworldPart` (token-scoped contacts skin à la LL's Spotify wrapper. Pass contrast/lilac-focus/reduced-motion). Why-replay fires the single jump beside a step-by-step list scan. Gallery presets.

**Acceptance:** `present(fox)=true`, `present(bat)=false`; absent checks only bucket 3's chain; found/absent read `free` paired with `scales`, never `usually free`; all three lookup beats gate; contacts skin passes a11y; green.

### Slice 4: Wire live, gate, persistence, E2E, determinism

- **Module:** `src/lessons/hashTables.tsx` exporting `LessonModule<HashTablesState>` (`id:"hash-tables"`, `totalParts:12`), mirroring `arrays.tsx`/`linkedLists.tsx`.
- **Gate/flame:** `isCompleteHash`=3/3/3; `filledPartsHash`=`completed ? 12 : partIndex`; flame spans the 9 via shared combo.
- **Persistence:** `toProgressHash`/`resumeHash` with counters `{hash, collision, lookup, attempts}` + `currentPart` + `completed`; resume = same beat, fresh instance, cold combo. Working-state (`placement`/`step`) transient.
- **Wire live (exact steps):**
  1. `src/features/lesson/lessons.ts`: `import { hashTablesModule } from "@/lessons/hashTables"` and add `[hashTablesModule.id]: hashTablesModule,` to `LESSONS`.
  2. `src/lessons/catalog.ts`, remove `load: () => import("@/lessons/future/HashTables")` from the `hash-tables` entry. Flips `isLessonPlayable("hash-tables")` true and auto-drops it from `FUTURE_LESSONS`.
  3. **Delete** `src/lessons/future/HashTables.tsx`. (Keep `future/_shell.tsx`: Trees/Heaps/Graphs still use it.)
  4. No edit to `src/lessons/registry.tsx` (`FUTURE_LESSONS` is derived). Unlock stays sequential (Linked Lists → Hash Tables).
- **Emulator:** add a Hash-Tables case to `firestoreProgressRepository.emulator.test.ts` (mirror the LL case): mid-beat round-trip of `{hash, collision, lookup, attempts}` + `currentPart` + resume-on-same-beat.
- **E2E:** extend `e2e/tracer.spec.ts` to continue **into Hash Tables after Linked Lists completes**; play all 12 beats; commit the beat-3 key→bucket drop via the **keyboard fallback** and at least one via pointer; pick H3/H4 winners via `data-answer`/the bucket DEV hook.
- **Determinism:** a node test. Same seed → identical keys/buckets/chains/options/verdicts; no model calls.

**Acceptance:** `isCompleteHash` flips only after 3/3/3; the happy path reaches `completed` with `combo=9`; failed/revealed never count; playable from the course path, unlocks after Linked Lists, signed-in reload resumes mid-lesson; `npm run lint`, `npx tsc -b`, `npm run test`, `npm run test:emulator`, `npm run e2e` all green.

## Stories → slices matrix

| Beat (flow #) | Type · bin | Graded? | Verb | Slice |
|---|---|---|---|---|
| 1 demo | intro | - | play | 1 |
| 2 teach (key→location) | teach | - | - | 1 |
| 3 run hash on `cat` | H1 · Hash | ✓ | **drag** | **1 (tracer)** |
| 4 hash `cat` again | H2 · Hash | ✓ | drag (same bucket) | 1 |
| 5 run hash on `dog` | H1 · Hash | ✓ | drag | 1 |
| 6 collision teach | teach | - | - | 2 |
| 7 insert `sun` → bucket 4 | H3 · Collision | ✓ | MCQ | 2 |
| 8 insert `ant` → bucket 0 | H3 · Collision | ✓ | MCQ | 2 |
| 9 `bee`/`pig` → bucket 2 | H3 · Collision | ✓ | MCQ | 2 |
| 10 find `fox` (free vs scales) | H4 found · Lookup | ✓ | tap | 3 |
| 11 is `bat` here? (absent) | H4 absent · Lookup | ✓ | tap | 3 |
| 12 contacts (route + lookup) | H5 · Lookup | ✓ | drag | 3 |
| gate · flame · wire · persistence · E2E · determinism | - | - | - | 4 |

## Risks & mitigations

- **Figure reuse premise is stale (highest).** `NodeChain` is gone (`NodeGraph` is pointer-coupled); `ArrayRow` is horizontal/non-container. → New vertical `HashTable` (ArrayRow-styled) + small display-only `BucketChain` (NodeGraph-styled, optionally over `graphLayout`). Reuse `ArrayRow` verbatim only for the `scales`-scan. **Do not edit** `NodeGraph.tsx`/`graphLayout.ts`/`rewire/*`.
- **`FeedbackFooter` Check gates on `selected`.** → Use `canCheck` (proven by LL). Hash: `canCheck={placement!=null}` for drags; default `selected` gate for taps/MCQ.
- **`legalTargets` semantics.** Hash wants all buckets keyboard-reachable, graded by the engine. → `legalBuckets` returns the full set; surface highlights, engine grades the drop.
- **Hash-box stepped-sum state.** Verdict-irrelevant → keep **local** (`useState`), not in the engine; pure `sum`/letter values for SR + scaffold.
- **Reduced motion for four new animations** (compute walk, key-in-flight, chain-draw, jump-vs-scan). → Gate every `motion` animation behind `useReducedMotion()` → snap + SR.
- **Tracer determinism for the drag.** → DEV-only `data-rewire-correct-target="bucket-N"` on the key source + `data-rewire-target` on buckets; `data-answer` on the H3 winner + correct lookup bucket. Reuse `rewireByKeyboard`/`answerArrays`.
- **New persistence keys** `hash`/`collision`/`lookup`. → Ride the `counters` map; add an emulator round-trip; **notify the persistence agent**.
- **Not-found membership verdict.** → Pure `present = key ∈ chain(bucket(key))`, checking only that bucket's chain; assert `present(fox)=true`/`present(bat)=false`.
- **L3-owned primitives are shared.** `NodeGraph`/`graphLayout`/`rewire/*` are consumed downstream. → Consume only; extract additively + coordinate if a shared chain primitive is wanted.

## Test contract mapping (the three seams + determinism)

- **Engine unit (node): `hashTablesEngine.test.ts`** (mirror `arraysEngine.test.ts` + `linkedListsEngine.test.ts`): worked-values fixture (`bucketOf` per key); H3 `chainAfter` + seeded distractor set (correct, distinct, all wrong); H2 same key → same bucket; H4 `present`/absent grades `free`; paired `free` vs `scales` (never `usually free`); `gradeAnswer` nudge→fail; gate flips only at 3/3/3; flame breaks only on a full fail; **determinism** (same seed → identical everything, no model calls).
- **Figure (dom): `hashTables/HashBox.test.tsx`** (mirror `NodeGraph.test.tsx`): keyboard-path key→bucket intent parity with drag; reduced-motion snap; registry idempotent under StrictMode.
- **Repository (emulator): Hash case in `firestoreProgressRepository.emulator.test.ts`**: `{hash, collision, lookup, attempts}` + `currentPart` + `completed` round-trip and resume-on-same-beat; reconcile (anon → account) unchanged.
- **One Playwright leg: `e2e/tracer.spec.ts`**: continue into Hash Tables after Linked Lists; play all 12 beats; commit the key→bucket drop via keyboard (and one via pointer); H3/H4 via DEV hooks; assert each graded beat gates and a reload resumes.

## Coordination

- **Shared-seam stability:** do **not** touch `LessonModule` / `LessonAction` / `LessonProgress` / `gradeAnswer` / `CostWord`, or `src/components/rewire/*` public API. "A module + one registry entry," never a seam change.
- **L3 figure primitives:** `NodeGraph.tsx` / `graphLayout.ts` are L3-owned, shared downstream. Consume `graphLayout` geometry, build a *new* `BucketChain`, avoid editing `NodeGraph`. Extract additively if needed.
- **Persistence agent:** new counter keys `hash`/`collision`/`lookup` ride the `counters` map. Flag so analytics/dashboards expect them.
- **Heavy libs:** none added. Keep the proto bundle unchanged.

## Recommended build order & green baseline

**Baseline (verify first):** `npm run lint && npx tsc -b && npm run test` pass (S&Q + Arrays + Linked Lists shipped). Run once before slice 1; if red, fix the baseline first.

**Order:** Slice 1 (beat 3 first as the de-risking tracer → rest of Hash) → Slice 2 (Collision) → Slice 3 (Lookup) → Slice 4 (wire/gate/persist/E2E/determinism). Run lint + tsc + test after each; add emulator + e2e in Slice 4 (re-run the full set before declaring done. Delegate to `verifier`/`test-runner`).

## Open questions for the human (resolve before slice 1)

1. **Figure reuse (figure design):** OK to build a **new vertical `HashTable`** (styled to `ArrayRow` tokens; `ArrayRow` reused verbatim only for the `scales`-scan) and a **small `BucketChain`** (styled to `NodeGraph`, over `graphLayout` geometry). Honoring the *family resemblance* the spec wants without a literal `NodeChain`/`ArrayRow`-as-container reuse? (Recommended.)
2. **H4-absent interaction:** grade the **locate** (tap `bucket(bat)`, absence revealed on the chain) (consistent with H1/H2/H5 being Locate) vs an explicit yes/no membership confirm. (Recommend locate.)
3. **Contacts skin fidelity (H5):** a light **token-scoped** card (like LL's beat-7 Spotify wrapper) vs a fuller contacts UI. (Recommend the light scoped skin.)
4. **H2 interaction (minor):** re-**drag** the same key so the flight lands in the same bucket (determinism *felt*) vs a tap-locate. (Recommend re-drag.)
