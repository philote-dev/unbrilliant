# Willow Trials: Campaign Design Experiences (Design Spec)

Date: 2026-06-28
Status: Approved (design). Pending written-spec review, then implementation plan.
Supersedes: the standalone two-tier prototype styles (`Construct` / `Trace` / `Devise`) in the gitignored `src/dev/` lab. Their pure simulators are harvested; the standalone UI is retired.
Source brief: `willow_trial_campaign_design.docx` (Linear, Organization, and Network Systems), refined through a brainstorming session.

## 1. What a Trial is

A normal lesson teaches a data structure. A **Trial** checks whether the learner can reason with structures under client pressure. The learner chooses a structure, maps operations onto it, runs a stress test that classifies the design as **viable / strained / broken**, revises, and finishes with a retrospective. It must feel open-ended while staying fully deterministic.

- One Trial = one campaign.
- One campaign = two missions (Mission A, Mission B).
- Mission B inherits Mission A as **design memory** (what you used last), not literal scenario state.

Campaigns:

| Campaign | Course position | Core thinking mode | Missions |
| --- | --- | --- | --- |
| Trial I: Linear Systems | After the linear unit (stacks/queues, arrays, linked lists) | Order, ends, middle edits, undo, current item | A: The Line Breaks; B: The Playlist Machine |
| Trial II: Organization Systems | After hashes, trees/BST, heaps, (maybe graphs) | Different structures answer different questions | A: The Lost Item Desk; B: The Rescue Dispatcher |
| Trial III: Network Systems | After graph lessons mature | Relationships create behavior objects do not explain | Deferred |

Build focus: **Trial I fully**; Trial II authored as a data skeleton to keep the engine general; Trial III deferred.

## 2. Decisions locked (this session)

1. **Scope: guided design board.** The full campaign loop (choose -> map -> stress-test -> revise -> retrospective) with viable/strained/broken, but a tight, deterministic interaction grammar. Upgradeable to a free-form board later.
2. **Layout: B/A hybrid.** Immersive backdrop only for the Trial Gate entrance; a stacked "scene over board" working surface (mobile-first, reuses the app rhythm). Desktop may widen to scene-left / board-right, but always collapses to stacked.
3. **Mapping gesture: tap-to-place + rule echo.** Arm an operation chip, tap the labeled end/zone of the chosen structure; the board restates each placement as a plain-language rule. Chip dropdowns are a later fallback for operation-heavy structures.
4. **Consequence model: forgiving.** Broken blocks (must revise). Strained may continue (weakness logged) or revise. Viable continues. Revisions are free and recorded. A fully-viable run with no broken hit is the "clean pass."
5. **Mastery boost: simple `reinforceCheckpoint`.** Clean pass promotes each exercised linear concept by one ladder rung (capped once per Trial, never past max), deliberately bypassing the massed-practice rule. A revised pass refreshes strength and due-date only. Nothing else in the concept-memory engine changes.
6. **Gating: soft chaining, self-contained.** Lessons are never blocked by a Trial. A Trial opens once its unit is done and stays flagged "open to conquer." A later Trial locks until the earlier one completes. The existing course path is not restructured: the Trial layer owns its own availability logic and contributes at most one additive node.

Animation directive: use the full animation toolkit (`StackBin`, `QueueTube`, `ArrayStrip`, `NodeGraph`, `FrameSequence`, `StepTransport`), not static chips. Animations stay presentational and never leak the verdict before commitment.

## 3. Binding product constraints (from the brief)

- **No AI grading in this phase.** Every verdict is a pure function of visible state and authored data.
- **No Big O.** Use Willow cost words only: free, small, medium, large (mapped internally to the capability cost below).
- **No formal memory model** beyond the light "space" mentions already near arrays.
- **Target learner:** intro high-schooler / beginner with weak visual intuition, not a university algorithms student.
- **Animations are presentational only.** They never alter grading state or reveal the correct answer before commitment.
- **Realistically finishable.** About 20 minutes per mission, with save/resume across a few days.
- **Allowed language examples:** "only one end moves"; "everything shifts"; "walk through the chain"; "the newest action is sitting on top"; "the neighbors reconnect."

