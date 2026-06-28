import { describe, expect, it } from "vitest"
import { trialUnlocked } from "./gating"

const order = ["trial-1-linear", "trial-2-organization"]

describe("trialUnlocked", () => {
  it("locked until the capping unit is complete", () => {
    expect(trialUnlocked({ trialId: "trial-1-linear", order, completed: new Set(), unitComplete: false })).toBe(false)
  })
  it("first trial unlocks once its unit is complete", () => {
    expect(trialUnlocked({ trialId: "trial-1-linear", order, completed: new Set(), unitComplete: true })).toBe(true)
  })
  it("later trial stays locked until the prior trial is completed", () => {
    expect(trialUnlocked({ trialId: "trial-2-organization", order, completed: new Set(), unitComplete: true })).toBe(false)
    expect(
      trialUnlocked({ trialId: "trial-2-organization", order, completed: new Set(["trial-1-linear"]), unitComplete: true }),
    ).toBe(true)
  })
})
