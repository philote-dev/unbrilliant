# Hash Tables Redesign Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Single source of truth for the updated Hash Tables lesson, consolidating the lesson review (Jun 28) with the cross-cutting buckets and the shared baseline. New segments are welcome; saved-progress migration is not a concern (owner direction). Poly is deferred (no Poly hints).

**Goal:** Bring Hash Tables to reference tier: fix the duplicate-warehouse framing, make the teach segment interactive, remove the determinism give-away, add a "build your own hash" arc (sandbox + graded design challenge) that teaches what makes a hash good, add replay variety, and apply the shared revamp baseline.

**Architecture:** Pure-engine-first. The hash rule, collision/chaining, lookup verdicts, and the new design challenge all grade in `hashTablesEngine.ts` with tests. The hash-builder is a pure model (a chosen combine rule + bucket count over a key set yields a deterministic distribution). Animation is view-only and reuses the shared `FrameSequence` primitive. Must meet `2026-06-27-lesson-revamp-baseline.md`.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Concepts taught (after redesign): 9

1. A hash turns a key into its location (jump, not search).
2. The rule is computable: sum letter values, then mod the bucket count.
3. Determinism: the same key always lands in the same bucket.
4. Collisions: different keys can hash to the same bucket.
5. Chaining: a colliding key appends to the bucket's mini linked list (not overwrite/reject/probe).
6. Lookup cost: a hashed find is free (one jump) vs scanning everything (scales).
7. Absence is also one jump.
8. Real-world: chaotic storage (warehouse) hashes a code to a bin.
9. **NEW: the hash function is a choice, and a good one spreads keys evenly to avoid collisions.**

## Updated segment map (single source of truth)

Current: 12 segments, 9 graded (3/3/3). Updated: **14 segments, 10 graded** (recommended gate = 10; see open item on slotting the design segment).

1. `demo` (free play) - **CHANGED:** an abstract, Willow-styled "mess around with two scenarios" sandbox (sorted-scan vs hashed-jump). No longer a warehouse (the warehouse is the graded payoff at segment 14). [Baseline: Willow-styled demo.]
2. `teach-hash` - **CHANGED:** interactive `HashBox` (step the letters -> `sum mod B` -> fly to the bin). Wires the built-but-dark `HashBox` reveal. [Bucket 3 wire-dark; baseline: animation-driven teaching + concept glow.]
3. `hash-cat` (graded, hash 1/3) - drag; animated fly-to-bin.
4. `hash-cat-again` (graded, hash 2/3) - **CHANGED:** ask a fresh, not-yet-placed key so the bin is computed, not read off. [Bucket 2 de-cuing.]
5. `hash-dog` (graded, hash 3/3) - drag.
6. `teach-collision` - chaining = a mini linked list. [Baseline: animate the append + glow.]
7. `collide-sun` (graded, collision 1/3) - MCQ.
8. `collide-ant` (graded, collision 2/3) - MCQ.
9. `collide-pig` (graded, collision 3/3) - MCQ.
10. `hash-build-demo` (free play) - **NEW:** the hash-builder sandbox. Pick a combine rule (sum letters / first letter / length) and the bucket count; drop keys; watch them land and collide. Teaches concept 9 by exploration.
11. `hash-design` (graded) - **NEW:** a design challenge: choose a rule + bucket count that spreads the given keys (avoids the collision). Graded on the resulting distribution (fewer/no collisions for the target set).
12. `lookup-found` (graded, lookup 1/3) - tap; free vs scales cost.
13. `lookup-absent` (graded, lookup 2/3) - tap.
14. `realworld` (graded, lookup 3/3) - the warehouse payoff (drag, physics). Completes the lesson.

The 10 graded skills: 3 hash, 3 collision, 1 design, 3 lookup.

## Decisions locked (lesson review, Jun 28)

- Demo becomes an abstract Willow two-scenario sandbox; warehouse is reserved for the graded realworld payoff.
- teach-hash becomes interactive (HashBox reveal) with glow + animation teaching.
- hash-cat-again uses a fresh key (de-cue).
- Make-a-hash arc: a free-play hash-builder sandbox + a graded design challenge, learner controls the combine rule AND the bucket count, placed after the collision section, teaching "a good hash spreads keys."
- Replay variety (Bucket 5): generate keys/collisions within tuned constraints; Hash is a strong rollout candidate after the Heaps pilot.
- Shared revamp baseline applies.

