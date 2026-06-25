import { describe, it, expect } from "vitest"

import { computeProgressMetrics } from "./progressMetrics"
import { dayKeyToUTCDate } from "./activityDate"
import type { ActivityDay } from "./ProgressRepository"
import { DATA_STRUCTURES_LESSONS, type ProgressByLesson } from "@/lessons/catalog"

function day(key: string, attempted: number, correct: number): ActivityDay {
  return { date: dayKeyToUTCDate(key), attempted, correct }
}

const NO_STREAK = { current: 0, longest: 0 }
// 2026-01-14 is a Wednesday; its Monday-start week is Jan 12..Jan 18.
const WED = new Date(2026, 0, 14).getTime()

describe("computeProgressMetrics", () => {
  it("returns every tile's empty state for empty inputs", () => {
    const m = computeProgressMetrics({
      progressByLesson: {},
      streak: NO_STREAK,
      activity: [],
      now: WED,
    })
    expect(m.lessonsMastered).toEqual({
      completed: 0,
      total: DATA_STRUCTURES_LESSONS.length,
    })
    expect(m.streak).toEqual(NO_STREAK)
    expect(m.weeklyConsistency).toEqual({ daysActive: 0 })
    expect(m.accuracyTrend).toEqual({ points: [] })
    expect(m.contributions.days).toHaveLength(365)
    expect(m.contributions.days.every((d) => d.count === 0)).toBe(true)
    expect(m.answersPerDay.values).toHaveLength(14)
    expect(m.answersPerDay.values.every((v) => v === 0)).toBe(true)
  })

  it("counts completed lessons and passes the streak through", () => {
    const progressByLesson: ProgressByLesson = {
      "stacks-and-queues": { counters: {}, currentPart: "scenario", completed: true },
      arrays: { counters: {}, currentPart: "a2-shift", completed: true },
      "linked-lists": { counters: {}, currentPart: "traverse", completed: false },
    }
    const m = computeProgressMetrics({
      progressByLesson,
      streak: { current: 5, longest: 12 },
      activity: [],
      now: WED,
    })
    expect(m.lessonsMastered.completed).toBe(2)
    expect(m.streak).toEqual({ current: 5, longest: 12 })
  })

  it("counts only the current week's active days", () => {
    const m = computeProgressMetrics({
      progressByLesson: {},
      streak: NO_STREAK,
      activity: [
        day("20260105", 4, 2), // previous week
        day("20260112", 1, 1), // Mon, in week
        day("20260113", 3, 2), // Tue, in week
        day("20260114", 2, 2), // Wed (now), in week
      ],
      now: WED,
    })
    expect(m.weeklyConsistency).toEqual({ daysActive: 3 })
  })

  it("builds cumulative accuracy across active days (needs >= 2)", () => {
    const one = computeProgressMetrics({
      progressByLesson: {},
      streak: NO_STREAK,
      activity: [day("20260110", 4, 2)],
      now: WED,
    })
    expect(one.accuracyTrend.points).toEqual([])

    const two = computeProgressMetrics({
      progressByLesson: {},
      streak: NO_STREAK,
      activity: [day("20260110", 4, 2), day("20260111", 6, 6)],
      now: WED,
    })
    expect(two.accuracyTrend.points).toEqual([2 / 4, 8 / 10])
  })

  it("emits a dense 14-day answers window aligned to now", () => {
    const m = computeProgressMetrics({
      progressByLesson: {},
      streak: NO_STREAK,
      activity: [day("20260110", 2, 1), day("20260114", 5, 3)],
      now: WED,
    })
    expect(m.answersPerDay.values).toHaveLength(14)
    expect(m.answersPerDay.values[13]).toBe(5) // Jan 14 (now)
    expect(m.answersPerDay.values[9]).toBe(2) // Jan 10
    expect(m.answersPerDay.values.reduce((s, v) => s + v, 0)).toBe(7)
  })

  it("ends the 365-day calendar on now's day with UTC-encoded dates", () => {
    const m = computeProgressMetrics({
      progressByLesson: {},
      streak: NO_STREAK,
      activity: [day("20260114", 5, 3)],
      now: WED,
    })
    const last = m.contributions.days[364]
    expect(last.date).toBe(dayKeyToUTCDate("20260114"))
    expect(last.count).toBe(5)
    expect(m.contributions.days[0].count).toBe(0)
  })
})
