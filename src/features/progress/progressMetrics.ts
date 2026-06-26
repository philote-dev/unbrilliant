import { useMemo } from "react"

import { DATA_STRUCTURES_LESSONS, type ProgressByLesson } from "@/lessons/catalog"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { overallRetention as computeOverallRetention } from "@/features/progress/overallRetention"
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
  /** 0..1 weakest-link memory across completed lessons; drives the willow decay. */
  overallRetention: number
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
  overallRetention?: number
  now?: number
}): ProgressMetrics {
  const now = input.now ?? Date.now()
  const retention = input.overallRetention ?? 1
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
    overallRetention: retention,
    streak: { current: streak.current, longest: streak.longest },
    weeklyConsistency: { daysActive },
    contributions,
    accuracyTrend: { points: points.length >= 2 ? points : [] },
    answersPerDay,
  }
}

/** Hook form: derive the tile view-models + willow signals from live context. */
export function useProgressMetrics(): ProgressMetrics {
  const { progressByLesson, streak, activity } = useCourseProgress()
  const { reviews } = useConceptReviews()
  return useMemo(() => {
    const now = Date.now()
    const completedLessonIds = DATA_STRUCTURES_LESSONS.filter(
      (l) => progressByLesson[l.id]?.completed,
    ).map((l) => l.id)
    const retention = computeOverallRetention(completedLessonIds, reviews, now)
    return computeProgressMetrics({
      progressByLesson,
      streak,
      activity,
      overallRetention: retention,
      now,
    })
  }, [progressByLesson, streak, activity, reviews])
}
