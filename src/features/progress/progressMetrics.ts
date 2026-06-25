import { useMemo } from "react"

import { DATA_STRUCTURES_LESSONS, type ProgressByLesson } from "@/lessons/catalog"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import {
  dayKeyToUTCDate,
  lastNDayKeys,
  localWeekRange,
  utcDateToDayKey,
} from "@/features/progress/activityDate"
import type { ActivityDay } from "@/features/progress/ProgressRepository"
import type {
  ContributionsVM,
  LessonsMasteredVM,
  SeriesVM,
  StreakVM,
  VolumeVM,
  WeeklyConsistencyVM,
} from "@/components/willow/progress/types"

/**
 * The single pure seam between persisted data and the progress-page tiles. Every
 * tile view-model is derived here from real progress + the per-day activity log,
 * so the screen stays presentational and the derivations stay unit-testable.
 */
export interface ProgressMetrics {
  lessonsMastered: LessonsMasteredVM
  streak: StreakVM
  weeklyConsistency: WeeklyConsistencyVM
  contributions: ContributionsVM
  accuracyTrend: SeriesVM
  answersPerDay: VolumeVM
}

const CALENDAR_DAYS = 365
const ANSWERS_PER_DAY_DAYS = 14

export function computeProgressMetrics(input: {
  progressByLesson: ProgressByLesson
  streak: { current: number; longest: number }
  activity: ActivityDay[]
  now?: number
}): ProgressMetrics {
  const now = input.now ?? Date.now()
  const { progressByLesson, streak, activity } = input

  const attemptedByKey = new Map<string, number>()
  for (const d of activity) attemptedByKey.set(utcDateToDayKey(d.date), d.attempted)

  const completed = DATA_STRUCTURES_LESSONS.filter(
    (l) => progressByLesson[l.id]?.completed,
  ).length

  const { startKey, endKey } = localWeekRange(now)
  let daysActive = 0
  for (const [key, attempted] of attemptedByKey) {
    if (attempted > 0 && key >= startKey && key <= endKey) daysActive++
  }

  const contributions: ContributionsVM = {
    days: lastNDayKeys(now, CALENDAR_DAYS).map((key) => ({
      date: dayKeyToUTCDate(key),
      count: attemptedByKey.get(key) ?? 0,
    })),
  }

  // Cumulative accuracy per active day (ascending), so the line trends toward the
  // lifetime average. Fewer than two active days has nothing to plot.
  let runCorrect = 0
  let runAttempted = 0
  const points: number[] = []
  for (const d of activity) {
    if (d.attempted <= 0) continue
    runCorrect += d.correct
    runAttempted += d.attempted
    points.push(runCorrect / runAttempted)
  }

  const answersPerDay: VolumeVM = {
    values: lastNDayKeys(now, ANSWERS_PER_DAY_DAYS).map(
      (key) => attemptedByKey.get(key) ?? 0,
    ),
  }

  return {
    lessonsMastered: { completed, total: DATA_STRUCTURES_LESSONS.length },
    streak: { current: streak.current, longest: streak.longest },
    weeklyConsistency: { daysActive },
    contributions,
    accuracyTrend: { points: points.length >= 2 ? points : [] },
    answersPerDay,
  }
}

/** Hook form: derive the six tile view-models from the live progress context. */
export function useProgressMetrics(): ProgressMetrics {
  const { progressByLesson, streak, activity } = useCourseProgress()
  return useMemo(
    () => computeProgressMetrics({ progressByLesson, streak, activity }),
    [progressByLesson, streak, activity],
  )
}