## Constraints (baked in)

- **A. No seam / persistence change.** New segments/skills grade through the existing engine; `LessonProgress` shape untouched. Adding segments + a design bin is fine (migration not a concern).
- **D. Gallery + screenshots.** Prototype the abstract demo, the interactive teach, the hash-builder, and the design challenge; screenshot review before promote.
- Baseline + house rules: see `2026-06-27-lesson-revamp-baseline.md`; no em dashes; no Big-O; house cost words.

---

## File structure

- Modify `src/features/lesson/hashTablesEngine.ts` (+ `hashTablesEngine.test.ts`): abstract demo data; fresh-key `hash-cat-again`; the pure hash-builder model (combine rule + bucket count -> distribution; collision count); the `hash-design` verdict (spreads the target keys); seeded generation for replay variety; update `HASH_PARTS`, bins/quotas, `isCompleteHash`.
- Modify `src/lessons/hashTables/Stage.tsx`: abstract two-scenario demo; interactive `HashBox` teach; the hash-builder sandbox UI (rule + bucket pickers, key drop, live distribution); the design challenge; reuse `FrameSequence`; apply glow + reading baseline.
- Modify `src/lessons/hashTables/HashBox.tsx`: ensure `reveal` mode is wired and reduced-motion-safe.
- Modify `src/lessons/hashTables/HashTable.tsx` / `BucketChain.tsx`: animate the append; clean motion; reduced-motion parity.
- Modify `src/lessons/hashTables/warehouseChrome.tsx` etc.: keep the warehouse for segment 14 only.
- Modify `src/dev/GalleryApp.tsx`: presets for the abstract demo, interactive teach, hash-builder (a few rule/bucket combos), design challenge, plus a seed-sample view for the generated segments.

---

## Phases

- [ ] **Phase 1 (baseline + buckets for Hash):** apply the shared revamp baseline (clean all animations, glow, animation teaching, reading); execute the Hash items from de-cuing (Bucket 2), wire-dark (Bucket 3, HashBox), and animation (Bucket 1) plans.
- [ ] **Phase 2 (abstract demo):** replace the warehouse demo with an abstract Willow two-scenario sandbox (sorted-scan vs hashed-jump). Gallery preset + screenshot.
- [ ] **Phase 3 (make-a-hash arc, engine-first):**
  - [ ] Test-first: the pure hash-builder model (rule + bucket count -> deterministic distribution + collision count) and the `hash-design` verdict (the chosen hash spreads the target key set / avoids the seeded collision).
  - [ ] Implement the model + the sandbox state + the graded design segment; slot the design skill into the gate.
  - [ ] UI: rule + bucket pickers, key drop, live distribution that shows collisions; the design challenge; concept-9 teaching copy with glow.
  - [ ] DOM tests; gallery presets; screenshots.
- [ ] **Phase 4 (replay variety):** generate keys/collisions within tuned constraints (after the Heaps pilot in `2026-06-27-replay-variety.md`); seed-sample gallery review.
- [ ] **Phase 5 (verify + gate):** `tsc -b` + tests + lint clean; full phone-viewport playthrough screenshots; owner sign-off on the 14-segment flow and the open items.

---

## Open items for the gate

- Design segment slotting: its own "design" bin (gate = 10) vs folding into the collision bin (collision becomes 4). Recommend its own bin for clarity.
- Hash-builder controls: confirm the rule set (sum / first-letter / length) reads well on a phone, or trim.
- Collision bin is MCQ-only today (reasoned, not performed). Not in scope here; note as a possible future "drop the colliding key onto the chain tail" active mechanic.

## Self-review

- 9 concepts incl. the new "hash is a choice / good hash spreads" : Concepts + segments 10-11. Covered.
- Abstract demo (no duplicate warehouse), interactive teach, fresh-key determinism: segments 1, 2, 4. Covered.
- Make-a-hash sandbox + graded design after collisions, controls rule + buckets: Phase 3. Covered.
- Replay variety, shared baseline, cross-bucket references, Poly deferred, constraints A + D: stated. Covered.
