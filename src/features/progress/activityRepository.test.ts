import { describe, it, expect } from "vitest"

import { createInMemoryProgressRepository } from "./inMemoryProgressRepository"
import { dayKeyToUTCDate } from "./activityDate"

describe("activity log (in-memory repository)", () => {
  it("returns no activity for an unknown user", async () => {
    const repo = createInMemoryProgressRepository()
    expect(await repo.getActivity("nobody", "20260101")).toEqual([])
  })

  it("accumulates multiple same-day records", async () => {
    const repo = createInMemoryProgressRepository()
    await repo.recordActivity("ann", "20260114", { attempted: 3, correct: 2 })
    await repo.recordActivity("ann", "20260114", { attempted: 1, correct: 1 })
    expect(await repo.getActivity("ann", "20260101")).toEqual([
      { date: dayKeyToUTCDate("20260114"), attempted: 4, correct: 3 },
    ])
  })

  it("filters out days before the since key", async () => {
    const repo = createInMemoryProgressRepository()
    await repo.recordActivity("ben", "20260110", { attempted: 5, correct: 4 })
    await repo.recordActivity("ben", "20260114", { attempted: 2, correct: 1 })
    const days = await repo.getActivity("ben", "20260112")
    expect(days).toHaveLength(1)
    expect(days[0]).toMatchObject({ attempted: 2, correct: 1 })
  })

  it("returns days ascending by date regardless of write order", async () => {
    const repo = createInMemoryProgressRepository()
    await repo.recordActivity("cara", "20260120", { attempted: 1, correct: 0 })
    await repo.recordActivity("cara", "20260103", { attempted: 2, correct: 2 })
    await repo.recordActivity("cara", "20260112", { attempted: 3, correct: 1 })
    const dates = (await repo.getActivity("cara", "20260101")).map((d) => d.date)
    expect(dates).toEqual([
      dayKeyToUTCDate("20260103"),
      dayKeyToUTCDate("20260112"),
      dayKeyToUTCDate("20260120"),
    ])
  })

  it("keeps each user's activity isolated", async () => {
    const repo = createInMemoryProgressRepository()
    await repo.recordActivity("dee", "20260114", { attempted: 9, correct: 9 })
    expect(await repo.getActivity("eve", "20260101")).toEqual([])
  })
})
