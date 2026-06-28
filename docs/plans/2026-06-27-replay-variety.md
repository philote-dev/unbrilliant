# Replay Variety Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Several choices here were deferred to the gallery review gate (the owner skipped the abstract questions, preferring to judge variety on screen). Treat the marked defaults as proposals to confirm at the gate, not settled.

**Goal:** Give the curated lessons (Trees, Heaps, Hash Tables, Graphs) replay variety so a second run is not identical. Today they use one curated instance per segment plus option shuffle; Arrays and Linked Lists already generate fresh instances per seed and are the reference patterns.

**Architecture:** Keep the gallery-tuned quality the owner values. Prefer expanded curated pools (rotate among several hand-tuned instances, like S&Q's bank) where instance tuning matters, and a seeded generator (like Arrays/Linked Lists) only where instances are safe to auto-make. Everything stays deterministic and seedable in the pure engine. A new gallery "seed-sample" view renders many seeds at once so awkward instances are caught before promote.

**Tech stack:** TypeScript, React 19, Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Decisions locked / defaulted (from planning Q&A)

- **Approach (default, confirm at gate):** expanded curated pools, leaning hybrid. Pools where tuning matters (e.g. the gallery-tuned transit maps), seeded generator where instances are clearly safe to auto-make.
- **Pilot (default):** Heaps (random valid heaps are clean to make and consolidate with the Heaps animation/interaction pilots).
- **Rollout (default):** pilot first, then decide rollout from the gallery results.
- **Validation (default):** add a "seed-sample" gallery preset that renders N seeds of a generated/pooled segment at once, to eyeball variety and catch awkward instances.

These four were skipped in questioning, so they are defaults. Confirm or adjust at the Phase 1 review gate before rolling out.

## Constraints (baked in)

- **A. No seam / persistence change.** Variety stays inside each engine's question construction; the `LessonProgress` shape is untouched. (Migration is not a concern per the owner, but the shape does not change anyway. The diagnosis-keyed cache idea from the deferred Poly work keys on error-kind, not instance, so procedural variety stays compatible with it later.)
- **D. Gallery + screenshots.** The seed-sample view is the validation mechanism; review before promote.
- House rules: no em dashes; no Big-O; house cost words only.

---

## File structure

**Seed-sample gallery view (build first)**
- Modify `src/dev/GalleryApp.tsx`: a preset mode that renders N seeds (e.g. 8) of a chosen segment side by side, using the module's `create`/`resume` + seeds, so variety and quality are visible at a glance.

**Heaps pilot**
- Modify `src/features/lesson/heapsEngine.ts` (+ `heapsEngine.test.ts`): generate valid heaps per seed for the sift/mapping segments within tuned constraints (size range, value range, guaranteed a real swap), instead of the fixed `CURATED` fixtures. Keep curated where a specific shape is pedagogically required.
- Tests assert: determinism (same seed -> same instance), and invariants (every generated instance is a valid heap that forces the intended operation).

**Rollout (after the gate), per lesson**
- Trees `treesEngine.ts`: pool of tuned BST shapes/targets, or a generator that guarantees the needed shape contrast.
- Hash Tables `hashTablesEngine.ts`: generate keys -> buckets -> collisions within constraints (guaranteed collision depth where required).
- Graphs `graphsEngine.ts`: likely keep the gallery-tuned maps curated (hardest to auto-generate cleanly); a pool of tuned variants if any.

---

## Phase 1: Seed-sample gallery view + Heaps pilot, then gate

- [ ] **Step 1:** Build the seed-sample gallery view (renders N seeds of a segment at once). No lesson change yet.
- [ ] **Step 2 (test-first):** In `heapsEngine.test.ts`, assert the generated sift/mapping instances are deterministic per seed and always satisfy their invariants (valid heap; the intended swap/mapping is non-trivial).
- [ ] **Step 3:** Implement the Heaps generator within tuned constraints; keep curated where a fixed shape is needed.
- [ ] **Step 4:** Engine tests green; `tsc -b` + lint clean.
- [ ] **Step 5 (review gate):** In the seed-sample view, render ~8 seeds of each varied Heaps segment; screenshot to `docs/reference/` (`heaps-seed-sample.png`); review with the owner. Confirm the approach (pools vs generator vs hybrid) and whether to roll out, and to which lessons. Adjust constraints to kill any awkward instances.

## Phase 2: Rollout (only the lessons confirmed at the gate)

Note: Trees variety is now REQUIRED, not optional. The Trees redesign (`2026-06-27-trees-redesign.md`) depends on bigger/varied generated (or pooled) trees for its new `find-big` challenge rep and added practice, so Trees generation is in scope regardless of the pilot outcome.

For each confirmed lesson (proposed: Trees, Hash Tables; Graphs likely stays curated):
- [ ] Decide pool vs generator for each segment (from the gate).
- [ ] Implement with determinism + invariant tests (test-first).
- [ ] Seed-sample review per lesson; screenshot; owner sign-off.
- [ ] `tsc -b` + tests + lint clean; commit per lesson.

---

## Risks / open items

- Generated instances can be awkward (a "valid" but confusing heap/tree/graph). The seed-sample view + invariant tests are the guardrails; when in doubt, prefer a curated pool over a generator.
- Graphs maps are hand-tuned for octolinear legibility; auto-generation likely is not worth it. Default to keeping Graphs curated unless the gate says otherwise.
- Keep instance generation independent of any future Poly diagnosis cache (which keys on error-kind, not instance), so the two features compose.

## Self-review

- Approach/pilot/rollout/validation captured as defaults to confirm at the gate (owner skipped these): Decisions section + Phase 1 gate. Covered.
- Seed-sample gallery view as the validation mechanism: Phase 1. Covered.
- Heaps pilot with determinism + invariant tests: Phase 1. Covered.
- Rollout gated on owner sign-off; Graphs likely stays curated: Phase 2. Covered.
- Constraints A + D, house rules: stated. Covered.
