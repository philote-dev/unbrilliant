import {
  DEQUEUE_QUOTA,
  POP_QUOTA,
  SCENARIO_QUOTA,
  type LessonProgress,
} from "@/features/lesson/engine"
import {
  COST_QUOTA,
  RESIZE_QUOTA,
  SHIFT_QUOTA,
} from "@/features/lesson/arraysEngine"

/**
 * Pure per-lesson analytics for the Progress drill-down — derived entirely from
 * the persisted `counters` map (mastery counts + the bookkeeping `attempts`), so
 * accuracy and mastery are real, never hardcoded.
 */
const MASTERY_TOTAL: Record<string, number> = {
  "stacks-and-queues": POP_QUOTA + DEQUEUE_QUOTA + SCENARIO_QUOTA,
  arrays: SHIFT_QUOTA + COST_QUOTA + RESIZE_QUOTA,
}

export interface LessonStats {
  started: boolean
  completed: boolean
  attempted: number // total checked answers (correct + wrong)
  correct: number // correct answers (the mastery counters)
  accuracy: number // 0..1 — correct / attempted
  mastery: number // 0..1 — correct / mastery total
}

/** Sum the mastery counters (everything except the bookkeeping `attempts`). */
function correctCount(counters: Record<string, number>): number {
  return Object.entries(counters).reduce(
    (sum, [key, value]) => (key === "attempts" ? sum : sum + value),
    0,
  )
}

export function lessonStats(
  lessonId: string,
  progress: LessonProgress | undefined,
): LessonStats {
  const counters = progress?.counters ?? {}
  const attempted = counters.attempts ?? 0
  const correct = correctCount(counters)
  const total = MASTERY_TOTAL[lessonId] ?? 0
  const completed = progress?.completed ?? false
  return {
    started: completed || attempted > 0 || correct > 0,
    completed,
    attempted,
    correct,
    accuracy: attempted > 0 ? correct / attempted : 0,
    mastery: total > 0 ? Math.min(correct / total, 1) : 0,
  }
}
