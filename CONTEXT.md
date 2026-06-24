# Willow — Domain Context

Names for the concepts and seams in the codebase. Use this vocabulary in code,
test names, and reviews so the language stays shared. Product scope lives in
`docs/prd/mvp-final.md`; visual/UX in `docs/design/design-brief.md`.

## Core modules & seams

- **Lesson engine** (`src/features/lesson/engine.ts`) — the deep, pure module: a
  reducer `(LessonState, LessonAction) → LessonState` plus selectors. No React,
  Firebase, or animation deps, so the same state always yields the same feedback
  (the deterministic, no-AI guarantee). It is the project's primary **test
  surface** — the interface you assert behavior through.
- **Renderer** (`src/screens/LessonPlayer.tsx`, `src/features/hero/*`) — shallow
  presentation over the engine state; animates snapshots, holds no rule logic.
- **Persistence boundary** (`ProgressRepository`) — the seam the app reads/writes
  progress through, never Firestore directly. Adapters: a Firestore one for the
  app, an in-memory one for tests.

## Run vs. progress

- **Run** (`LessonState`) — the full **transient** in-memory lesson: seed, part,
  counts, current question, selection, feedback, the on-fire **combo**. Lives
  while you play (signed in or not); a refresh wipes an anonymous run.
- **Progress** (`LessonProgress`) — the thin **durable** slice saved per signed-in
  user: the three correct-counts, `currentPart`, and `completed`. `null` means an
  account has never saved this lesson.
- **`toProgress(run)`** — squash a run down to its durable progress slice.
- **`resumeLesson(progress)`** — reinflate a run at the saved part and counts,
  with a fresh question draw and a **cold combo** (the fire is transient).
- **`hasProgress(run)`** — has this run earned anything worth carrying up?

## Reconcile (sign-in moment)

When a learner becomes signed-in, **reconcile** compares the local run against the
server's saved progress and produces a plan (`reconcile(local, server)`):

- **resume** — server has progress: it **wins**, the run is rebuilt from it
  (marked complete if it was). Deliberately **no merge** of two histories.
- **carry-up** — brand-new account with an in-flight run: push the local run up in
  a one-time write (safe precisely because there's nothing on the server yet).
- **noop** — brand-new account, nothing earned yet: do nothing; ordinary saves
  take over once the first answer is correct.

The decision is pure and lives in the engine; the React effect only performs the
I/O (`ensureUser`, read, then `dispatch`/`saveProgress`) and reconciles once per
signed-in user.

## Mastery & motivation

- **Mastery gate** — completion requires 3 correct pops + 3 correct dequeues + 4
  correct scenarios; failed/revealed answers never count.
- **On-fire combo** — a numberless, tiered streak of consecutive correct answers,
  lesson-wide; breaks only on a full fail, transient (never persisted).
