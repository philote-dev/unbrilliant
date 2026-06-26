import { readFileSync } from "node:fs"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { collection, doc, getDocs, setDoc, type Firestore } from "firebase/firestore"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { saveExplanation } from "@/features/poly/explanationStore"

const PROJECT_ID = "demo-willow"
let testEnv: RulesTestEnvironment

function dbFor(uid: string): Firestore {
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
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

describe("explanation storage (emulator)", () => {
  it("lets a learner store and read back their own explanation", async () => {
    const db = dbFor("alice")
    await assertSucceeds(
      saveExplanation(db, "alice", { conceptId: "stacks", explanation: "last in first out" }),
    )
    const snap = await getDocs(collection(db, "users", "alice", "checkpointExplanations"))
    expect(snap.size).toBe(1)
    expect(snap.docs[0].data().explanation).toBe("last in first out")
  })

  it("denies storing under another learner's id", async () => {
    const db = dbFor("mallory")
    await assertFails(
      saveExplanation(db, "alice", { conceptId: "stacks", explanation: "x" }),
    )
  })

  it("rejects an explanation write with an unexpected field", async () => {
    const db = dbFor("alice")
    await assertFails(
      setDoc(doc(db, "users", "alice", "checkpointExplanations", "x"), {
        conceptId: "stacks",
        explanation: "x",
        createdAt: new Date(),
        hacked: true,
      }),
    )
  })
})
