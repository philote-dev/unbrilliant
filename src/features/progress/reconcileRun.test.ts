import { describe, it, expect } from "vitest"

import { createInMemoryProgressRepository } from "@/features/progress/inMemoryProgressRepository"
import { reconcileRun } from "@/features/progress/reconcileRun"
import {
  createLesson,
  currentPart,
  reconcile,
  resumeLesson,
} from "@/features/lesson/engine"

/**
 * Wiring tests for the sign-in orchestration, exercised THROUGH the
 * ProgressRepository interface with the in-memory fake (no React, no Firebase).
 * The pure decision lives in `reconcile` (engine.test.ts); this asserts the
 * orchestration performs the right I/O against the injected adapter.
 */
const SEED = 42
const UID = "u1"
const LESSON = "stacks-and-queues"
const IDS = { uid: UID, displayName: "Tester", lessonId: LESSON }

describe("reconcileRun (sign-in orchestration)", () => {
  it("noop: brand-new account with a fresh run writes nothing", async () => {
    const repo = createInMemoryProgressRepository()
    const plan = await reconcileRun(repo, IDS, () => createLesson(SEED), reconcile)
    expect(plan).toEqual({ kind: "noop" })
    expect(await repo.getProgress(UID, LESSON)).toBeNull()
  })

  it("carry-up: brand-new account with an in-flight run writes the run up", async () => {
    const repo = createInMemoryProgressRepository()
    // resumeLesson is a convenient constructor for a run with known progress.
    const local = resumeLesson(
      { counters: { pops: 2, dequeues: 0, scenarios: 0 }, currentPart: "stack-pop" },
      SEED,
    )
    const plan = await reconcileRun(repo, IDS, () => local, reconcile)
    expect(plan.kind).toBe("carry-up")
    expect(await repo.getProgress(UID, LESSON)).toEqual({
      counters: { pops: 2, dequeues: 0, scenarios: 0, attempts: 0 },
      currentPart: "stack-pop",
      completed: false,
    })
  })

  it("resume: returning account loads server progress and does not overwrite it", async () => {
    const repo = createInMemoryProgressRepository()
    const server = {
      counters: { pops: 3, dequeues: 1, scenarios: 0 },
      currentPart: "queue-dequeue" as const,
      completed: false,
    }
    await repo.saveProgress(UID, LESSON, server)
    const plan = await reconcileRun(repo, IDS, () => createLesson(SEED), reconcile)
    expect(plan.kind).toBe("resume")
    if (plan.kind === "resume") {
      expect(currentPart(plan.state)).toBe("queue-dequeue")
      expect(plan.state.popsCorrect).toBe(3)
    }
    expect(await repo.getProgress(UID, LESSON)).toEqual(server) // untouched
  })

  it("carry-up is skipped when the pass is cancelled (StrictMode-safe)", async () => {
    const repo = createInMemoryProgressRepository()
    const local = resumeLesson(
      { counters: { pops: 1, dequeues: 0, scenarios: 0 }, currentPart: "stack-pop" },
      SEED,
    )
    const plan = await reconcileRun(repo, IDS, () => local, reconcile, () => true)
    expect(plan.kind).toBe("carry-up") // decision unchanged
    expect(await repo.getProgress(UID, LESSON)).toBeNull() // but nothing written
  })
})
