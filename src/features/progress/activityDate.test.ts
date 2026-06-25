import { describe, it, expect } from "vitest"

import {
  dayKeyToUTCDate,
  lastNDayKeys,
  localDayKey,
  localWeekRange,
  utcDateToDayKey,
} from "./activityDate"

const DAY = 86_400_000

describe("localDayKey", () => {
  it("zero-pads month and day to a yyyymmdd key", () => {
    // Constructed and read in local time, so the key is timezone-independent.
    expect(localDayKey(new Date(2026, 0, 5).getTime())).toBe("20260105")
    expect(localDayKey(new Date(2026, 11, 31).getTime())).toBe("20261231")
  })
})

describe("dayKeyToUTCDate", () => {
  it("maps a key to the matching UTC midnight (timezone-independent)", () => {
    const ms = dayKeyToUTCDate("20260114")
    const d = new Date(ms)
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(0)
    expect(d.getUTCDate()).toBe(14)
    expect(ms % DAY).toBe(0)
  })
})

describe("utcDateToDayKey", () => {
  it("is the inverse of dayKeyToUTCDate", () => {
    for (const key of ["20260101", "20260114", "20261231", "20250930"]) {
      expect(utcDateToDayKey(dayKeyToUTCDate(key))).toBe(key)
    }
  })
})

describe("lastNDayKeys", () => {
  it("returns n keys oldest to newest, ending on the day of now", () => {
    const keys = lastNDayKeys(new Date(2026, 0, 15).getTime(), 3)
    expect(keys).toEqual(["20260113", "20260114", "20260115"])
  })

  it("rolls across a month/year boundary", () => {
    const keys = lastNDayKeys(new Date(2026, 0, 1).getTime(), 3)
    expect(keys).toEqual(["20251230", "20251231", "20260101"])
  })

  it("produces contiguous days (UTC dates differ by exactly one day)", () => {
    const keys = lastNDayKeys(new Date(2026, 5, 20).getTime(), 30)
    expect(keys).toHaveLength(30)
    for (let i = 1; i < keys.length; i++) {
      expect(dayKeyToUTCDate(keys[i]) - dayKeyToUTCDate(keys[i - 1])).toBe(DAY)
    }
  })
})

describe("localWeekRange", () => {
  it("returns Monday to Sunday for a midweek day", () => {
    // 2026-01-14 is a Wednesday.
    expect(localWeekRange(new Date(2026, 0, 14).getTime())).toEqual({
      startKey: "20260112",
      endKey: "20260118",
    })
  })

  it("keeps a Sunday in the same Monday-start week", () => {
    // 2026-01-18 is a Sunday.
    expect(localWeekRange(new Date(2026, 0, 18).getTime())).toEqual({
      startKey: "20260112",
      endKey: "20260118",
    })
  })

  it("keeps a Monday as the week start", () => {
    // 2026-01-12 is a Monday.
    expect(localWeekRange(new Date(2026, 0, 12).getTime())).toEqual({
      startKey: "20260112",
      endKey: "20260118",
    })
  })
})
