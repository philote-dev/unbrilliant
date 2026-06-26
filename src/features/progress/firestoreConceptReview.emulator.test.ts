import { readFileSync } from "node:fs"

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import type { Firestore } from "firebase/firestore"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import { newReview } from "@/features/progress/conceptReview"

/**
 * ConceptReview persistence-seam integration tests against the Firestore
 * emulator, exercised THROUGH the ProgressRepository interface as the app uses
 * it. Run via `npm run test:emulator` (wraps these in emulators:exec).
 */
const PROJECT_ID = "demo-willow"

let testEnv: RulesTestEnvironment

function repoFor(uid: string) {
  const db = testEnv
    .authenticatedContext(uid)
    .firestore() as unknown as Firestore
  return createFirestoreProgressRepository(db)
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      // RULES_PATH / FIRESTORE_EMULATOR_PORT let this run against an isolated
      // emulator (CI or a dev box already running one on the default ports).
      rules: readFileSync(process.env.RULES_PATH ?? "firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_PORT) || 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe("FirestoreProgressRepository concept reviews (emulator)", () => {
  it("round-trips a concept review for its owner", async () => {
    const repo = repoFor("alice")
    await repo.saveConceptReview("alice", newReview("trees:locate", 1_000))
    await repo.saveConceptReview("alice", {
      ...newReview("trees:locate", 2_000),
      level: 3,
    })
    const rows = await repo.getConceptReviews("alice")
    expect(rows).toHaveLength(1)
    expect(rows[0].conceptId).toBe("trees:locate")
    expect(rows[0].level).toBe(3)
  })

  it("denies reading another learner's concept reviews", async () => {
    await repoFor("alice").saveConceptReview(
      "alice",
      newReview("trees:locate", 1_000),
    )
    const mallory = repoFor("mallory")
    await assertFails(mallory.getConceptReviews("alice"))
  })
})
