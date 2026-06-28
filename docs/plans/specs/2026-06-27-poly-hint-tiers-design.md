# Poly Hint Tiers (Deferred) Design Notes

**Status: DEFERRED.** The owner chose to defer the Poly / hint-engine work and limit current scope to the other buckets (animation, de-cuing, wiring dark features, interaction variety, replay variety, repurposing segments). These notes capture the design decisions already reached so the work is not lost when it resumes. This is a design spec, not an implementation plan; do not implement from it without re-confirming the open question below.

## One job

Extend Poly's contextual help across the five newer lessons (pilot: Linked Lists), tiered by problem difficulty so cost stays controlled, while keeping the no-AI deterministic grading gate intact (Poly only phrases help; it never grades).

## Current architecture (what already exists)

- **Client:** `usePolyHint` (`src/lib/ai/usePolyHint.ts`) fires on a wrong attempt and calls `requestHint` (`src/lib/ai/polyClient.ts`), capped per problem, tracking a prior hint for a second angle. Used today in Arrays (grow) and Stacks & Queues (construct).
- **Deterministic diagnosis:** `src/features/poly/diagnose.ts` replays a multi-step attempt against the unique correct line and returns a giveaway-free structural `ErrorShape` (`kind` + `stepNumber`), never naming answer items. This is the pure base an AI hint sits on.
- **Backend:** Firebase Cloud Functions calling OpenAI: `polyHint` with a server-side giveaway `verifier`, `polyScore` / `polyProbe` with `rubrics` + `skillMap` for self-explanation checkpoints, and `polySpeak` / `polyTranscribe` / `polyRealtimeToken` for voice. All built and tested (`functions/src/poly/*`).
- **Dev surface:** `PolyLab` (`src/screens/PolyLab.tsx`) demos health check, action-grounded hints, the self-explanation checkpoint, and the "stuck system" (basic idle-nudge vs complex diagnose-then-question) in mock and live modes.

## Decisions reached (locked unless noted)

- **Backend:** keep the existing OpenAI Cloud Functions backend; extend coverage (skill map, rubrics, verifier, prompt context) to the new disciplines/concepts. Do not migrate to Firebase AI Logic for this work.
- **Pilot lesson:** Linked Lists (the rewire construct and the orphan-the-tail failure are rich, testable diagnosis targets).
- **Tier model:**
  - **Basic / remember-tier segments** (single MCQ / tap / predict): deterministic **authored hints**, written into each segment's engine `hint` copy, served with **no API call**. Basic segments do **not** get the stuck system. ("Hint lookup for now"; AI-upgradeable later if wanted.)
  - **Complex-tier segments** (construct, do-the-sift, rewire, draw, multi-step): get the AI help.
- **Complex-tier triggers:**
  - **On a wrong answer (the "yellow" / nudge state):** a personalized AI hint conditioned on the learner's state with scaffolding, served from the AI-enhanced lookup table. Straight to AI (no authored-first escalation step). Always giveaway-verified.
  - **On a stall (>= ~20s of no action):** a **thinking nudge**, metacognitive ("where to think"), not a direct hint. Sourced as AI but from the same cached lookup table (so it is still mostly lookups, not a call per stall).
- **Deterministic diagnosis layer:** each lesson's complex mechanic gets a pure, giveaway-free diagnose function (like `diagnose.ts`). It is both the scaffolding context the model conditions on and the cache key. Grading stays pure; only phrasing is AI.
- **Scalability:** an **AI-enhanced lookup table** (cache) so repeats are lookups, not fresh model calls. Because the diagnosis is a finite set of structural shapes per skill, the distinct hints are few and cacheable.
- **Out of scope for this bucket:** self-explanation checkpoints and voice (the backend exists, but the owner scoped this effort to tiered hints + the stall nudge only).

## Open question (must resolve before implementing)

Personalization vs scalability was not settled. The recommendation on the table (not yet approved):
- Condition the hint on the **structural diagnosis** (error-kind + step + the specific wrong configuration, never answer items): "personalized to the mistake" AND fully cacheable.
- Populate the table **hybrid**: AI-author + verify the common mistake shapes offline (instant for most learners), lazy-generate the long tail once then cache.
- Add a cheap phrasing/tone layer on top later (vary wording by streak/attempt) with no extra model call, if richer personalization is wanted.

The owner said "it should be more personalized" but was unsure how to weigh this against cost, then deferred. Resume here: decide how rich the conditioning state is, which sets cacheability.

## Rough shape when resumed (not a commitment)

- Extend the client `discipline` union and add per-lesson diagnose functions (pilot: Linked Lists).
- Extend the server `skillMap` / `rubrics` / `verifier` and the hint prompt context for the new concepts.
- Add the lookup-table cache keyed by the deterministic diagnosis; choose offline-precompute vs lazy-fill per the open question.
- Wire the trigger model into each complex segment's Stage (wrong -> AI hint; >=20s stall -> cached thinking nudge); basic segments just show their authored hint.

## House constraints to honor when resumed

- No-AI deterministic grading gate stays intact (Poly is help-only, always giveaway-verified).
- No Big-O; no em dashes; house cost words only.
- The diagnosis-keyed cache keys on error-kind, not instance, so it composes with the procedural Replay Variety work.