## 4. Experience flow

1. **Trial Gate (immersive entrance).** Tapping the Trial node dims the lesson map, slow transition, the central Trial card opens into a client dashboard. Copy prepares the learner for open-ended commitment, revision, and saved progress: "This is not a lesson. You will design a small system for a client. Your choices will be saved. Later changes may stress your design."
2. **Working surface (stacked).** Persistent top bar (trial, mission, saved state, quiet progress). Client Scene on top renders the real-world skin and reads engine state only. Design Board beneath holds the structure palette, operation chips, slots, policies, and constraint checks.
3. **Design.** Choose a structure from the palette; tap-to-place each operation chip onto a labeled end/zone; the board echoes each placement as a rule sentence.
4. **Stress test.** Commit, tap Run; the authored event script replays against the design and returns viable / strained / broken with the matching animation. The verdict appears only after commitment.
5. **Recovery (forgiving).** Broken blocks until revised; strained continues (logged) or revises; viable continues. Revisions logged on a revision timeline, never punished.
6. **Retrospective.** First choice, what broke it, what changed, final design capability.
7. **Completion.** Clean pass -> full boost; revised pass -> softer refresh. Trial marked complete; the next Trial unlocks.

## 5. Deterministic grading core: the capability matrix

The heart of the engine. Rather than bespoke logic per segment, one small capability matrix drives viable/strained/broken for the common "can this structure own this operation" case.

```ts
type StructureKind = "stack" | "queue" | "array" | "linked-list"
type Position = "front" | "back" | "middle" | "top" | "current" | "byIndex"
type Cost = "cheap" | "expensive" | "impossible"

// Trial I matrix. Cost is the learner-facing "effort" of acting at a position.
const CAPABILITY: Record<StructureKind, Partial<Record<Position, Cost>>> = {
  queue:         { front: "cheap",   back: "cheap",       middle: "impossible" },
  stack:         { top: "cheap",     front: "impossible", back: "impossible" },
  array:         { byIndex: "cheap", back: "cheap",       middle: "expensive", front: "expensive" },
  "linked-list": { front: "cheap",   back: "cheap",       middle: "cheap",     current: "cheap" },
}

// Willow cost words for display (no Big O):
//   cheap -> "free/small", expensive -> "large", impossible -> "can't do that here"
```

A segment authors only:

- the structures offered in its palette,
- the operations to place (with the allowed UI positions),
- the required `operation -> position` mapping(s) that define correctness,
- optional policy choices (for example, remove-current -> play next / step back / stop),
- an optional `eventScript` for the stress test or final review.

The generic classifier then runs:

```ts
function classify(design: DesignState, segment: SegmentSpec): Verdict {
  const costs = segment.required.map(({ op, position }) => {
    const placed = design.mapping[op]                 // where the learner put it
    if (placed !== position) return "misplaced"       // wrong target end/zone
    return CAPABILITY[design.structure][position] ?? "impossible"
  })
  if (costs.includes("impossible") || costs.includes("misplaced")) return broken(segment)
  if (costs.includes("expensive")) return strained(segment)
  return viable(segment)
}
```

Worst cost wins: any impossible or misplaced mapping -> **broken**; any expensive -> **strained**; all cheap -> **viable**. Each verdict carries an authored `explainId` and optional `nudgeId`.

**Final-review segments (A4, B5) grade differently.** They are a prediction checked against a pure event-script simulator, not the capability matrix. Reuse `drainOrder` / `classifyVerdict` (`src/features/lesson/stacksQueuesEngine.ts`), `correctLine` / `diagnoseBufferTrace` (`src/features/poly/diagnose.ts`), and a `simulate(ops)` helper harvested from the prototype `Trace` style. The replay pauses where the learner's prediction diverges (`pauseAtDivergence`).

