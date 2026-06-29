import { describe, expect, it } from "vitest"

import { createInMemoryProgressRepository } from "@/features/progress/inMemoryProgressRepository"
import { emptySave, type TrialSaveState } from "@/features/trials/saveState"

describe("Trial progress persistence (in-memory)", () => {
  it("round-trips a saved trial slice, isolated per uid and trialId", async () => {
    const repo = createInMemoryProgressRepository()
    expect(await repo.getTrialProgress("u1", "trial-1-linear")).toBeNull()

    const slice: TrialSaveState = {
      ...emptySave("trial-1-linear", "mission-a", "a2"),
      operationMappings: { arrival: "back", serve: "front" },
      verdicts: { a1: "viable", a2: "strained" },
      stressTestsRun: ["a1", "a2"],
    }
    await repo.saveTrialProgress("u1", "trial-1-linear", slice)

    expect(await repo.getTrialProgress("u1", "trial-1-linear")).toEqual(slice)
    // Another user, and another trial, stay untouched.
    expect(await repo.getTrialProgress("u2", "trial-1-linear")).toBeNull()
    expect(await repo.getTrialProgress("u1", "trial-2-organization")).toBeNull()
  })

  it("getTrialProgress returns null for an unknown trial id", async () => {
    const repo = createInMemoryProgressRepository()
    await repo.saveTrialProgress(
      "u1",
      "trial-1-linear",
      emptySave("trial-1-linear", "mission-a", "a1"),
    )
    expect(await repo.getTrialProgress("u1", "does-not-exist")).toBeNull()
  })

  it("listCompletedTrials returns only completed trial ids for that user", async () => {
    const repo = createInMemoryProgressRepository()
    expect(await repo.listCompletedTrials("u1")).toEqual([])

    await repo.saveTrialProgress("u1", "trial-1-linear", {
      ...emptySave("trial-1-linear", "mission-a", "a4"),
      completed: true,
    })
    await repo.saveTrialProgress("u1", "trial-2-organization", {
      ...emptySave("trial-2-organization", "mission-a", "b1"),
      completed: false,
    })
    // A different learner's completion must not leak into u1's list.
    await repo.saveTrialProgress("u2", "trial-1-linear", {
      ...emptySave("trial-1-linear", "mission-a", "a4"),
      completed: true,
    })

    expect(await repo.listCompletedTrials("u1")).toEqual(["trial-1-linear"])
  })
})
