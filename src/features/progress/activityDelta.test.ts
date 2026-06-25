import { describe, it, expect } from "vitest"

import { activityDelta, answerTallies } from "./activityDelta"

describe("answerTallies", () => {
  it("reads attempted from the attempts key and sums the rest as correct", () => {
    expect(answerTallies({ pops: 3, dequeues: 3, scenarios: 4, attempts: 12 })).toEqual({
      attempted: 12,
      correct: 10,
    })
  })

  it("is all zero for an empty counters map", () => {
    expect(answerTallies({})).toEqual({ attempted: 0, correct: 0 })
  })

  it("treats a missing attempts key as zero attempted", () => {
    expect(answerTallies({ a1: 1, a2: 1 })).toEqual({ attempted: 0, correct: 2 })
  })
})

describe("activityDelta", () => {
  it("returns the increase between two tallies", () => {
    expect(
      activityDelta({ attempted: 2, correct: 1 }, { attempted: 5, correct: 3 }),
    ).toEqual({ attempted: 3, correct: 2 })
  })

  it("is {0,0} when the tally is unchanged", () => {
    expect(
      activityDelta({ attempted: 5, correct: 3 }, { attempted: 5, correct: 3 }),
    ).toEqual({ attempted: 0, correct: 0 })
  })

  it("never goes negative if the tally somehow decreases (resume/reset)", () => {
    expect(
      activityDelta({ attempted: 9, correct: 8 }, { attempted: 2, correct: 1 }),
    ).toEqual({ attempted: 0, correct: 0 })
  })
})
