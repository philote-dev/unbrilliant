# De-cuing Sweep Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. This is a correctness/integrity pass: no segment may give away its answer on the question screen. Teach earlier, explain in feedback after the learner commits.

**Goal:** Audit all eight lessons and remove every accidental answer give-away on the question screen, while preserving designs where visible data is intentional (not a leak). Bring every lesson to the house rule: "never give away the answer on the question screen."

**Architecture:** Mostly copy and small render changes. Where a give-away is structural (the answer is readable from visible state), adjust the question construction in the pure engine (with tests). Where it is in option wording, neutralize the labels and move the explanation into the post-commit feedback (`correct` / `why`).

**Tech stack:** TypeScript, React 19, Vitest (node + jsdom) + Testing Library, oxlint.

---

## Decisions locked (from planning Q&A)

- **Scope:** full sweep across all 8 lessons; fix every give-away found.
- **Judgment rule:** **preserve intentional designs**; only fix accidental answer-state leaks. Example to preserve: the Graphs draw segments intentionally show the full adjacency list ("the list is the plan, sync the map to it"); that is on-message, not a leak.
- **Known fixes:**
  - Hash Tables `hash-cat-again`: today the table shows cat already in bin 4 while asking which bin it hashes to. Fix by asking about a **fresh key not yet placed**, so the bin must be computed from scratch.
  - Trees `compare-shape`: the correct MCQ option text states the thesis. Neutralize the option labels; move the explanation to `correct` / `why`.
  - Linked Lists contrast segments: today they are 50/50 binary picks whose option labels embed the winning strategy. Per the lesson review, redesign them as **two-step**: the learner makes the pick (low-stakes, "nice pick"), then a **why-MCQ pops up** as the real graded question (testing the reason, not the coin-flip). This both de-cues (the pick no longer hands over the rule) and deepens the check. Prototype a few why-MCQ framings in the gallery; decide at the gate whether the pick is also graded or just the why-MCQ.

## Constraints (baked in)

- **A. No seam / persistence change.** Question-construction tweaks stay inside the engine; `LessonProgress` shape is untouched. (Migration is not a concern per the owner, but the persistence shape here does not change anyway.)
- **D. Gallery + screenshots.** Re-screenshot each fixed question screen to confirm no give-away remains.
- House rules: no em dashes; no Big-O; house cost words only.

---

## File structure

**Audit artifact**
- The audit is recorded inline in this plan (Phase 1 checklist below). Each finding is tagged LEAK (fix) or INTENTIONAL (preserve, with a one-line reason).

**Known fixes**
- Modify `src/features/lesson/hashTablesEngine.ts` (+ `hashTablesEngine.test.ts`): change the `hash-cat-again` segment to a fresh, not-yet-placed key; assert the table does not already contain the asked key.
- Modify `src/features/lesson/treesEngine.ts` (+ `treesEngine.test.ts`): neutral `compare-shape` option labels; assert no option text contains the comparison verdict words; move the verdict into `correct` / `why`.
- Modify `src/features/lesson/linkedListsEngine.ts` (+ `linkedListsEngine.test.ts`): neutral contrast option labels; assert no option text names the winning structure/strategy; explanation in feedback.
- Modify the corresponding `Stage.tsx` files only if a render reads the old labels.

**Gallery**
- Modify `src/dev/GalleryApp.tsx`: ensure presets exist for each fixed question screen (idle state) for the screenshot check.

---

## Phase 1: Full de-cuing audit (all 8 lessons)