This keeps authoring tiny, grading fully deterministic, and avoids per-segment special cases on the common path. Genuinely segment-specific rules (rare) can add a small extra predicate, but the matrix covers Mission A and B.

## 6. Content model (authoring schema)

```ts
interface OperationSpec {
  id: string                 // "arrival", "serve", "undo", "addAfterCurrent", "removeCurrent"
  label: string              // "new arrival"
  allowedPositions: Position[]
}

interface RequiredMapping { op: string; position: Position }

interface SegmentSpec {
  id: string
  clientPrompt: string
  offeredStructures: StructureKind[]
  operations: OperationSpec[]
  required: RequiredMapping[]
  policy?: { id: string; options: string[]; correct: string[] }
  eventScript?: Step[]
  grading: "capability" | "prediction"
  explanations: Record<string, string>   // explainId -> copy
  nudges: Record<string, string>          // nudgeId -> copy
}

interface MissionSpec {
  id: string
  clientSkin: string
  inheritsFrom?: string                   // Mission A id, for design memory
  segments: SegmentSpec[]
}

interface TrialSpec {
  id: string                              // "trial-1-linear"
  title: string                           // "Trial I: Linear Systems"
  exercisedConcepts: ConceptId[]          // boosted on completion
  missions: MissionSpec[]
}
```

All content for Trial I and the Trial II skeleton lives as data under `src/trials/`, hand-authored and unit-testable.

## 7. Trial I content spec

Structures and learner-facing meaning: Stack (newest-first, last action on top), Queue (oldest-first, front served, new enters back), Array (slots/positions; middle edits shift later items), Linked list (connected sequence; neighbor links matter for middle insert/remove).

### Mission A: The Line Breaks (school event check-in desk)

| Segment | Client request | Offered | Required mapping | Expected verdicts |
| --- | --- | --- | --- | --- |
| A1 Intake | Students arrive at the back; serve whoever waited longest | queue, linked-list, array | arrival -> back, serve -> front | queue/linked-list viable; array strained (front serve shifts) |
| A2 Cancellation | A middle student leaves; close the gap | queue, array, linked-list | remove -> middle (plus A1 mappings) | linked-list viable; array strained (shift); queue broken (middle impossible) |
| A3 Undo desk action | Undo the most recent desk action | add a stack support slot | record -> top (push), undo -> top (pop) | stack viable; queue for undo broken |
| A4 Final review | Mixed script: 5 arrive, 1 leaves middle, 2 served, last action undone, 1 arrives | the system built so far | prediction | predict front + what undo reverses; pause at divergence |

Per-segment animation (presentational): A1 `enterFromBack` + `exitFromFront`, ends labeled after commitment; A2 `unlinkNodes` + `rewireNeighbors` (list), `shiftArrayAfterRemove` (array), `highlightFrontBack` + shake (queue broken); A3 `pushToStack` / `popFromStack` in an Undo Tray; A4 `compressToTimeline` + `replayEventScript` + `pauseAtDivergence`.

Authored nudges (attention only, never the answer): A1 "Which student should leave first: the newest, or the one who waited longest?"; A2 "Watch what changes when the middle student leaves. Is only one end changing?"; A3 "Undo fixes the newest mistake first, not the oldest."; A4 "One structure owns the line; another owns the history. Keep those jobs separate."

### Mission B: The Playlist Machine (music app playlist editor)

Inherits Mission A as design memory: the opening reminds the learner they used an editable line plus an undo stack, and asks what transfers. This is memory, not literal data.

| Segment | Client request | Required mapping / choice | Expected reasoning |
| --- | --- | --- | --- |
| B1 Current song | Need next and previous | next -> current's right neighbor, previous -> left neighbor | a current-item system, not just front/back; linked-list clean, array viable |
| B2 Add after current | Insert a song right after current | insert -> after current (middle) | current links to new; new links to old next |
| B3 Remove current | Remove current, keep playing | policy: play next / step back / stop | removal changes the chain and the current marker |
| B4 Undo last edit | Undo the latest edit | reuse stack for edit history | undo restores links and the current marker if changed |
| B5 Final design review | Compact playlist script | prediction | local neighborhood + current marker + undo together |

