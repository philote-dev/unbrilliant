/**
 * View-model interfaces for the progress-metric tiles. Pure data shapes only:
 * tiles are presentational and receive one of these via props. Accuracy and
 * mastery are 0..1, completion is 0..100, counts are integers, timestamps are
 * epoch milliseconds.
 */

export interface AccuracyVM { correct: number; attempted: number }
export interface LifetimeVM { attempted: number; correct: number }
export interface LessonsMasteredVM { completed: number; total: number }
export interface MasteryVM { mastery: number }
export interface StreakVM { current: number; longest: number }
export interface HeatmapVM { weeks: number[][] }
export interface SeriesVM { points: number[] }
export interface VolumeVM { values: number[] }
export interface LastPracticedVM { at: number | null }

export type AchievementId =
  | "first-mastery"
  | "perfect-lesson"
  | "streak-7"
  | "answers-100"
  | "course-complete"

export interface Achievement { id: AchievementId; label: string; earned: boolean }
export interface AchievementsVM { items: Achievement[] }

export interface PersonalBestsVM {
  bestStreak: number
  bestLessonAccuracy: number
  bestDayCount: number | null
}

export interface LevelVM { totalCorrect: number; xpPerLevel?: number }
export interface WeeklyConsistencyVM { daysActive: number }

/** One day in the contribution calendar: a UTC-midnight epoch ms + that day's count. */
export interface ContributionDay { date: number; count: number }
export interface ContributionsVM { days: ContributionDay[] }

export interface CourseRollupVM {
  courseId: string
  title: string
  icon: "data-structures" | "algorithms" | "probability"
  completion: number
  mastery: number
  accuracy: number
}
