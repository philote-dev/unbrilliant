import type {
  AccuracyVM,
  AchievementsVM,
  ContributionsVM,
  CourseRollupVM,
  HeatmapVM,
  LastPracticedVM,
  LessonsMasteredVM,
  LevelVM,
  LifetimeVM,
  MasteryVM,
  PersonalBestsVM,
  SeriesVM,
  StreakVM,
  VolumeVM,
  WeeklyConsistencyVM,
} from "./types"

/**
 * Deterministic mock data for the gallery. Every value is fixed (no Date, no
 * Math.random) so each tile renders identically every run. Each metric exposes
 * a `*Populated` (rich, in-range) and a `*Empty` (no activity yet) dataset.
 */

/* A fixed reference timestamp (epoch ms), roughly mid-2026. Never computed from
   the clock so "last practiced" demos stay stable. */
const REFERENCE_AT = 1782240000000

/* -------------------------------- headline -------------------------------- */

export const accuracyPopulated: AccuracyVM = { correct: 84, attempted: 100 }
export const accuracyEmpty: AccuracyVM = { correct: 0, attempted: 0 }

export const lifetimePopulated: LifetimeVM = { attempted: 1240, correct: 1042 }
export const lifetimeEmpty: LifetimeVM = { attempted: 0, correct: 0 }

export const lessonsMasteredPopulated: LessonsMasteredVM = { completed: 5, total: 8 }
export const lessonsMasteredEmpty: LessonsMasteredVM = { completed: 0, total: 8 }

export const masteryPopulated: MasteryVM = { mastery: 0.72 }
export const masteryEmpty: MasteryVM = { mastery: 0 }

/* ------------------------------- over time -------------------------------- */

export const streakPopulated: StreakVM = { current: 5, longest: 12 }
export const streakEmpty: StreakVM = { current: 0, longest: 0 }

export const heatmapPopulated: HeatmapVM = {
  weeks: [
    [0, 2, 3, 0, 4, 1, 0],
    [1, 0, 2, 3, 0, 5, 2],
    [2, 3, 0, 1, 4, 0, 3],
    [0, 0, 1, 2, 3, 4, 0],
    [3, 2, 1, 0, 0, 2, 5],
    [4, 0, 3, 2, 1, 0, 0],
    [0, 1, 2, 3, 4, 5, 6],
    [2, 2, 0, 0, 3, 1, 2],
    [1, 3, 2, 4, 0, 0, 1],
    [0, 0, 0, 2, 3, 4, 2],
    [5, 4, 3, 2, 1, 0, 0],
    [2, 0, 1, 3, 2, 4, 1],
    [3, 3, 0, 2, 0, 1, 4],
    [2, 1, 3, 0],
  ],
}
export const heatmapEmpty: HeatmapVM = {
  weeks: Array.from({ length: 14 }, () => [0, 0, 0, 0, 0, 0, 0]),
}

export const accuracyTrendPopulated: SeriesVM = {
  points: [0.52, 0.55, 0.58, 0.6, 0.61, 0.64, 0.67, 0.7, 0.72, 0.78, 0.81, 0.84],
}
export const accuracyTrendEmpty: SeriesVM = { points: [] }

export const masteryGrowthPopulated: SeriesVM = {
  points: [0.1, 0.18, 0.24, 0.3, 0.35, 0.44, 0.5, 0.55, 0.62, 0.68, 0.72],
}
export const masteryGrowthEmpty: SeriesVM = { points: [] }

export const volumePopulated: VolumeVM = {
  values: [12, 8, 0, 15, 22, 9, 18, 0, 14, 20, 6, 16],
}
export const volumeEmpty: VolumeVM = { values: [] }

export const lastPracticedPopulated: LastPracticedVM = { at: REFERENCE_AT }
export const lastPracticedEmpty: LastPracticedVM = { at: null }

/* ------------------------------ motivation -------------------------------- */

export const achievementsPopulated: AchievementsVM = {
  items: [
    { id: "first-mastery", label: "First mastery", earned: true },
    { id: "perfect-lesson", label: "Perfect lesson", earned: true },
    { id: "streak-7", label: "7-day streak", earned: false },
    { id: "answers-100", label: "100 answers", earned: true },
    { id: "course-complete", label: "Course complete", earned: false },
  ],
}
export const achievementsEmpty: AchievementsVM = {
  items: [
    { id: "first-mastery", label: "First mastery", earned: false },
    { id: "perfect-lesson", label: "Perfect lesson", earned: false },
    { id: "streak-7", label: "7-day streak", earned: false },
    { id: "answers-100", label: "100 answers", earned: false },
    { id: "course-complete", label: "Course complete", earned: false },
  ],
}

export const personalBestsPopulated: PersonalBestsVM = {
  bestStreak: 12,
  bestLessonAccuracy: 0.96,
  bestDayCount: 42,
}
export const personalBestsEmpty: PersonalBestsVM = {
  bestStreak: 0,
  bestLessonAccuracy: 0,
  bestDayCount: null,
}

export const levelPopulated: LevelVM = { totalCorrect: 1042, xpPerLevel: 100 }
export const levelEmpty: LevelVM = { totalCorrect: 0, xpPerLevel: 100 }

export const weeklyConsistencyPopulated: WeeklyConsistencyVM = { daysActive: 5 }
export const weeklyConsistencyEmpty: WeeklyConsistencyVM = { daysActive: 0 }

/* ---------------------------- course rollups ------------------------------ */

export const coursesSingle: CourseRollupVM[] = [
  {
    courseId: "data-structures",
    title: "Data Structures",
    icon: "data-structures",
    completion: 57,
    mastery: 0.72,
    accuracy: 0.84,
  },
]

export const coursesMulti: CourseRollupVM[] = [
  {
    courseId: "data-structures",
    title: "Data Structures",
    icon: "data-structures",
    completion: 57,
    mastery: 0.72,
    accuracy: 0.84,
  },
  {
    courseId: "algorithms",
    title: "Algorithms",
    icon: "algorithms",
    completion: 24,
    mastery: 0.31,
    accuracy: 0.66,
  },
  {
    courseId: "probability",
    title: "Probability",
    icon: "probability",
    completion: 8,
    mastery: 0.12,
    accuracy: 0.58,
  },
]

export const coursesEmpty: CourseRollupVM[] = []

/* --------------------------- contribution map ----------------------------- */

/* A fixed year of daily counts at UTC midnights, generated deterministically
   (no clock, no Math.random) so the calendar renders identically every run. */
function contributionDays(count: (i: number) => number) {
  const end = 1782172800000 // a fixed UTC midnight in mid-2026
  const n = 364
  return Array.from({ length: n }, (_, i) => ({
    date: end - (n - 1 - i) * 86400000,
    count: count(i),
  }))
}

export const contributionsPopulated: ContributionsVM = {
  days: contributionDays((i) =>
    Math.max(0, Math.round(2.4 + 2.4 * Math.sin(i / 8)) - (i % 7 === 0 ? 3 : 0)),
  ),
}
export const contributionsEmpty: ContributionsVM = {
  days: contributionDays(() => 0),
}
