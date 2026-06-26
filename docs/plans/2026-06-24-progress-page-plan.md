# Progress page (Stage 2) implementation plan

- Date: 2026-06-24
- Spec: `docs/plans/specs/2026-06-24-progress-page-design.md`
- Approach: subagent-driven (each task: spec-compliance review, then code-quality review; `test-runner` keeps tests green; `verifier` confirms; `security-auditor` on persistence/rules).

## Goal

Replace the per-lesson drill-down on the `progress` screen with a two-tab personal-progression dashboard (Overview / Activity) built from six existing presentational tiles, fed by a new pure selector (`useProgressMetrics`), and add one persistence primitive (a per-day activity log of `{ attempted, correct }`) that powers the four time-series tiles. Real data only; history accrues going forward.

## Architecture decisions (resolved)

1. **Recording seam lives in `useLessonRun.tsx`**, a sibling effect to the existing `saveProgress` effect (the only progress-write seam). Delta is derived from the change in monotonic counters (`attempts`, and `sum(counters) - attempts`), with a per-lesson baseline ref so a double-fired effect (StrictMode) computes a zero delta the second time.
2. **Session overlay flows up like `progressByLesson`.** `useLessonRun` publishes this session's per-day deltas (`sessionActivity`); `CourseProgressProvider` loads the persisted log once per signed-in user (`serverActivity`) and exposes the merged `activity`. This makes anonymous runs reflect in-memory and makes signed-in "today" show instantly without a re-read. No double count: `serverActivity` is read at mount (before this session's writes); `sessionActivity` holds only this session's deltas.
3. **Canonical day bucket = local calendar day**, represented two ways: a `yyyymmdd` string (doc id / grouping key) and, for the tiles, `date = Date.UTC(localY, localM, localD)`. Using `Date.UTC` of the local Y/M/D (not raw local-midnight epoch) is deliberate: `ContributionCalendar` reads the epoch with `getUTCDay()/getUTCMonth()/floor(/86400000)`, so this keeps the calendar's day-of-week and month labels correct for viewers east of UTC. All windowing (week, last-N) iterates calendar days via the `Date` constructor (DST-safe), never by adding `86400000`.
4. **Firestore rules:** `users/{uid}/activity/**` is already covered by the recursive `match /{document=**}` owner rule, so it is functionally owner-only today. Add an explicit `match /activity/{dayKey}` block for clarity/intent and an emulator denial test. (Field-shape hardening is an optional auditor call; see T3.)
5. **Split the screen** into a presentational `ProgressDashboard` (props-driven, gallery-reviewable for populated + empty) and a thin `Progress` screen that wires `useProgressMetrics()`.

---

## Ordered tasks

### T1. Local-day date helpers (pure)

- **Intent:** One DST-safe place to turn timestamps into local day keys and back, shared by repo, recorder, and selector.
- **Create:** `src/features/progress/activityDate.ts`
- **Signatures:**

```ts
export function localDayKey(ts: number): string                 // "yyyymmdd" from local Y/M/D
export function dayKeyToUTCDate(dayKey: string): number          // Date.UTC(y, m-1, d)
export function lastNDayKeys(now: number, n: number): string[]   // local days, oldest -> newest (Date ctor increments)
export function localWeekRange(now: number): { startKey: string; endKey: string } // Mon..Sun (Mon = week start)
```

- **Tests:** `src/features/progress/activityDate.test.ts`: `localDayKey` zero-pads months/days; `dayKeyToUTCDate` round-trips; `lastNDayKeys` length `n`, ascending, contiguous, correct across a DST boundary and across a month/year boundary; `localWeekRange` returns Mon-Sun and handles a Sunday `now`.
- **Reviews:** spec-compliance, code-quality; test-runner.

### T2. Activity persistence primitive (repository)

- **Intent:** Add the daily-log methods behind the existing `ProgressRepository` boundary, real + fake impls.
- **Edit:** `src/features/progress/ProgressRepository.ts`, `src/features/progress/firestoreProgressRepository.ts`, `src/features/progress/inMemoryProgressRepository.ts`
- **Interface additions:**