Animation: `moveCurrentPointer`, `highlightCurrent`, `linkNodes` / `unlinkNodes` for insert/remove, two-pane predicted-vs-actual replay in B5.

### Trial I completion retrospective copy

"You discovered: front/back systems are not the same as current-item systems; undo needs newest-first history; middle edits require reconnecting neighbors or shifting positions; a design can work at first and become strained later."

### Trial II skeleton (data only, to keep the engine general)

Mission A "The Lost Item Desk" (hash for find-by-tag, BST for alphabetical, heap for most-urgent, multi-structure final). Mission B "The Rescue Dispatcher" (heap priority, hash lookup, tree hierarchy, graph-as-relationship if graphs are taught, multi-structure final). Extend `CAPABILITY` and `Position` for keyed lookup, ordered display, priority-top, and neighbor-only graph reads. Graph stays at "represent connections," no traversal until the graph lesson decides.

## 8. Mastery boost

```ts
// Additive, pure, unit-tested. The ONLY new entry point into the concept ladder.
function reinforceCheckpoint(
  r: ConceptReview,
  ev: { at: number; cleanPass: boolean },
): ConceptReview
// cleanPass:  level = min(level + 1, MAX_LEVEL); refresh lastSeenAt, dueAt, graduated. Bypasses the massed rule.
// !cleanPass: level unchanged; refresh strength/dueAt so the concept reads strong again.
```

- Called exactly once on Trial completion, for each id in `TrialSpec.exercisedConcepts`, capped to one promotion per Trial.
- Trial I exercised concepts (tunable): `stacks-and-queues:queuePredict`, `stacks-and-queues:stackPredict`, `arrays:deleteCount`, `arrays:insertCount`, `linked-lists:insert`, `linked-lists:delete`, `linked-lists:traverse`, `linked-lists:playlist`.
- Anonymous users: boost applies in memory only and is not persisted (same rule as lessons today).

## 9. Save-state model

Fits the existing `ProgressRepository` seam. Full in-run state lives in a provider ref map; a durable resume slice writes to Firestore at `users/{uid}/trialProgress/{trialId}` using the same optimistic fire-and-forget + sign-in reconcile idiom as `useLessonRun`.

```ts
interface TrialSaveState {
  trialId: string
  missionId: string
  segmentId: string
  unlockedSegments: string[]
  chosenStructures: Record<string, StructureKind>   // by slot
  operationMappings: Record<string, Position>        // op id -> position
  policyChoices: Record<string, string>
  revisionHistory: RevisionRecord[]
  nudgesShown: string[]
  stressTestsRun: string[]
  missionAArtifact?: DesignArtifact                   // design memory for Mission B
  missionBArtifact?: DesignArtifact
  completed: boolean
  cleanPass: boolean
}
```

Resume granularity is the segment. Repository additions: `getTrialProgress(uid, trialId)`, `saveTrialProgress(uid, trialId, slice)` on `ProgressRepository`, with Firestore and in-memory implementations.

## 10. Architecture and file plan (non-invasive)

Engine (pure, no React, unit-tested), mirroring the `LessonModule` seam as a `TrialModule`:

- `src/features/trials/types.ts` (StructureKind, Position, Cost, specs, save-state)
- `src/features/trials/capability.ts` (the matrix + `classify`)
- `src/features/trials/simulate.ts` (event-script simulator, harvested from the prototype)
- `src/features/trials/reinforceCheckpoint.ts` (boost)
- `src/features/trials/gating.ts` (`trialUnlocked`, soft chaining)
- `src/features/trials/trialModule.ts` (create / reducer / toProgress / resume / completed / Stage seam)

Content:

- `src/trials/trialOne/*` (TrialSpec data for Mission A and B, plus retrospective copy)
- `src/trials/trialTwo/*` (data skeleton only)

