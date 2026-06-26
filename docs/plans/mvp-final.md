# PRD: Willow, Final MVP (platform-forward, two-lesson Data Structures)

> Status: draft, not yet published to the issue tracker (decision: PRD/plan only for now).
> Source: synthesized from the application-experience grilling session (Jun 23, 2026), building on the proto-1 record and `lesson-design.md` (lesson principles + Arrays spec).
> This is the target scope for the final MVP: it keeps proto-1's engine/feedback/flame mechanics intact and extends them to a real, multi-lesson, platform-forward, real-data experience.

## Problem Statement

Willow's *product ambition* is a learn-by-doing **course platform** (Brilliant-shaped: many courses, each a path of lessons). But the proto-1 build only *looks* like a platform while *delivering* a single lesson: it shows three courses and a seven-node path where almost everything is locked, presents a hardcoded "20% complete," labels the next lesson "Arrays" as *available / Up next* when it isn't playable, greets a brand-new visitor with "Welcome back," promises to "save your streak" when the streak isn't saved, and re-presents the same one lesson across Home, the course catalog, the course path, and the Progress tab. The result is a shell that feels hollow and dishonest. Exactly the wrong first impression for the MVP's target person: a **high-school CS student** who arrived to actually learn data structures.

The learner can't tell what's real, the chrome doesn't earn its place, and the "platform" framing is undermined by fake data and dead-end affordances.

## Solution

Make the platform **real and honest, and lean into it** rather than hiding it.