```ts
export interface ActivityDay { date: number; attempted: number; correct: number }
// date = Date.UTC(localY, localM, localD) for the bucketed local day; counts are non-negative ints.

interface ProgressRepository {
  // ...existing...
  recordActivity(uid: string, dayKey: string, delta: { attempted: number; correct: number }): Promise<void>
  getActivity(uid: string, sinceDayKey: string): Promise<ActivityDay[]> // ascending by date
}
```

- **Firestore impl:** subcollection `users/{uid}/activity/{yyyymmdd}`.
  - `recordActivity`: `setDoc(ref, { date: dayKeyToUTCDate(dayKey), attempted: increment(d.attempted), correct: increment(d.correct), updatedAt: serverTimestamp() }, { merge: true })`.
  - `getActivity`: `query(col, where(documentId(), ">=", sinceDayKey), orderBy(documentId()))`; map to `ActivityDay` (fall back `date` to `dayKeyToUTCDate(id)` if missing). No composite index needed.
- **In-memory impl:** `Map<uid, Map<dayKey, {attempted, correct}>>`; `recordActivity` accumulates; `getActivity` filters `dayKey >= sinceDayKey` (lexicographic == numeric for fixed-width keys), returns sorted `ActivityDay[]`.
- **Tests:** `src/features/progress/activityRepository.test.ts` (in-memory): multiple same-day `recordActivity` calls accumulate; `getActivity` respects `since`; ascending order; unknown uid -> `[]`.
- **Reviews:** spec-compliance, code-quality; **security-auditor** (write path), test-runner.

### T3. Firestore rule for activity + emulator coverage

- **Intent:** Make owner-only access to the activity subcollection explicit and prove cross-user reads fail.
- **Edit:** `firestore.rules`
- **Change:** inside `match /users/{uid}` add:

