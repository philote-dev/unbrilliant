# Lesson Revamp Baseline

> **For agentic workers:** This is the mandatory baseline applied to EVERY newer lesson (Linked Lists, Hash Tables, Trees, Heaps, Graphs) on top of that lesson's specific work. Every per-lesson plan references this doc. A lesson is not "done" until it meets this baseline AND its lesson-specific buckets, validated by phone-viewport gallery screenshots.

**Goal:** Bring the five newer lessons up to the reference lessons' house feel (Intro, Stacks & Queues, Arrays), so polish is guaranteed everywhere, not only where a feature bucket happens to touch. This is the "general revamp" that runs alongside each lesson's "content polish."

## Scope

Applies to: **Linked Lists, Hash Tables, Trees, Heaps, Graphs.** The three reference lessons already meet this baseline and are not re-audited here.

## The baseline checklist (every newer lesson)

1. **Clean animations, everywhere.** Revamp ALL motion in the lesson (not just one signature moment): intentional, smooth, no janky or instant-snap transitions where motion is expected. **Reduced-motion parity on every animated path** (snap-to-final, no stranded timers).
2. **Animation-driven teaching.** Teach by showing, not just telling: the teaching segments play the concept (a real replay), rather than a static figure plus prose.
3. **Sequential concept glow (highlight text).** Key teaching terms glow in reading order and settle in lilac (the `.concept` class in `src/index.css`), as a reading guide.
4. **Large centered reading + the eyebrow thread.** Teach/intro segments use the house reading style: large centered type, the purple `SECTION - X OF N` eyebrow accent, primary button pinned to the bottom.
5. **Tap-to-reveal where it genuinely fits.** Prefer active reveal over walls of text where it suits the content (revealed text comes in bigger / higher-contrast). Not forced onto every segment; use judgment.
6. **Willow-styled demos.** Demos are in Willow styling. Do NOT use a literal real-world scene as a demo when that same scene is the graded real-world payoff (no opening and closing on the same skin); keep the showpiece for its graded segment.
7. **No give-aways (reiterated).** Never reveal the answer on the question screen; teach earlier, explain in feedback. (Owned by the de-cuing sweep, restated here as an acceptance criterion.)

## How it is applied

- Each lesson's plan (e.g. `2026-06-27-linked-lists-redesign.md`, `2026-06-27-hash-tables-redesign.md`, and the bucket plans) executes its specific work; this baseline is the additional acceptance bar layered on top.
- Animation specifics (the shared `FrameSequence` primitive, the engine frame-selector pattern, the Heaps pilot) live in `2026-06-27-lesson-animation-depth.md`. This baseline says "apply it to all motion in the lesson," not just the signature moment.
- Validation: the existing gallery review gate (constraint D). A lesson passes only when its teach segments glow + animate, its motion is clean and reduced-motion-safe, and its demos are Willow-styled.

## Constraints (baked in)

- **A. No seam / persistence change.** Baseline work is presentational (animation, copy, reveal); the `LessonModule` interface and `LessonProgress` shape are untouched.
- **D. Gallery + screenshots.** Each lesson's baseline pass is screenshot-reviewed before promote.
- House rules: no em dashes; no Big-O; house cost words only.

## Per-lesson note

When picking up Trees, Heaps, or Graphs (which do not yet have a consolidated redesign doc), apply this baseline as part of their work and capture any lesson-specific content changes from the lesson review in their own doc, mirroring the Linked Lists and Hash Tables redesign docs.
