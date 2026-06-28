import { describe, expect, it } from "vitest"

import { getTrial, trialOrder } from "./registry"

describe("trial registry", () => {
  it("resolves a known trial with at least one mission", () => {
    const trial = getTrial("trial-1-linear")
    expect(trial).toBeDefined()
    expect(trial?.missions.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  it("returns undefined for an unknown trial id", () => {
    expect(getTrial("nope")).toBeUndefined()
  })

  it("trialOrder lists the linear trial", () => {
    expect(trialOrder).toContain("trial-1-linear")
  })
})
