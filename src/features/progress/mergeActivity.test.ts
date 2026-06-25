import { describe, it, expect } from "vitest"

import { mergeActivity } from "./mergeActivity"
import { dayKeyToUTCDate } from "./activityDate"
import type { ActivityDay } from "./ProgressRepository"

function day(key: string, attempted: number, correct: number): ActivityDay {
  return { date: dayKeyToUTCDate(key), attempted, correct }
}

describe("mergeActivity", () => {
  it("sums overlapping days and returns ascending by date", () => {
    const merged = mergeActivity(
      [day("20260114", 3, 2), day("20260110", 1, 1)],
      [day("20260114", 2, 1)],
    )
    expect(merged).toEqual([day("20260110", 1, 1), day("20260114", 5, 3)])
  })

  it("passes through a single list sorted", () => {
    expect(mergeActivity([day("20260120", 1, 1), day("20260101", 2, 2)], [])).toEqual([
      day("20260101", 2, 2),
      day("20260120", 1, 1),
    ])
  })
})
