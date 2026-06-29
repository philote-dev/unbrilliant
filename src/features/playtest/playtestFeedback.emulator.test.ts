import { readFileSync } from "node:fs"

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore"
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest"

const PROJECT_ID = "demo-willow"
let testEnv: RulesTestEnvironment

function publicDb(): Firestore {
  return testEnv.unauthenticatedContext().firestore() as unknown as Firestore
}

function validFeedback() {
  return {
    lessonId: "graphs",
    notes: "The map labels overlapped on my phone.",
    path: "/playtest?lesson=graphs",
    userAgent: "Vitest",
    source: "playtest",
    createdAt: serverTimestamp(),
  }
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

describe("playtest feedback rules", () => {
  it("lets a device create feedback without allowing public reads", async () => {
    const db = publicDb()

    await assertSucceeds(addDoc(collection(db, "playtestFeedback"), validFeedback()))
    await assertFails(getDocs(collection(db, "playtestFeedback")))
  })

  it("rejects updates and deletes after feedback is created", async () => {
    const db = publicDb()
    const created = await addDoc(collection(db, "playtestFeedback"), validFeedback())

    await assertFails(updateDoc(doc(db, "playtestFeedback", created.id), { notes: "edited" }))
    await assertFails(deleteDoc(doc(db, "playtestFeedback", created.id)))
  })

  it("rejects malformed or oversized feedback", async () => {
    const db = publicDb()
    const feedback = collection(db, "playtestFeedback")

    await assertFails(addDoc(feedback, { ...validFeedback(), lessonId: "bogus" }))
    await assertFails(addDoc(feedback, { ...validFeedback(), notes: "x".repeat(3001) }))
    await assertFails(addDoc(feedback, { ...validFeedback(), hacked: true }))
  })
})