```
match /activity/{dayKey} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

Keep the existing recursive `match /{document=**}` (both rules grant the same owner-only access; no behavior change, clearer intent). The auditor decides whether to additionally tighten write shape (numeric `attempted`/`correct` >= 0 only). Note: enforcing shape would require narrowing the broad recursive wildcard (which also matches `lessonProgress`), so treat shape-validation as optional hardening to avoid blast radius on unrelated `lessonProgress`.
- **Edit (tests):** `src/features/progress/firestoreProgressRepository.emulator.test.ts` add: record-then-read accumulates across two same-day writes; `getActivity` `since` boundary; **cross-user `getActivity` denied** via `assertFails` (mirrors the existing `getProgress` denial test).
- **Reviews:** **security-auditor** (rules + activity write path; address Critical/High before ship), test-runner via `npm run test:emulator`.

### T4. Recording seam in `useLessonRun` + session overlay

- **Intent:** Persist per-answer deltas (signed-in) and publish this session's per-day deltas for the overlay, derived from counter changes, StrictMode- and resume-safe.
- **Edit:** `src/features/lesson/useLessonRun.tsx`
- **Create (pure, testable):** `src/features/progress/activityDelta.ts`

```ts
export function answerTallies(counters: Record<string, number>): { attempted: number; correct: number }
// attempted = counters.attempts ?? 0; correct = sum(values) - attempted
export function activityDelta(
  prev: { attempted: number; correct: number },
  next: { attempted: number; correct: number },
): { attempted: number; correct: number } // clamped at >= 0 per field; {0,0} when not advancing
```

- **`useLessonRun` additions:**
  - `sessionActivityState` (`useState<Record<dayKey,{attempted,correct}>>`) and `activityBaseRef` (`useRef<Record<lessonId,{attempted,correct}>>`).
  - **Recorder effect** (sibling to `saveProgress`, deps `[user, lessonId, repo, module, progressSig]`):
    1. `current = answerTallies(module.toProgress(runsRef.current[lessonId]).counters)`.
    2. If `user` and `reconciledKey.current !== ${user.uid}:${lessonId}`: set baseline = current, return (don't record while unreconciled, so a resume-hydrate jump is never counted).
    3. `base = activityBaseRef.current[lessonId]`; if undefined: set base = current, return (first observation / fresh anonymous run).
    4. `delta = activityDelta(base, current)`; advance baseline to current. If `delta.attempted <= 0` return.
    5. `key = localDayKey(Date.now())`; add delta into `sessionActivityState[key]` (overlay, both anonymous and signed-in).
    6. If `user`: `void repo.recordActivity(user.uid, key, delta).catch(() => {})` (durability, signed-in only).
  - Expose `sessionActivity: ActivityDay[]` on `LessonRunValue` (memoized from the map via `dayKeyToUTCDate`).
- **Do not** reset the overlay on auth change: pre-sign-in anonymous deltas already shown are never persisted (per "history starts now") and never re-read, so no double count; the post-sign-in baseline is set by reconcile.
- **Tests:** `src/features/progress/activityDelta.test.ts` (pure): tallies sum non-`attempts` counters; monotonic increase yields the increment; equal/decreasing inputs yield `{0,0}`; a resume jump handled by baseline-set (documented via the helper behavior).
- **Reviews:** spec-compliance, code-quality; **security-auditor** (write path: signed-in gating, no anonymous writes), test-runner.

### T5. Selector: `computeProgressMetrics` + `useProgressMetrics`

- **Intent:** The single pure seam mapping data to the six VMs.
- **Create:** `src/features/progress/progressMetrics.ts`
- **Signatures:**

```ts
export interface ProgressMetrics {
  lessonsMastered: LessonsMasteredVM
  streak: StreakVM
  weeklyConsistency: WeeklyConsistencyVM
  contributions: ContributionsVM
  accuracyTrend: SeriesVM
  answersPerDay: VolumeVM
}
export function computeProgressMetrics(input: {
  progressByLesson: ProgressByLesson
  streak: { current: number; longest: number }
  activity: ActivityDay[]            // merged, ascending
  now?: number                       // default Date.now(); injected in tests
}): ProgressMetrics
export function useProgressMetrics(): ProgressMetrics // reads useCourseProgress(); useMemo(computeProgressMetrics)
```

- **Derivations (all keyed by local `yyyymmdd`):**
  - `lessonsMastered`: `completed = DATA_STRUCTURES_LESSONS.filter(l => progressByLesson[l.id]?.completed).length`, `total = DATA_STRUCTURES_LESSONS.length`.
  - `streak`: passthrough.
  - `weeklyConsistency.daysActive`: distinct activity days within `localWeekRange(now)` with `attempted > 0`, clamped 0..7.
  - `contributions.days`: dense `lastNDayKeys(now, 365)` mapped to `{ date: dayKeyToUTCDate(key), count: attempted }` (0 for missing days) so the calendar grid renders contiguous weeks.
  - `accuracyTrend.points`: walk active days (`attempted > 0`) chronologically, running `correct / attempted`; if fewer than 2 active days, `points: []` (tile shows empty).
  - `answersPerDay.values`: dense `attempted` for `lastNDayKeys(now, 14)` (oldest -> newest, zeros included).
- **Tests:** `src/features/progress/progressMetrics.test.ts` (pure, inject `now`): week boundary incl. Sunday `now`; cumulative accuracy with 1 active day -> `[]`, with >=2 -> running fractions; last-14 dense window with zeros; contributions length 365 and `date` equals `Date.UTC(...)`; `lessonsMastered` count; all-empty inputs -> every tile's empty state.
- **Reviews:** spec-compliance, code-quality; test-runner.

### T6. Expose merged `activity` from `CourseProgressProvider`

- **Intent:** Load the persisted log once per signed-in user and merge with the session overlay.
- **Edit:** `src/features/progress/CourseProgressProvider.tsx`
- **Changes:**
  - In the per-user load effect, also `repo.getActivity(user.uid, lastNDayKeys(Date.now(), 370)[0])` into `serverActivity` state; clear to `[]` when signed out.
  - Read `sessionActivity` from `useLessonRun()`.
  - `activity = useMemo(() => mergeActivity(serverActivity, sessionActivity), ...)` where `mergeActivity` sums by `date` and sorts ascending.
  - Add `activity: ActivityDay[]` to `CourseProgressValue` and the context `value`.
- **Tests:** covered indirectly by T5 (pure merge can be a tiny exported `mergeActivity` with its own unit test); keep provider logic thin.
- **Reviews:** spec-compliance, code-quality; test-runner.

### T7. Rebuild the Progress screen (dashboard + tabs)

- **Intent:** Replace the `LessonStatCard` list with the two-tab tile dashboard.
- **Create:** `src/screens/ProgressDashboard.tsx` (presentational: props `{ metrics: ProgressMetrics }`, owns local `useState<"overview" | "activity">`).
- **Edit:** `src/screens/Progress.tsx` -> `const m = useProgressMetrics(); return <ProgressDashboard metrics={m} />`. Remove `LessonStatCard` and the `derivePathNodes/lessonStats` imports from this screen.
- **Layout:** header ("Your progress" + subtitle), a segmented pill control (two `aria-pressed` buttons, semantic tokens, BottomNav-style), then a single mobile-first `space-y-3` column:
  - Overview: `StreakTile`, `WeeklyConsistencyTile`, `LessonsMasteredTile`.
  - Activity: `ContributionCalendarTile`, `AccuracyTrendTile`, `AnswersPerDayTile`.
- **Constraints:** semantic tokens only (`bg-card`, `text-muted-foreground`, `text-lilac-strong`, etc.), no raw hex / `neutral-*`; `import type` for VM/metric types; no em-dashes (this screen is in-scope for `no-em-dash.test.ts`); legible at 390px.
- **Reviews:** spec-compliance (both tabs, correct tile per tab, empty states), code-quality; test-runner; **verifier** (acceptance criteria below).

### T8. Gallery review aids + visual review

- **Intent:** Review the assembled page for both tabs in populated and new-user states.
- **Edit:** `src/components/willow/progress/fixtures.ts` add `metricsPopulated: ProgressMetrics` and `metricsEmpty: ProgressMetrics` composed from existing tile fixtures (reuse `streakPopulated`, `lessonsMasteredPopulated`, `weeklyConsistencyPopulated`, `contributionsPopulated`, `accuracyTrendPopulated`, `volumePopulated`, and the `*Empty` set).
- **Edit:** `src/dev/GalleryApp.tsx` add a "Progress page" entry (under Screens or a new group) that renders `<ProgressDashboard metrics={fx.metricsPopulated} />` and `<ProgressDashboard metrics={fx.metricsEmpty} />` inside the 390px `PhoneFrame`; the existing live `progress` `ScreenStory` remains the new-user assembled view.
- **Visual review:** `npm run gallery`, exercise both tabs in both states. Screenshots via Playwright MCP into `docs/reference/` with kebab names (`progress-overview-populated.png`, `progress-activity-populated.png`, `progress-overview-empty.png`, `progress-activity-empty.png`); delete once the review is signed off (per the use-playwright rule).
- **Reviews:** spec-compliance (visual), code-quality (dev-only file); `src/dev/` is excluded from the em-dash guard but still follow the rule.

---

## Recommended scoped commits (dirty tree)

The tree has unrelated WIP (arrays-next, etc.). Implementer creates/edits only the files below and runs no git; controller commits in this order:

1. **feat(progress): local-day date helpers** - `activityDate.ts` + test. (T1)
2. **feat(progress): daily activity repository primitive** - `ProgressRepository.ts`, `firestoreProgressRepository.ts`, `inMemoryProgressRepository.ts`, `activityRepository.test.ts`. (T2)
3. **feat(security): explicit activity rule + emulator tests** - `firestore.rules`, `firestoreProgressRepository.emulator.test.ts`. (T3)
4. **feat(progress): record per-day activity from runs** - `useLessonRun.tsx`, `activityDelta.ts` + test. (T4)
5. **feat(progress): progress-metrics selector** - `progressMetrics.ts` (+ `mergeActivity`) + test. (T5)
6. **feat(progress): expose merged activity from provider** - `CourseProgressProvider.tsx`. (T6)
7. **feat(progress): two-tab progress dashboard** - `ProgressDashboard.tsx`, `Progress.tsx`. (T7)
8. **chore(gallery): assembled progress-page review** - `fixtures.ts`, `GalleryApp.tsx`. (T8)

Keep T3 (rules) isolated so the security change is reviewable on its own. Each commit should be independently green except where a later commit wires a new symbol (1->2->4/5->6->7 dependency order holds).

## Security task (explicit)

- **Rules:** T3 adds the explicit `match /activity/{dayKey}` owner-only block and a cross-user `getActivity` denial emulator test.
- **`security-auditor` pass** (read-only) over the activity write path (`useLessonRun` recorder + `firestoreProgressRepository.recordActivity`) and `firestore.rules`. Confirm: anonymous users never write activity; a user can only read/write their own `activity/**`; `increment()` writes cannot be abused to read others' data; decide on optional write-shape validation. Address Critical + High before ship.

## Test plan

- **Pure unit:** `activityDate.test.ts` (T1), `activityDelta.test.ts` (T4), `progressMetrics.test.ts` + `mergeActivity` (T5).
- **In-memory repo:** `activityRepository.test.ts` (T2) for `recordActivity` accumulation / `getActivity` `since` / ordering.
- **Emulator:** extend `firestoreProgressRepository.emulator.test.ts` (T3) for accumulate, `since` boundary, cross-user denial. Run `npm run test:emulator`.
- **Keep green:** `analytics.test.ts`, `reconcileRun.test.ts`, and `no-em-dash.test.ts` (new `src/screens/Progress.tsx` and `ProgressDashboard.tsx` must be em-dash free; `src/features/progress/*` and `src/dev/` are excluded from the guard but still follow the rule). Run `npm run test` after each task via `test-runner`.
- **Gallery visual review:** T8, both tabs, populated + new-user.

## Risks / things to verify while reading code

- **Live-save seam (confirmed):** only `useLessonRun.tsx` `progressSig` effect writes progress; `Completion.tsx` only `refresh()`s. Put the recorder there.
- **StrictMode double-count (handled):** derive deltas from monotonic counters with a per-lesson baseline ref that advances on each record, so a second effect fire yields a zero delta. Never count effect fires.
- **Resume re-baseline (handled):** while `reconciledKey` doesn't match, the recorder only syncs baseline (no record), so a resume-hydrate jump in counters is never persisted as activity.
- **Timezone (decided):** bucket by local calendar day; emit `date = Date.UTC(localY, localM, localD)` so `ContributionCalendar`'s UTC-based rendering shows the correct local day for east-of-UTC viewers. Verify against the tile's `getUTCDay()/getUTCMonth()` usage. The design doc's "store as UTC" note refers to keeping the bucket stable; this satisfies it while honoring "bucket by local day".
- **Anonymous vs signed-in (decided):** session overlay always accrues (anonymous + signed-in); Firestore writes are signed-in + reconciled only; no anonymous backfill on sign-in (history starts now).
- **Dense vs sparse series (verified):** `ContributionCalendar` and the bar/line tiles expect contiguous days (fixtures are dense), so the selector must emit dense last-365 / last-14 windows including zero days.
- **Rules wildcard:** `match /{document=**}` already covers `activity/**`; the explicit block is for intent/tests. Field-shape hardening would require narrowing that wildcard (touches `lessonProgress`); leave to the auditor to avoid unrelated blast radius.
- **`getActivity` query:** `where(documentId(), ">=", since)` + `orderBy(documentId())` needs no composite index; confirm under the emulator. In-memory fake must mirror `since` semantics with fixed-width key compare.
- **Provider scope:** `main.tsx` mounts `LessonRunProvider > CourseProgressProvider`, so `CourseProgressProvider` can read `useLessonRun().sessionActivity`; no provider re-ordering needed.

## Acceptance criteria (verifier)

- `progress` screen shows a header, a working Overview/Activity segmented control (default Overview), and the correct three tiles per tab; the old `LessonStatCard` list is gone.
- A brand-new signed-in learner sees streak 0, this week 0/7, lessons 0/7, empty calendar, "Not enough data" accuracy, "No answers yet" volume.
- Answering questions in a run updates this session's Activity tiles immediately (anonymous and signed-in); a signed-in learner's counts survive reload (persisted), bucketed to the correct local day; an anonymous learner's counts vanish on reload.
- A second learner cannot read the first learner's activity (emulator denial passes).
- `npm run test` and `npm run test:emulator` pass; no em-dashes in shipped files; strict TS (`import type`, no unused) clean; `npm run build` (`tsc -b && vite build`) succeeds.