UI (reuses willow components and figures):

- `TrialGate`, `TrialPlayer`, top bar, `ClientScene`, `DesignBoard` (palette + chips + slots + rule echo), `StressTestPanel`, `RevisionTimeline`, `NudgeDrawer`, `RetrospectivePanel`.
- Reuse `StackBin`, `QueueTube`, `StructCell`, `ArrayStrip`, `NodeGraph`, `RewireSurface`, `FrameSequence`, `StepTransport`, `Button`, `AnswerCard`, `FeedbackFooter`, lilac tokens.

Integration (additive only):

- Navigation: add `{ name: "trial"; trialId: string }` to `src/lib/navigation.tsx` and route it in `App.tsx` via a `TrialHost`.
- Persistence: extend `ProgressRepository` as above.
- Boost: one call site on completion into the concept-review write path.
- Course path: one additive Trial node kind; the path's existing lesson unlock rules are untouched. Trial availability is computed by `trials/gating.ts`, not by editing `catalog.ts` unlock logic.

Reduced motion: follow the established pattern (`useReducedMotion`, snap-to-final, fade plus state label, stepper instead of timeline replay).

## 11. Reusable animation primitives (mapping)

| Brief primitive | Existing implementation |
| --- | --- |
| enterFromBack / exitFromFront | `QueueTube` + `StructCell` x-offset enter/exit |
| pushToStack / popFromStack | `StackBin` + `StructCell` y-offset enter/exit |
| shiftArrayAfterInsert/Remove | `ArrayStrip` ripple + `shiftFrames` |
| linkNodes / unlinkNodes / rewireNeighbors | `NodeGraph` rewire + `RewireSurface` |
| moveCurrentPointer / highlightCurrent | `NodeGraph` cursor / frontier |
| highlightFrontBack / highlightTop | `showEnds` on `QueueTube` / `StackBin` |
| compressToTimeline / replayEventScript / pauseAtDivergence | `FrameSequence` + `StepTransport` |

## 12. Do not build yet (from the brief)

Freeform essay grading; arbitrary graph editing; full branching timelines; complex memory/capacity constraints; code or pseudocode input; AI grading; multi-hour mechanics; best-score or competitive scoring; the free-form draggable board (deferred upgrade from the guided board).

## 13. Build order

1. Engine + state seam: `TrialModule`, capability matrix, classify, save-state, `TrialHost`, navigation, repository methods.
2. Design Board loop: structure palette, tap-to-place chips with rule echo, revision timeline, stress-test panel returning viable/strained/broken.
3. Linear visual primitives wired into the board (reuse figures) + event replay.
4. Mission A: The Line Breaks (proves client pressure + revision).
5. Mission B: The Playlist Machine (proves design memory + current-item reasoning).
6. Retrospective + boost (`reinforceCheckpoint`) + gating + Trial Gate polish.
7. Trial II data skeleton to confirm the engine generalizes.

## 14. User stories

Student: enter a Trial and feel it differs from a lesson; choose a structure and see what it naturally handles; revise without losing progress; run a stress test and watch it succeed/strain/break; receive a nudge that points attention without giving the answer; leave and return with state preserved; finish and see what the design learned; carry design memory from Mission A into Mission B.

Engine: load a campaign of missions and segments; store structures, mappings, policies, revisions; evaluate a design with deterministic checks; replay event scripts; classify viable/strained/broken; choose nudges from the current failed constraint; save and restore progress; expose presentational state to animation without letting it affect verdicts.

## 15. Open questions / risks

- Tap-to-place clarity for weak-visual learners: validate with the first Mission A build; the rule echo is the mitigation.
- Exercised-concept set for the boost is tunable; confirm against curriculum once Trial I plays end to end.
- Trial II's `CAPABILITY` extension (keyed lookup, ordered display, priority, neighbor reads) is sketched, not finalized; finalize when Trial II is built.
- Keep grading on the capability matrix; resist per-segment bespoke logic creeping in.
