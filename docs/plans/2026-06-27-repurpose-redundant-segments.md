# Repurpose Redundant Segments Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. The two target segments are nice real-world showpieces, so repurpose them to test a new skill rather than delete them. New segments are welcome; saved-progress migration is not a concern (owner direction).

**Goal:** Remove redundancy without losing the showpieces. The Linked Lists `playlist` segment currently repeats the insert skill; the Heaps `siftup-skin` segment repeats sift-up. Repurpose each to test a new skill, keeping (and for Heaps, revamping) the real-world skin.

**Architecture:** Pure-engine-first. Each repurposed segment tests a different skill, graded in the engine with tests; the skin is view-only. The Heaps skin gets a visual revamp (frontend-design pass) as part of this work.

**Tech stack:** TypeScript, React 19, Motion (`motion/react`), Vitest + Testing Library, Playwright (gallery), oxlint.

---

## Decisions locked (from planning Q&A)

- **Principle:** repurpose, do not delete. Keep the real-world skin; change the skill tested.
- **Linked Lists `playlist`:** repurpose into the lesson's **multi-operation synthesis segment** on the existing Spotify skin (supersedes the earlier "delete-from-playlist" idea, per the lesson review). It is a multi-step task with graded sub-steps: **insert a track -> delete a track -> reorder a track**, where **reorder = unlink (bypass delete) + relink (save-first insert)**, so it ties both core pointer skills together. It no longer repeats the plain insert. Open decision for the gate: whether the synthesis segment counts as ONE gate slot (all sub-steps correct) or THREE; recommendation is one slot to keep the gate tight.
- **Heaps `siftup-skin`:** repurpose to **extract / sift-down in the ER context** (the most urgent patient leaves, then re-heapify). **Also revamp the ER skin** (a visual refresh), per the owner.
- New segments allowed; migration not a concern.

## Constraints (baked in)

- **A. No seam / persistence change.** The repurposed segments grade through the existing engine/actions; the `LessonProgress` shape is untouched. (Migration is not a concern per the owner.)
- **D. Gallery + screenshots.** Prototype the repurposed segments (and the revamped ER skin) in the gallery; screenshot review before promote.
- House rules: no em dashes; no Big-O; house cost words only.
- Pairing: the Heaps extract/sift-down mechanic should reuse the do-the-sift work and the traveling-node animation (`2026-06-27-trees-heaps-interaction.md`, `2026-06-27-lesson-animation-depth.md`); do not reinvent them.

---

## File structure

**Linked Lists playlist -> delete**
- Modify `src/features/lesson/linkedListsEngine.ts` (+ `linkedListsEngine.test.ts`): the `playlist` segment now tests delete (bypass/repoint), not insert. Reuse the existing delete mechanic/verdict; the segment is the Spotify skin over it. Avoid duplicating the `rewire-delete` instance (use a distinct, playlist-flavored case).
- Modify `src/lessons/linkedLists/Stage.tsx` (`PlaylistPart`) + `PlaylistQueue.tsx`: render the delete interaction (remove a song; the list repoints around it) on the Spotify skin.
- Modify `src/lessons/linkedLists/Stage.test.tsx`: assert the playlist segment grades delete, not insert.

**Heaps siftup-skin -> extract/sift-down + ER skin revamp**
- Modify `src/features/lesson/heapsEngine.ts` (+ `heapsEngine.test.ts`): the `siftup-skin` segment (rename its intent, keep its bin/gate slot) now tests extract + sift-down in the ER context. Reuse the do-the-sift validator.
- Modify `src/lessons/heaps/ERTriageBoard.tsx` + `MonitorChrome.tsx`: revamp the ER skin (frontend-design pass: spend boldness on the one signature, keep the rest quiet; stay in Willow identity). Render the extract/sift-down flow with the traveling-node animation.
- Modify `src/lessons/heaps/Stage.tsx` + `Stage.test.tsx`: wire and assert the new skill.

**Gallery**
- Modify `src/dev/GalleryApp.tsx`: presets for the repurposed LL delete segment and the revamped ER extract segment.

---

## Phase 1: Linked Lists playlist -> delete

- [ ] **Step 1 (test-first):** In `linkedListsEngine.test.ts`, assert the `playlist` segment now grades a delete (bypass/repoint), distinct from `rewire-insert`, and is not a duplicate of `rewire-delete`'s instance.
- [ ] **Step 2:** Repoint the engine segment to the delete mechanic with a playlist-flavored instance.
- [ ] **Step 3 (UI):** `PlaylistPart` renders the delete-a-song interaction (the queue repoints around the removed track) on the Spotify skin.
- [ ] **Step 4:** DOM tests; `tsc -b` + lint clean.
- [ ] **Step 5:** Gallery preset `linkedlists-playlist-delete`; screenshot.

## Phase 2: Heaps siftup-skin -> extract/sift-down + ER revamp

- [ ] **Step 1 (test-first):** In `heapsEngine.test.ts`, assert the repurposed segment grades extract + sift-down (reusing the do-the-sift validator), keeping the bin/gate counts constant.
- [ ] **Step 2:** Repoint the engine segment; reuse the do-the-sift line for extract.
- [ ] **Step 3 (skin revamp, frontend-design):** Refresh `ERTriageBoard` + `MonitorChrome` (one bold signature, quiet elsewhere, Willow identity, no token-system swap). Render the extract/sift-down with the traveling-node animation.
- [ ] **Step 4:** DOM tests; `tsc -b` + lint clean.
- [ ] **Step 5:** Gallery presets `heaps-er-extract` (+ reduced); screenshots.

## Phase 3: Review gate (D) + verify

- [ ] **Step 1:** Owner reviews the repurposed segments and the revamped ER skin from phone screenshots; adjust.
- [ ] **Step 2:** Confirm neither lesson now has two segments testing the same skill (grep the engine skill mapping).
- [ ] **Step 3:** `npx tsc -b` + `npm run test` + lint clean; commit per lesson.

---

## Risks / open items

- The ER skin revamp is a visual judgment call; keep it within Willow identity and gate it on the owner's screenshot review (use frontend-design).
- Reuse the do-the-sift mechanic and traveling-node animation rather than building extract anew; sequence this after Buckets 1 and 4 land for Heaps.
- The LL delete segment must not duplicate `rewire-delete`; use a clearly different, playlist-flavored instance.

## Self-review

- LL playlist -> delete on the Spotify skin (no longer repeats insert): Phase 1. Covered.
- Heaps siftup-skin -> extract/sift-down + ER skin revamp: Phase 2. Covered.
- Repurpose (keep skins), new segments allowed, no migration effort: stated. Covered.
- Constraints A + D, house rules, reuse sibling-bucket work: stated. Covered.