- [x] **Step 1:** Every graded segment in all 8 lessons walked at its idle (pre-commit) state (engine + Stage). Findings recorded as the per-lesson tables below.
- [x] **Step 2:** The three known leaks are confirmed (HT `hash-cat-again`, Trees `compare-shape`, LL `contrast-insert` + `contrast-reach`) and one new leak surfaced (Heaps `map-parent`).
- [x] **Step 3:** Intentional designs to preserve confirmed (Graphs read + draw segments' visible adjacency list; the de-cued S&Q predict/classify/contrast and Arrays/Trees/LL reference patterns). Reasons recorded.
- [x] **Step 4:** Fix list (LEAKs) written below for Phase 2; BORDERLINE calls listed separately for the owner.

### How the audit read each segment

- Answer markers across every figure (`data-answer`, `data-rewire-correct-target`, `data-write-order`, `data-heap-correct-slot`, `data-inorder-rank`, `data-hash-correct-bucket`) are all `import.meta.env.DEV` gated and/or `sr-only`. They are e2e tracer hooks, not visible cues, so they are not leaks.
- "Reveal" highlights (the correct cell, bucket, slot, path, or arrangement going green) are gated behind the post-commit verdict in every Stage. Pre-commit, only the learner's own pick is styled.
- So a segment leaks only when the answer is readable from genuine on-screen content at idle: an already-placed key, an option label that states the rule or cost, a lit connector that points at the answer, or an inherently visible target.

Tag key: **LEAK** (fix in Phase 2), **INTENTIONAL** (preserve; on-message scaffold or fair question), **BORDERLINE** (owner judgment).

### Summary counts

| Lesson | LEAK | BORDERLINE | INTENTIONAL | Graded segments |
| --- | --- | --- | --- | --- |
| intro | 0 | 0 | 4 | 4 |
| stacks and queues | 0 | 0 | 8 | 8 |
| arrays | 0 | 0 | 7 | 7 |
| linked lists | 2 | 0 | 5 | 7 |
| hash tables | 1 | 2 | 6 | 9 |
| trees | 1 | 2 | 5 | 8 |
| heaps | 1 | 1 | 6 | 8 |
| graphs | 0 | 0 | 8 | 8 |
| **Total** | **5** | **5** | **49** | **59** |

### intro (`introEngine.ts` + `intro/IntroStage.tsx`)

Four MCQ checks. The welcome and reading segments are ungraded and excluded.

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `store` | Scenario + three neutral job options (Store / Sort / Categorize); decorative icon | INTENTIONAL | Fair concept MCQ; no option states "this is the answer"; engine notes the icon never hints | Preserve |
| `sort` | Same three job options | INTENTIONAL | Fair concept MCQ; mapping scenario to job is the skill | Preserve |
| `categorize` | Same three job options | INTENTIONAL | Fair concept MCQ | Preserve |
| `why` | Two options "Alphabetized" (neat) vs "Loose shoebox" (messy) | INTENTIONAL | The neat-vs-messy picture is the lesson thesis (order speeds lookup), not an accidental leak; labels do not state which is faster | Preserve |

### stacks and queues (`stacksQueuesEngine.ts` + `stacksQueues/Stage.tsx`)

This lesson is the already-rebuilt de-cue (the old "tap the tagged top card" was removed). The exit end carries no TOP / FRONT tag on graded segments (`showEnds` is teach-only), and `answerId` is a DEV hook.

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `stack-predict` | Untagged stack of 4; ask is "after two pops, what is on top?" | INTENTIONAL | De-cued: the after-k ask forces a two-pop simulation, not a read of the top | Preserve |
| `stack-realworld` | Browser history pages, exit untagged | INTENTIONAL | De-cued: learner must apply "Back removes the most recent" | Preserve |
| `stack-construct` | Target exit order + loose cards | INTENTIONAL | Do-it mechanic; correct push order is DEV-only | Preserve |
| `queue-predict` | Untagged queue of 3 | INTENTIONAL | De-cued: front is not tagged; FIFO must be applied (position conveys order, but identifying the exit needs the rule) | Preserve |
| `queue-realworld` | Print queue documents, exit untagged | INTENTIONAL | De-cued real-world FIFO | Preserve |
| `queue-construct` | Target exit order + loose cards | INTENTIONAL | Do-it mechanic; push order not hinted | Preserve |
| `classify` | In-order and out-order shown; neutral options (A stack / A queue / Neither) | INTENTIONAL | Verdict must be computed from the transformation; labels are neutral. This is the model contrast pattern | Preserve |
| `contrast` | Arrival + target named; neutral options (A stack / A queue) | INTENTIONAL | Reason from "stack serves newest"; labels neutral. Model pattern | Preserve |

### arrays (`arraysEngine.ts` + `arrays/Stage.tsx`)

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `jump` | Indexed strip; no cell lit (engine comment "no lit cell") | INTENTIONAL | De-cued tap; the index must be applied; answer cell is a DEV hook | Preserve |
| `scan` | Strip face-down; only the front frontier is tappable | INTENTIONAL | The value is hidden until walked to, so there is no spot-and-tap; the cost is the payload | Preserve |
| `insert` | Array + insert index; numeric count options (ascending) | INTENTIONAL | Count is computed from the visible row; position never marks the answer | Preserve |
| `delete` | Array + delete index; numeric options | INTENTIONAL | Same predict-the-count design | Preserve |
| `place-cheapest` | Shuffled row; every gap is a legal drop target | INTENTIONAL | No gap pre-lit; learner must reason the tail is cheapest; correct gap is DEV-only | Preserve |
| `realworld` | Spreadsheet rows (1-based); numeric options | INTENTIONAL | Same predict-the-count design | Preserve |
| `grow` | Full block + 3 strategy options | INTENTIONAL | The full block is the premise, not a leak; the double-vs-grow-by-one discrimination is not given away | Preserve |

### linked lists (`linkedListsEngine.ts` + `linkedLists/Stage.tsx`)

`node-demo`, `teach`, and `doubly` are ungraded. Rewire glow lights every reachable node (not the answer); the save-first order hint is DEV/`sr-only`.

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `traverse` | Chain A..E; tap the asked node | INTENTIONAL | Tap-the-node de-cue; no answer marker; the hop walk is the cost | Preserve |
| `rewire-insert` | Chain + loose X; all reachable nodes glow | INTENTIONAL | Do-it mechanic; correct save-first order is not shown | Preserve |
| `rewire-delete` | Chain; bypass the named node | INTENTIONAL | Do-it mechanic; which pointer to re-aim is not shown | Preserve |
| `predict` | Intact chain; options "works" / "everything after prev is lost" / "loops" | INTENTIONAL | Genuine predict-the-consequence MCQ; the break is not shown at idle; outcomes are distinct misconceptions | Preserve |
| `playlist` | Playlist queue + loose track | INTENTIONAL | Real-world insert; do-it mechanic | Preserve |
| `contrast-insert` | Array + list figures; options "List, rewire 2 pointers" / "Array, shift N cells" / "Same" | **LEAK** | The option labels embed each structure's cost, so "which does less work" is answered by comparing the numbers in the labels, no reasoning needed | Neutralize labels (List / Array / Same), move the cost numbers into `correct`/`why`; or adopt the two-step pick + why-MCQ |
| `contrast-reach` | Array + list figures; options "Array, jump straight there" / "List, walk N hops" / "Same" | **LEAK** | Same: the labels embed the strategy and cost, so the winner reads off the labels | Same fix as `contrast-insert` |

### hash tables (`hashTablesEngine.ts` + `hashTables/Stage.tsx`)

`HashBox` withholds the `mod` result (shows `?`) on every graded segment, so the bucket is never pre-computed for the learner. Leaks here come only from chain contents drawn in the table.

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `hash-cat` | Empty table; compute cat's bin | INTENTIONAL | Nothing placed; bin must be computed | Preserve |
| `hash-cat-again` | Table already shows `cat` in bin 4; ask is which bin cat hashes to | **LEAK** | The asked key sits in its bin, so the answer is read off instead of computed | Ask a fresh key not already in the seeded table; assert the asked key is absent from `table`; keep the determinism teaching in `correct`/`why` |
| `hash-dog` | Table shows `cat` in bin 4; dog hashes to empty bin 1 | INTENTIONAL | The asked key (dog) is not placed; cat is a distractor | Preserve |
| `collide-sun` | Bin 4 shows `cat`; prompt gives the bin; options are 4 collision strategies | INTENTIONAL | The collision result is not shown at idle; chaining must be known; bin is given, not the verdict | Preserve |
| `collide-ant` | Bin 0 shows `owl, fox`; 4 strategy options | INTENTIONAL | Same; result not shown | Preserve |
| `collide-pig` | Bin 2 shows `bee`; 4 strategy options | INTENTIONAL | Same | Preserve |
| `lookup-found` | Bin 0 shows `owl, fox, ant`; ask "where is fox stored?" | BORDERLINE | `fox` is visibly in the only occupied bin, so the bin reads off the chain rather than from hashing (same family as `hash-cat-again`); but "found" inherently shows the key, so the fix is non-trivial | Owner: add decoy occupied bins so the occupied bin is not unique, and/or hide chain contents until the post-commit trace |
| `lookup-absent` | Bin 3 shows `elk`; ask "is bat here?" | BORDERLINE | `bat` is absent (not visible), so it must be hashed; but bin 3 is the only occupied bin and bat maps there, so "tap the occupied bin" is a weak shortcut | Owner: same decoy-bin mitigation; weaker than `lookup-found` |
| `realworld` | Warehouse; `sam` in bin 3; ivy hashes to bin 1 | INTENTIONAL | The asked key (ivy) is not placed; bin must be computed | Preserve |

### trees (`treesEngine.ts` + `trees/Stage.tsx`)

Descend segments: both children are equally tappable, the correct next step is a DEV hook, and the target node is not highlighted. Sequence segments use a scrambled compact layout at idle (the tidy sorted layout only assembles on reveal).

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `find-hit` | Balanced tree, all keys; find 10 | INTENTIONAL | Target not highlighted; the descend must be done; no correct-child cue | Preserve |
| `find-miss` | Tree; find 7 (absent) | INTENTIONAL | The value is not in the tree; nothing to read off | Preserve |
| `insert` | Tree; where does 5 attach (absent) | INTENTIONAL | Absent value; descend to the ghost slot | Preserve |
| `sequence-a` | Balanced tree, scrambled compact layout | BORDERLINE | In-order equals the sorted keys, so a learner can tap by ascending value without applying left-node-right; the scramble defeats positional reading and the keys cannot be hidden | Owner: preserve (sorted output is the lesson) or require the traversal (lock taps to the legal next in-order node, or use non-sortable labels) |
| `sequence-b` | Zigzag tree, scrambled compact layout | BORDERLINE | Same value-sort shortcut; the zigzag still defeats positional reading | Owner: same call as `sequence-a` |
| `realworld` | Tournament bracket; find the 6 seed | INTENTIONAL | Same as a descend find; target not highlighted | Preserve |
| `compare-shape` | Balanced tree + stick, captioned "Balanced" / "Same nodes, one long branch"; correct option reads "Same keys, same in-order order, but the stick walks and the balanced tree halves" | **LEAK** | The correct option states the whole thesis and the two distractors are trivially false; the figure captions reinforce "same keys" and "one is a stick" | Neutralize the three option labels (name the two shapes only, no verdict) and the figure captions ("Tree A" / "Tree B" or similar); move the verdict into `correct`/`why` |
| `contrast-list` | Sorted list + tree; walk both | INTENTIONAL | Do-both felt comparison; there is no pick to give away. Model contrast pattern | Preserve |

### heaps (`heapsEngine.ts` + `heaps/Stage.tsx`, `heaps/HeapDualView.tsx`)

Arrangement segments show only the given heap at idle (no connector, no highlight); the candidate cards are not pre-marked. The leak is in the slot/map segments: `SlotLocatePart` passes `connectorSlot={q.subjectSlot}` unconditionally, so `HeapDualView` draws the subject's family connector (a lilac array arc plus a lit tree edge) at idle.

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `siftup-1` | Given heap + "Insert K" chip; 4 arrangement cards | INTENTIONAL | The post-sift arrangement must be computed; no card pre-marked | Preserve |
| `siftup-skin` | ER triage board + incoming severity; 4 arrangement cards | INTENTIONAL | Same arrangement compute, skinned | Preserve |
| `siftdown-1` | Given heap + "Extract top" chip; 4 cards | INTENTIONAL | Post-sift-down arrangement must be computed | Preserve |
| `siftdown-2` | Deeper heap; 4 cards | INTENTIONAL | Same | Preserve |
| `map-child` | Subject slot 0 lit; family connector lights both child slots (1, 2) | BORDERLINE | The connector hands over which slots are the children, so the index step (2i+1 / 2i+2) is bypassed; the larger-by-value judgment still survives | Drop `connectorSlot` on graded map segments (gate it behind the reveal like `revealSlot`) | 
| `map-parent` | Subject slot 4 lit; family connector draws a lit arc + tree edge straight to slot 1 (its parent) | **LEAK** | The connector points at the parent slot (the answer) before commit, so (i-1)/2 is read off the lit edge, not computed | Stop drawing the subject family connector pre-commit on graded map segments; for `map-parent` also avoid lighting the subject-to-parent tree edge so the parent is computed, not traced |
| `contrast-place` | Given heap + "Insert K (not a BST)"; 4 cards | INTENTIONAL | Heap-vs-BST arrangement must be computed; prompt warns off the BST foil | Preserve |
| `contrast-samedata` | Tree node highlighted; tap the array cell with the same data | INTENTIONAL | No connector (subjectSlot is null); matching by value/index is the "same data" insight itself | Preserve |

### graphs (`graphsEngine.ts` + `graphs/Stage.tsx`)

The lesson's thesis is "the adjacency list is the data; the picture is decoration," so showing the list on read and draw segments is on-message, not a leak (the teach segment even hides the picture to make the list carry the weight). Classify segments use neutral options.

| Segment | Visible at idle | Tag | Reason | Fix |
| --- | --- | --- | --- | --- |
| `read-list` | Picture + adjacency list; tap C's connections | INTENTIONAL | Reading C's row is the graded skill; the marked node is the subject, the answer set is not pre-highlighted | Preserve |
| `read-degree` | Picture + list; tap D's neighbors | INTENTIONAL | Reading the list is the skill | Preserve |
| `read-path` | Picture + list, pair ringed; Yes / No | INTENTIONAL | Connectivity must be traced; neutral options | Preserve |
| `match-list` | Picture + 4 candidate adjacency lists | INTENTIONAL | Comparing list to picture is the skill; answer marker is DEV-only | Preserve |
| `draw-edge` | Picture missing one edge + full route list | INTENTIONAL | The known preserve: the list is the plan, sync the map to it | Preserve |
| `draw-transit` | Transit map missing one segment + full route list | INTENTIONAL | Same known preserve, skinned | Preserve |
| `same-graph` | Two layouts of one network; Same / Different | INTENTIONAL | Compare edge sets; neutral options | Preserve |
| `tree-or-not` | One graph; Tree / General graph | INTENTIONAL | Spot the cycle; neutral options | Preserve |

### Consolidated LEAK fix list (Phase 2 input)

1. **HT `hash-cat-again`** (`hashTablesEngine.ts`, `BEATS["hash-cat-again"]` + `makeHash`): the table is seeded with `{ 4: ["cat"] }` while asking which bin `cat` hashes to. Ask a fresh key that is not already in the table so the bin must be computed. Test: assert the asked key is not present in `table`. Keep the "same key, same bin" determinism teaching in `correct`/`why`.
2. **Trees `compare-shape`** (`treesEngine.ts`, `makeCompare` + `trees/Stage.tsx` `ComparePart`): the correct option text states the verdict and the captions ("Balanced" / "Same nodes, one long branch") pre-state "same keys" and "one is a stick." Neutralize all three option labels (name the two shapes only) and the two captions; move the balanced-vs-stick conclusion into `correct`/`why`. Test: no option label or caption contains the verdict tokens (for example "halves", "walks", "same keys").
3. **LL `contrast-insert`** (`linkedListsEngine.ts`, `makeContrastInsert`): labels embed the cost ("rewire 2 pointers" / "shift N cells"). Make labels neutral (List / Array / Same), move the counts into `correct`/`why`; or implement the planned two-step pick then why-MCQ. Test: no option label names the winning structure's cost or strategy.
4. **LL `contrast-reach`** (`linkedListsEngine.ts`, `makeContrastReach`): same leak ("jump straight there" / "walk N hops"). Same fix and test.
5. **Heaps `map-parent`** (`heaps/Stage.tsx` `SlotLocatePart` + `heaps/HeapDualView.tsx`): the subject family connector is drawn pre-commit and points at the parent slot. Gate `connectorSlot` behind the post-commit reveal on the graded map segments (it already does this for `revealSlot`); for `map-parent` also stop lighting the subject-to-parent tree edge at idle. Test: at idle on a map segment, no `data-testid="heap-connector"` arc and no lit family edge to the answer slot.

### BORDERLINE calls for the owner

- **HT `lookup-found`** and **`lookup-absent`**: the found key sits in the only occupied bin (`lookup-found`), and the absent key maps to the only occupied bin (`lookup-absent`), so the bin can be tapped without hashing. Both are entangled with "found requires showing the key." Suggested fix if the owner wants them tightened: seed decoy occupied bins so the occupied bin is not unique, and/or keep chain contents hidden until the post-commit "Scan the bin" trace.
- **Trees `sequence-a`** and **`sequence-b`**: in-order traversal output equals the sorted keys, so a learner can tap by ascending value without applying left-node-right. The scrambled layout already defeats positional reading, and the sorted output is the lesson's payoff, so there is no clean copy fix. Owner: preserve, or require the traversal (lock taps to the legal next in-order node, or switch to labels with no obvious sort order).
- **Heaps `map-child`**: the same family connector lights both child slots, handing over the child indices; the larger-by-value judgment still survives. The `map-parent` fix (drop the pre-commit connector) tightens this segment at the same time.

### Designs explicitly preserved (not leaks)

- **Graphs read and draw segments** intentionally show the full adjacency list: the list is the data and reading or syncing to it is the graded skill.
- **S&Q `classify` / `contrast`** and **Trees `contrast-list`** are the model de-cued contrasts: neutral options (or a do-both felt comparison) with the cost revealed only after the commit. Phase 2 should bring the LL contrasts to this same shape.
- **S&Q predict / construct** and **Arrays jump / scan / counts / place-cheapest** are already de-cued (untagged exit, face-down scan, computed counts, no pre-lit gap).

## Phase 2: Apply fixes (test-first, per leak)

For each LEAK:
- [ ] **Step 1 (test-first):** Add an engine test asserting the give-away is gone (e.g. the asked key is not already in the table; no option label contains a verdict/answer token; the correct target is not visually marked pre-commit).
- [ ] **Step 2:** Apply the minimal fix (regenerate the question / neutralize labels / move the reveal into feedback).
- [ ] **Step 3:** Keep the feedback (`correct` / `why`) carrying the full explanation so teaching is not lost.
- [ ] **Step 4:** Run the lesson's engine tests + DOM tests green.

Specifics:
- [ ] HT `hash-cat-again`: ask a fresh key (e.g. one not in the seeded table); assert determinism teaching still lands via feedback ("same key always lands in the same bin").
- [ ] Trees `compare-shape`: options become neutral (e.g. the two shapes by name, no verdict); `correct`/`why` deliver the balanced-vs-stick conclusion.
- [ ] LL contrast: options become neutral (the two structures, no strategy text); `correct`/`why` deliver the trade-off.

## Phase 3: Verify + review gate (D)

- [ ] **Step 1:** `npx tsc -b`, `npm run test`, `npm run lint` clean.
- [ ] **Step 2:** Gallery: screenshot each fixed question screen at idle (phone viewport) into `docs/reference/`; confirm nothing on screen reveals the answer.
- [ ] **Step 3:** Present the audit table + before/after screenshots to the owner; delete one-off screenshots after sign-off.

---

## Risks / open items

- The audit may surface borderline cases (is this visible cue a teaching scaffold or a leak?). Default to preserve when it is clearly intentional and on-message; flag genuine borderline calls for the owner rather than guessing.
- Neutralizing option labels can make an MCQ feel terse; keep labels concrete (name the real things) without stating the verdict.

## Self-review

- Full sweep, all 8 lessons, preserve intentional: Phase 1. Covered.
- Three known fixes with the chosen approaches (fresh key; neutral labels + feedback reveal): Phase 2. Covered.
- Tests assert give-aways are gone; teaching preserved in feedback: Phase 2. Covered.
- Constraints A + D, house rules: stated. Covered.
