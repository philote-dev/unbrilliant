# Mastery willow on the Progress page ("see your tree")

Status: in progress (subagent-driven). Date: 2026-06-26.

The mastery willow becomes the centerpiece of the Progress page: a single tree
that grows with app-wide lessons completed and shows retention decay (autumn
leaves) when memory fades. The visual is locked in the dev lab
(`src/dev/MasteryTreeLab.tsx`): seven painterly webp frames
(`public/willow-g1..g7.webp`) crossfaded by progress, a coded lilac glow overlay
(`CanopyGlow`), and a coded progressive autumn-decay overlay (`CanopyDecay`).

## Constraints / deviations from the skill

- No git commits (honoring the repo-wide "don't commit unless asked" rule).
  Implementers implement + test only; reviewers inspect the working-tree diff.
- Work happens in the current main worktree (the webp assets are untracked here;
  a fresh worktree would not have them). No worktree is created.
- `src/dev/**` is gitignored; the production component must live under `src/`.

## Data (from codebase exploration)

- `useProgressMetrics()` -> `metrics.lessonsMastered: { completed, total }`
  (currently Data Structures only: 8 lessons). This is "app-wide" for the MVP.
- Retention substrate is on main: `conceptReview.ts` `strength(review, now): 0..1`,
  `ConceptReviewProvider` `useConceptReviews(): { reviews }`, and
  `concepts.ts` `conceptsForLesson(lessonId): { id, retrievable }[]`.
  `retention.ts` / `useLessonRetention` are NOT on main (parallel branch).

## Tasks

### Task 1 - Extract a production `MasteryWillow` component

Create `src/components/willow/MasteryWillow.tsx`, extracting the willow visual
from `src/dev/MasteryTreeLab.tsx` (the `MasteryWillow`, `CanopyGlow`,
`CanopyDecay` components and their helpers: `FRAMES`, `framePair`, `frameFor`,
`rng`, decay/glow constants). Generalize:

- Props: `{ lessonsDone: number; totalLessons: number; retention?: number (default 1);
  width?: number (default 320); glow?: boolean (default true); className?: string }`.
- Replace the hardcoded `HORIZON = 90` with `totalLessons`: the seven frames map
  evenly across `[0, totalLessons]` (frame i at `i*totalLessons/6`), `lessonsDone`
  clamped to `[0, totalLessons]`. If `totalLessons <= 0`, render the sprout frame.
- Keep the coded glow + progressive autumn decay; keep lilac/`--lilac-strong`
  tokens so it themes. Assets: `/willow-g1.webp` ... `/willow-g7.webp`.
- Presentational only (no providers/hooks inside). Export `MasteryWillow`.
- Add `src/components/willow/MasteryWillow.test.tsx` (vitest + @testing-library/react,
  follow `src/components/willow/coursePath/coursePath.test.tsx` patterns): assert it
  renders with role="img" and a stage-appropriate aria-label; assert the autumn
  decay overlay leaves appear when `retention` is low (e.g. 0.2) and not when
  `retention=1`; assert `glow={false}` hides the glow.

Do NOT modify the dev lab in this task (avoid breaking `treelab.html`). Do NOT commit.

### Task 2 - App-wide `overallRetention` signal

Add a pure selector `src/features/progress/overallRetention.ts`:
`overallRetention(completedLessonIds: string[], reviews: ReadonlyMap<string, ConceptReview>, now: number): number`
returning the weakest-link min of `strength()` across the *retrievable* concepts of
the completed lessons (via `conceptsForLesson`); returns `1` when there are no
completed lessons or no retrievable concepts with reviews (treat unseen as fresh).
Add `src/features/progress/overallRetention.test.ts`.

Thread it into `useProgressMetrics()` (`src/features/progress/progressMetrics.ts`):
read `useConceptReviews()`, compute `overallRetention` over completed
`DATA_STRUCTURES_LESSONS`, and expose it on `ProgressMetrics` as
`overallRetention: number`. Keep `computeProgressMetrics` pure for the rest; the
retention is computed in the hook (or via the pure selector). Update the
`ProgressMetrics` type, fixtures, and `progressMetrics` tests as needed. Do NOT commit.

### Task 3 - Feature the willow on the Progress page

In `src/screens/ProgressDashboard.tsx`, feature `MasteryWillow` as a hero above
the tiles (after the header/subtitle, before the tabs/grid), centered and
responsive (e.g. `width={isDesktop ? 380 : 280}`), fed by
`metrics.lessonsMastered.completed`, `metrics.lessonsMastered.total`, and
`metrics.overallRetention`. Themed surface consistent with the page. Keep the
existing tiles. Do NOT commit.

### Task 4 - Preview parity (optional, local-only since src/dev is gitignored)

Update the gallery `ProgressPageLab` fixtures to include `overallRetention` so the
assembled Progress preview shows the willow; verify `treelab.html` still works.

## Done when

Progress page shows the growing willow driven by real lessons-completed and an
interim overall-retention signal, with decay visible as retention drops; new
unit/render tests pass; no regressions in `npm test`.
