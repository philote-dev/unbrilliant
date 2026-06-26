# Progress page (Stage 2) design

- Date: 2026-06-24
- Branch: `feat/progress-metrics-gallery`
- Status: proposed (decisions locked from recommended defaults after user said "continue")

## Goal

Replace the per-lesson drill-down currently on the Progress tab with a
personal-progression dashboard built from six curated tiles, split across two
tabs for navigation. Wire real data, and add the one persistence primitive the
time-series tiles need so the numbers are honest (never faked).

## Curated tiles and data cost

| Tile | Component | VM | Cost today |
| --- | --- | --- | --- |
| Lessons mastered | `LessonsMasteredTile` | `LessonsMasteredVM { completed, total }` | FREE |
| Streak | `StreakTile` | `StreakVM { current, longest }` | FREE |
| This week | `WeeklyConsistencyTile` | `WeeklyConsistencyVM { daysActive }` | needs per-day history |
| Contribution calendar | `ContributionCalendarTile` | `ContributionsVM { days: {date,count}[] }` | needs per-day history |
| Accuracy growth | `AccuracyTrendTile` | `SeriesVM { points }` | needs per-day history |
| Answers per day | `AnswersPerDayTile` | `VolumeVM { values }` | needs per-day history |

All six tiles already exist as prop-driven presentational components under
`src/components/willow/progress/` and already render empty/new-user states.

## Decisions (locked)

1. **Scope:** build the real Progress page now AND add a single daily-activity
   log primitive that powers all four time-series tiles. Real data; history
   accrues going forward.
2. **Growth graph:** accuracy growth (cleanly derivable from the daily log).
   Mastery growth is dropped (it needs per-lesson mastery targets that only
   exist for two lessons today).
3. **Tabs:** two, as a local segmented control inside the Progress screen (no
   router change).
4. **Replaces** the existing per-lesson drill-down on the `progress` screen. The
   old `LessonStatCard` list is retired from this tab.

## Page structure

```
Progress screen (name: "progress")
  Header:  "Your progress" + subtitle
  Tabs:    [ Overview ] [ Activity ]   (segmented pill control, local state)
  Body:    single mobile-first column of MetricCard tiles for the active tab
```

- **Overview** (where you stand right now / momentum):
  1. Streak
  2. This week
  3. Lessons mastered
- **Activity** (what you have been doing over time):
  1. Contribution calendar
  2. Accuracy growth
  3. Answers per day

Default tab: Overview. Tab choice is session-local component state (no
persistence, no URL).

## Data flow

A new selector hook `useProgressMetrics()` is the single seam between data and
the presentational tiles:

```
useCourseProgress()  -> progressByLesson, streak
catalog              -> lesson count
daily activity log   -> per-day { attempted, correct }
        |
        v
  useProgressMetrics(): {
    lessonsMastered: LessonsMasteredVM,
    streak: StreakVM,
    weeklyConsistency: WeeklyConsistencyVM,
    contributions: ContributionsVM,
    accuracyTrend: SeriesVM,
    answersPerDay: VolumeVM,
  }
        |
        v
  Progress screen passes each VM to its tile
```

Derivations:

- **lessonsMastered:** `completed` = count of `DATA_STRUCTURES_LESSONS` with
  `progressByLesson[id].completed`; `total` = lesson count.
- **streak:** straight from `useCourseProgress().streak`.
- **weeklyConsistency.daysActive:** distinct days in the current local week
  (Mon-Sun) with `attempted > 0`, 0..7.
- **contributions.days:** last ~365 local days from the log as `{ date:
  local-midnight epoch ms, count: attempted }`.
- **accuracyTrend.points:** cumulative accuracy per active day (running correct /
  running attempted). Needs >= 2 points or the tile shows its empty state.
- **answersPerDay.values:** attempted counts for the last 14 days.

## Persistence: the daily activity log

The only new storage. One record per UTC day: `{ attempted, correct }`.

- **Repository interface** (`ProgressRepository`): add
  - `recordActivity(uid, dayKey, delta: { attempted: number; correct: number })`
  - `getActivity(uid, sinceDayKey): Promise<ActivityDay[]>` (or last-N-days)
  - `ActivityDay = { date: number; attempted: number; correct: number }`
- **Day key:** the learner's local midnight (epoch ms) for the day an answer is
  checked, so calendar, this week, answers/day, and accuracy all agree on day
  boundaries. Stored as a `yyyymmdd` doc id derived from that local day.
- **Firestore impl:** subcollection `users/{uid}/activity/{yyyymmdd}` with
  `{ attempted, correct, updatedAt }`, written with `increment()` and merge.
  (Subcollection over a user-doc map: scalable, range-queryable, bounded reads.)
- **In-memory fake:** mirror the same semantics for tests.
- **Recording seam:** at the app layer that already persists during a run
  (`useLessonRun` / `CourseProgressProvider`), increment today's record by each
  newly checked answer (attempted +1, correct +1 when correct). Derive the delta
  from the change in the run's `attempts` / correct counters so it stays in sync
  with the pure engine. Signed-in only (matches today's "anonymous never
  persists" rule); anonymous runs are reflected in-memory for the session.
- **Security rules:** a learner may read/write only their own
  `users/{uid}/activity/**`. Audit before shipping.

## Empty / new-user behavior

A brand-new signed-in learner sees: streak 0, this week 0/7, lessons 0/7,
calendar all-faint, accuracy growth empty caption, answers/day empty. All six
tiles already implement these states, so no new empty UI is required.

## Out of scope (YAGNI)

- The other ten gallery tiles (overall accuracy, lifetime totals, overall
  mastery, last practiced, achievements, personal bests, level/XP, activity
  heatmap, course rollups, completion ring).
- Mastery growth tile and any `MASTERY_TOTAL` expansion.
- Backfilling history for existing users (history starts now).
- Per-URL or persisted tab state.

## Testing

- Pure selector tests for `useProgressMetrics` derivations (week boundary,
  cumulative accuracy, last-N windows, empty inputs).
- In-memory repository tests for `recordActivity` / `getActivity`.
- Emulator test for the Firestore activity impl (mirrors existing
  `firestoreProgressRepository.emulator.test.ts`).
- Keep the existing progress/analytics tests green.
- Visual review of the assembled page in the dev gallery (both tabs, populated
  and new-user states) before shipping.

## Risks

- Recording seam must not double-count under React StrictMode / re-renders;
  derive deltas from monotonic counters, not from effect fire counts.
- Timezone for "this week" and day bucketing: use local midnight consistently in
  the selector; store day keys as UTC to keep the calendar stable.