- **Two fully-playable lessons.** Ship **Stacks & Queues → Arrays** as real lessons, with finishing the first **really unlocking** the second. The rest of the Data Structures path and the other two courses remain visible but **honestly locked** ("coming soon"). Locked previews that sell the roadmap instead of faking availability.
- **Everything that was fake becomes real.** Real per-course/per-lesson progress, real streak state with honest sign-in-to-save messaging, real unlock/advance on completion, real account/profile data, and a genuine **first-run vs returning** distinction.
- **De-duplicated, purposeful IA.** Four tabs, each with a distinct job: an **adaptive Home** (a vision/marketing hero for first-timers that hands off to a personalized **dashboard** once they've entered a course), **Learn** as the course catalog, **CourseDetail** as the lesson path, and **Progress** rebuilt as a **deep drill-down** (history/accuracy/mastery) rather than a second copy of the path.

A high-school CS student lands on a hero that speaks to *learning data structures by doing* (with the broader course roadmap visible beneath it as the platform), browses into the Data Structures course, plays a genuinely interactive Stacks & Queues lesson, sees honest progress, and on finishing it watches **Arrays** actually unlock. A small but real progression that proves the platform is alive.

## User Stories

### Platform framing & first-run vision hero

1. As a first-time visitor with no progress, I want Home to show a **vision/marketing hero** (not "Welcome back"), so that I understand what Willow is before I'm asked to do anything.
2. As a high-school CS student who came to learn data structures, I want the hero headline to speak to **learning data structures by doing**, so that it feels made for me.
3. As a prospective learner, I want the broader course roadmap (Algorithms, Probability) **visible beneath the hero as "the platform"**, so that I see Willow is more than one subject.
4. As a curious first-timer, I want a **playable Stack/Queue taste** embedded in the hero, so that I feel the "learn by doing" promise immediately, with no account.
5. As a first-timer, I want the hero's primary call-to-action to be **"Browse courses,"** so that I'm funneled into the catalog rather than dropped straight into one lesson.
6. As a learner who has entered a course, I want the marketing hero to **recede** and never nag me again, so that the app grows up with me.

### Adaptive Home / dashboard

7. As a returning learner (anyone who has entered a course), I want Home to become a **personalized dashboard**, so that I can get back to work fast.
8. As a returning learner, I want the dashboard to **resume my current lesson** as its primary action, so that I continue with one tap.
9. As a returning learner, I want my **streak / "on fire" state** shown on the dashboard, so that I feel my momentum.
10. As a returning learner, I want a **summary of my stats** on the dashboard, so that I get an at-a-glance sense of how I'm doing.
11. As a returning learner, I want a **peek at the roadmap** (what's next / locked) on the dashboard, so that I see where I'm headed.
12. As a learner, I want Home to flip from hero to dashboard **the moment I enter/select a course** (even before answering anything), so that the transition matches when I committed to learning.

### Course catalog (Learn) & course path (CourseDetail)

13. As a learner, I want a **Learn tab that is the full course catalog**, so that browsing courses has one clear home distinct from my dashboard.
14. As a learner, I want **Data Structures shown as available** with real progress, and **Algorithms + Probability shown as locked "coming soon,"** so that the catalog is honest about what I can do today.
15. As a learner, I want tapping a locked course to make clear it's **coming soon** (not silently do nothing), so that locked items don't feel broken.
16. As a learner in the Data Structures course, I want a **lesson path** that shows Stacks & Queues, Arrays, and the locked future lessons, so that I see the unit's shape.
17. As a learner, I want the path to reflect **real state** (completed, current, unlocked, locked) with no fake-available nodes, so that what I tap is what I get.
18. As a learner, I want a **Start/Continue** action on the course path, so that entering the active lesson is obvious.

### The two real lessons (Stacks & Queues, then Arrays)

19. As a learner, I want the **Stacks & Queues** lesson to play exactly as designed in proto-1 (push/pop + enqueue/dequeue prediction, served-first scenarios, templated feedback, the flame), so that the core learning experience is unchanged and proven.
20. As a learner, I want **Arrays** to be a **real, playable lesson** (not a static preview), so that the MVP delivers a genuine two-lesson progression.
21. As a learner in Arrays, I want to see that **access by index is instant ("free")** while **inserting/deleting in the middle shifts everything after it ("scales")**, so that I kill the misconception that "adding/removing anywhere is free."
22. As a learner in Arrays, I want to **predict the array's next state** after an insert or delete (which elements move, where), so that I prove I understand shifting.
23. As a learner in Arrays, I want to **predict the cost/count** (how many elements moved; whether an insert triggers a resize / "big reshuffle"), so that I feel the work without ever seeing Big-O.
24. As a learner in Arrays, I want the same **cost readout** (work-meter + house word + concrete count) used elsewhere, so that "free / scales / barely grows" means the same thing across lessons.
25. As a learner, I want Arrays to use the **same prediction/feedback/flame mechanics** as Stacks & Queues, so that I don't relearn the interface.
26. As a learner, I want completing **Stacks & Queues to unlock Arrays for real**, so that finishing a lesson visibly advances me.
27. As a learner, I want Arrays to stay **locked until I complete Stacks & Queues**, so that the sequence is honest and I'm not thrown into the harder idea first.
28. As a learner, I want **each lesson to have its own mastery gate** (correct predictions, failed/revealed never count), so that completion certifies understanding for that lesson.

### Progress (deep drill-down)

29. As a learner, I want the **Progress tab to show a deep view** (per-lesson history, accuracy, and mastery) so that I can understand my performance, not just where to go next.
30. As a learner, I want Progress to be **distinct from the course path and the dashboard summary**, so that it isn't a redundant third copy of the same list.
31. As a learner, I want my Progress numbers to be **real** (derived from what I actually did), so that I can trust them.

### Real data, accounts & honesty (the "make it real" rework)

32. As a learner, I want **course/lesson progress percentages to be real** (computed from lessons completed), so that "X% complete" is never a hardcoded lie.
33. As a learner, I want my **streak to be real**, and the "sign in to save it" promise to be **honest**, so that I'm not told something is saved when it isn't.
34. As a signed-in learner, I want my **account/profile data** (display name, signed-in state) to be real and shown correctly, so that the app reflects who I am.
35. As a brand-new learner, I want the app to **not pretend I'm returning**, so that first-run copy and actions match my actual state.
36. As a learner who completes a lesson, I want the **unlock/advance to persist** (once signed in), so that the next lesson stays unlocked when I come back.

### Onboarding, auth & persistence (inherited from proto-1, still required)

37. As a curious learner, I want to start playing **without an account**, so that I can try before committing.
38. As a learner, I want **Google one-tap or email/password** sign-in with a **required display name**, so that saving progress is low-friction.
39. As a learner playing anonymously, I want **subtle, non-blocking** sign-in nudges, so that I'm reminded without being interrupted mid-prediction.
40. As a learner who signs in mid-run, I want the progress I earned this run to **carry up** into my account, so that I don't lose it.
41. As a returning signed-in learner, I want to **resume where I left off** (current lesson and part), so that I don't redo work.
42. As a learner, I want sign-in framed as **"save progress + unlock more,"** so that I understand why it's worth doing.

### Motivation & completion (inherited mechanics)

43. As a learner on a roll, I want the subtle, numberless **"on fire"** effect that builds with consecutive correct answers, so that sustained accuracy feels rewarded.
44. As a learner who fumbles once but recovers, I want to **keep my fire** (it only breaks on a fully failed question), so that recovery is rewarded.
45. As a learner, I want a **completion screen** per lesson with a forward call-to-action, so that finishing feels like progress, and for Stacks & Queues that CTA now leads into the **real, unlocked Arrays lesson**.

### Developer / grader

46. As a developer, I want the lesson logic to remain **deterministic and AI-free**, so that the same state always yields the same feedback and the app stays gradeable and testable.
47. As a developer, I want the **two lessons to share the same engine seam**, so that Arrays reuses proto-1's reducer/feedback/flame rather than duplicating logic.
48. As a developer, I want the **first-run-vs-dashboard decision to be a pure, testable function**, so that the adaptive Home is verifiable without driving the whole UI.
49. As a developer, I want progress, unlock, streak, and account state to flow through the existing **`ProgressRepository`** boundary, so that persistence stays behind one interface and testable on the emulator.
50. As a developer/grader, I want a **single end-to-end tracer** that covers the new spine (vision hero → browse → enter course → play S&Q → unlock Arrays → play Arrays → sign-in carry-up → persist/resume), so that the whole experience is proven in one pass.

## Implementation Decisions

### Stance & scope

- **Platform-forward, honest.** Show the whole roadmap; never fake availability. Exactly **two lessons are playable** (Stacks & Queues, Arrays); everything else is a **locked preview**.
- **No new product mechanics.** The prediction model, the deterministic templated feedback machine (nudge → fail-at-2-wrong → Reattempt/Why?), the hard "until-correct" completion gate, and the numberless tiered flame are **unchanged from proto-1** and reused by Arrays.

### Architecture (reuse proto-1's seams)

- **Lesson engine (pure, framework-agnostic).** Stays the primary seam: a reducer `(lessonState, action) → lessonState` + selectors, no React/Firebase/animation deps. It now hosts **two lesson definitions**. Arrays adds its structure model (an indexed, contiguous array with insert/delete-shift and a dynamic-array resize), its prediction verdicts (predict-next-state + predict-the-cost/count), and its completion quota, but reuses the shared feedback machine, attempt counting, and combo logic.
- **Snapshot/step pattern: first reuse, still not generalized.** Arrays is the first *second* consumer of proto-1's per-operation snapshot list. Implement it the same way (snapshots produced in the engine, animated by the renderer). **Do not extract a generic cross-lesson step-engine yet**, Arrays is still close enough to proto-1 that the right abstraction won't be visible until a structurally different lesson (trees/graphs/heaps). Note where Arrays strains the contract; that's data for the eventual extraction.
- **Renderer (React + Framer Motion).** Dumb presentation. Arrays reuses the existing prediction/answer-card UI and the **cost readout** component (work-meter + house word + concrete count). The existing static Arrays preview is the visual starting point, upgraded to drive real engine snapshots.
- **`ProgressRepository` (persistence boundary).** All progress/unlock/streak/account reads/writes go through this interface (Firestore impl + in-memory fake). Schema grows (below) to support two lessons, real course progress, and a persisted streak.
- **Auth + app shell + client router.** Unchanged structure (Google + email/password + required display name; the `Screen`-union client router; the run provider that survives the sign-in detour). New screens/states slot into the existing router.
- **Catalog/registry.** The static catalog drives the platform surfaces. It must encode **honest states only** (`current` / `completed` / `available(unlocked)` / `locked`) and **must not mark a non-playable lesson as available**. Arrays is registered as a real lesson; the remaining five DS nodes and the two other courses are `locked`.

### Adaptive Home

- **Two modes from one tab**, chosen by a **pure selector** `homeMode(state) → "vision" | "dashboard"`:
  - **vision** when the learner has **not entered any course** (no current course set).
  - **dashboard** otherwise. The flip trigger is **"entered/selected a course,"** not "answered a question" and not "signed in."
- **Vision mode:** DS-led, platform-framed headline; the broader course roadmap visible beneath; a **playable Stack/Queue taste** (the interactive hero, scoped to this mode only); primary CTA → **Browse courses**.
- **Dashboard mode:** **Resume current lesson** (primary), **streak**, a **stats summary**, and a **roadmap peek**. **No** interactive demo here. The roadmap peek links into the current course's path (CourseDetail); a secondary link goes to the full catalog (Learn).
- For an anonymous learner, "entered a course" lives in the same **ephemeral in-run state** as the rest of anonymous progress (a refresh returns them to the vision hero, consistent with proto-1's no-anonymous-persistence rule). For a signed-in learner it follows their persisted state.

### Progress tab = deep drill-down

- Rebuilt from "a second copy of the lesson path" into a **performance view**: per-lesson history (attempted/completed, per-part correct counts), **accuracy**, and **mastery** per lesson/course. All values are **derived from real progress data**, never hardcoded.
- It is explicitly the **detail** to the dashboard's **summary**; the dashboard shows the headline numbers, Progress shows the breakdown.

### Arrays lesson (the new real lesson)

- **One idea:** indexed contiguous storage → instant access by index, but mid-insert/delete shifts everything after; dynamic arrays occasionally resize.
- **Misconception killed:** "adding/removing anywhere is free."
- **Mechanics (from the closed menu):** **Predict-next-state** (array after an insert/delete) + **Predict-the-cost/count** (how many elements shifted; does this insert trigger a resize / "big reshuffle?"). Tap-only (no drag. The gesture doesn't encode the concept here).
- **Cost framing:** uses the shared cost readout; **never names Big-O**. House words only: access is **"free,"** mid-shift **"scales,"** resize is **"usually free, with the occasional big reshuffle."**
- **Completion quota (proposed, tunable):**

```text
arraysComplete := shiftPredictCorrect >= 3   # predict-next-state after insert/delete
             AND  costCountCorrect   >= 3   # how many moved
             AND  resizePredictCorrect >= 2  # "does this trigger a big reshuffle?"
# failed/revealed answers never count (same rule as proto-1)
```

### Unlock / gating

```text
arraysUnlocked := lessonProgress["stacks-and-queues"].completed == true
# Arrays node renders `locked` until then, `available` after; completing S&Q flips it and
# the S&Q completion-screen CTA leads into the now-real Arrays lesson.
```

### Real progress, streak & account (the rework: target state)

- **Course progress %** is **derived**, not stored: `completedLessons / totalNodesInCourse` (e.g., Data Structures = `completed / 7`). No standalone percentage field to drift.
- **Streak is persisted** for signed-in learners so the "sign in to save your streak" promise is honest. It **carries up on sign-in** like other progress. The in-run "on fire" combo and its reset rule (breaks only on a fully failed question; survives a recovered fumble; numberless, maxes visually at tier 3) are unchanged from proto-1; persistence stores the streak record (e.g., current + longest) so it survives sessions. *(Exact cross-session reset semantics are a small open item. See Further Notes.)*
- **First-run vs returning** is driven by real state (has-entered-a-course / has-progress), removing the always-on "Welcome back."
- **Honest copy:** sign-in messaging promises **save progress + unlock lessons** (+ save streak, now that it's real); Progress/Home stop showing fabricated numbers.

### Schema (Firestore, signed-in only): grown from proto-1

```text
users/{uid}
  displayName: string
  createdAt: timestamp
  updatedAt: timestamp
  streak: { current: number, longest: number, updatedAt: timestamp }   # NEW (persisted streak)
  currentCourseId: string | null                                       # NEW (drives Home mode + resume)

users/{uid}/lessonProgress/{lessonId}        # lessonId ∈ {"stacks-and-queues","arrays"}
  # per-lesson counters are lesson-shaped (generalized from proto-1's fixed S&Q fields):
  counters: map<string, number>   # S&Q: pops/dequeues/scenarios · Arrays: shiftPredict/costCount/resizePredict
  currentPart: string
  completed: boolean
  completedAt: timestamp | null
  updatedAt: timestamp

# Course progress (%) is DERIVED from completed lessonProgress docs: not stored.
```

### Performance / bundle

- Arrays needs **no heavy library** (it's an indexed-array + cost-readout visualization), so it **stays in the proto bundle** and does not regress the load budget. `@xyflow/react`, `d3-*`, and `gsap` remain unused/lazy for the still-locked future lessons.

## Testing Decisions

- **What makes a good test:** assert *external behavior*. Verdicts, feedback stage, revealed flag, unlock transitions, completion, and derived progress. Not private fields or animation frames.
- **Reuse the existing three seams (no new test infrastructure):**
  - **Lesson engine (Vitest units): primary seam.** Existing Stacks & Queues coverage stays. **Add Arrays coverage:** shift predictions (predict-next-state), cost/count verdicts, the resize/"big reshuffle" prediction, the Arrays completion quota, failed/revealed excluded from completion, and the shared combo behavior carried across into Arrays. Plus the **unlock rule** (`arraysUnlocked` flips only when S&Q `completed`).
  - **`ProgressRepository` (emulator integration).** Extend proto-1's tests to the grown schema: two-lesson progress persists and reads back; **completing S&Q persists the Arrays unlock**; **derived course %** is correct from completed lessons; **streak persists and carries up** on sign-in; resume returns the right current lesson/part; cross-user denial still holds.
  - **One Playwright tracer (extended).** A single happy path through the real UI: **first-run vision hero → Browse courses → enter Data Structures (Home flips to dashboard) → play & complete Stacks & Queues → Arrays unlocks → play Arrays → sign in mid-run (carry-up) → completion → reload → resume**, asserting honest progress along the way.
- **One new pure seam to test directly:** `homeMode(state)`, unit-test that it returns `vision` before a course is entered and `dashboard` after, so the adaptive Home is verifiable without rendering.
- **Do not test:** Framer Motion frame-by-frame output; the exact copy of the marketing hero.
- **Prior art:** proto-1's engine units, emulator integration tests, and the single tracer. This PRD extends each in place rather than introducing new conventions.

## Out of Scope

- **All AI** (chatbot, generated hints, adaptive calls). Still none.
- **Lessons beyond Stacks & Queues and Arrays** (Linked Lists, Hash Tables, Trees, Heaps, Graphs). Visible as **locked previews** only.
- **Algorithms and Probability courses**: shown but **locked**; no content.
- **A relief valve for the hard "until-correct" wall** (escalating hints / "show me and move on"). Deliberately **kept out**; known retention risk against the beginner persona, accepted for the MVP.
- **A dedicated onboarding flow** beyond the first-run vision hero.
- **Logo/brand-mark finalization**: handled in a separate track (the v2/v3/v4 iteration); not part of this PRD.
- **XP, badges, leagues, and daily/calendar streaks**: the only motivation mechanic is the in-run "on fire" combo (now persisted as a streak record, but not a consecutive-days mechanic).
- **Drag/rewire interactions**: tap-only (Arrays included).
- **The generic, reusable cross-lesson step-engine**: still deferred; Arrays is its first stress test, not its extraction point.
- **The animated "growing willow" course-map, an unlock-rule *engine*, and mastery-based next-step recommendation**: the second unlock is a single explicit rule (S&Q → Arrays), not a general engine.
- **Real-time multi-device sync beyond per-user persistence, leaderboards, social, and in-app content authoring.**

## Further Notes

- **Biggest build delta:** Arrays as a second real lesson. It is the first reuse of the snapshot/step pattern and the cost readout in a real lesson. Treat it as a deliberate test of those contracts, but **resist extracting the generic step-engine** until a structurally different lesson forces its shape.
- **Open item: streak persistence semantics.** "Real streak" is settled in direction; the exact cross-session rule (does the in-run combo reset each session while only `longest` persists, or does `current` carry across sessions, and what counts as a "session") is a small decision to finalize in implementation. The honest sign-in copy works under either.
- **Open item: Arrays quota** (`3 / 3 / 2` above) is a proposal; tune against playtesting like proto-1's `3 / 3 / 4`.
- **Known risk retained:** the hard "until-correct" wall is most likely to frustrate the exact high-school beginner persona; accepted for the MVP, revisit with a relief valve afterward.
- **Convergence with the live rework.** The "make it real" pass (real progress, streak, unlock, first-run, account) is already in progress in a parallel stream; this PRD is the **target state** so that stream and the IA/Arrays work converge rather than diverge.
- **Seams unchanged.** No new test seam except the pure `homeMode` selector; everything else extends proto-1's engine units, emulator integration tests, and the single Playwright tracer. Keeping the seam count low by design.
- **Workflow / publishing.** Decision for now: **PRD only, do not publish.** When ready: run `setup-matt-pocock-skills` (or create the `ready-for-agent` label), publish this as the parent issue on `philote-dev/unbrilliant`, then `/to-issues` to split it into vertical tracer-bullet slices. A natural spine: (0) honest catalog + adaptive Home + real progress/account wiring; (1) Progress drill-down; (2) Arrays engine + UI + tests; (3) S&Q→Arrays unlock + extended tracer; (4) streak persistence + honest copy pass.
