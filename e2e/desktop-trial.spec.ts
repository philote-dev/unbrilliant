import { readFileSync } from "node:fs"

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { doc, setDoc, type Firestore } from "firebase/firestore"
import { expect, test, type Page } from "@playwright/test"

/**
 * The Trial feature end to end (desktop project, 1280px). A signed-in learner who
 * has finished the linear unit (intro -> linked-lists) finds the additive "Trial"
 * node on the course path, opens it, and clears Mission A ("The Line Breaks",
 * segments A1-A4) with an all-viable run, landing on the completion retrospective.
 *
 * Seeding mirrors retrieval.spec.ts: an Auth-emulator account so the UI can sign
 * in with a real password, and its signed-in-only Firestore docs written through
 * the authenticated-owner path the emulator integration tests use. We seed only
 * completed lessonProgress (no trialProgress) so the Trial is "available", never
 * "completed", and the run starts fresh.
 */
const PROJECT_ID = "demo-willow"
const EMAIL = `trial_${Date.now()}@willow.test`
const PASSWORD = "willow-test-pass"
const NAME = "Trial Learner"

/** The four lessons that make up the linear unit the Trial caps. */
const LINEAR_UNIT = ["intro", "stacks-and-queues", "arrays", "linked-lists"]

/**
 * Create an Auth-emulator account and return its uid. Hits the same REST endpoint
 * the Firebase JS SDK targets when pointed at the emulator; the api key is not
 * validated by the emulator, only the project's auth config.
 */
async function createEmulatorUser(email: string, password: string): Promise<string> {
  const res = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  if (!res.ok) {
    throw new Error(`Auth emulator signUp failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { localId: string }
  return data.localId
}

/**
 * Seed the docs the course path reads to surface (and unlock) the Trial: the
 * user's current course, plus a *completed* lessonProgress for every lesson in
 * the linear unit. Written as the authenticated owner, exactly the shape the
 * rules require: lessonProgress needs `updatedAt is timestamp` and the bounded
 * key set, so each is `{ counters, currentPart, completed, updatedAt }`. No
 * trialProgress is written, so the Trial starts fresh ("available", not "done").
 */
async function seedCompletedLinearUnit(uid: string): Promise<void> {
  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  })
  try {
    const db = testEnv.authenticatedContext(uid).firestore() as unknown as Firestore
    await setDoc(doc(db, "users", uid), {
      displayName: NAME,
      currentCourseId: "data-structures",
    })
    for (const lessonId of LINEAR_UNIT) {
      await setDoc(doc(db, "users", uid, "lessonProgress", lessonId), {
        counters: {},
        currentPart: "done",
        completed: true,
        updatedAt: new Date(),
      })
    }
  } finally {
    // cleanup() releases the test contexts without touching emulator data.
    await testEnv.cleanup()
  }
}

/** Sign in the pre-created learner through the real UI (the form signs up, then
 * falls back to sign-in for an existing email). */
async function signIn(page: Page): Promise<void> {
  const splash = page.getByTestId("willow-splash")
  if (await splash.isVisible().catch(() => false)) await splash.click().catch(() => {})

  const nav = page.getByRole("navigation")
  await nav.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("button", { name: "Sign in to save your progress" }).click()
  await page.getByPlaceholder("Email address").fill(EMAIL)
  await page.getByPlaceholder("Password").fill(PASSWORD)
  await page.getByPlaceholder("Display name").fill(NAME)
  await page.getByRole("button", { name: "Create account" }).click()
}

/**
 * From the dashboard, open the Trial on the course path. The desktop Home renders
 * the path preview (currentCourseId is seeded, so it's the dashboard, not the
 * vision hero); the additive Trial node is a button whose accessible name is
 * exactly "Trial" (a locked node reads "Trial (locked)"), so the exact-name
 * locator resolves only once progress loads and the unit-complete gate unlocks it.
 */
async function openTrialFromPath(page: Page): Promise<void> {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Trial", exact: true }).click({
    timeout: 30_000,
  })
  await expect(page.getByRole("button", { name: "Begin the Trial" })).toBeVisible()
}

/** Choose a structure card. The card's accessible name starts with the label
 * (e.g. "Queue ..."), so a `^label\b` regex matches it unambiguously. */
async function chooseStructure(page: Page, label: RegExp): Promise<void> {
  await page.getByRole("button", { name: label }).click()
}

/**
 * Tap-to-place one operation: arm the chip (by its exact label), then tap the
 * labelled zone. The zone overlay button ("Place at front" / "back" / "middle" /
 * "top") only renders for zones the armed operation permits, so it appears once
 * the chip is armed.
 */
async function placeOp(page: Page, chip: string, zone: string): Promise<void> {
  await page.getByRole("button", { name: chip, exact: true }).click()
  await page.getByRole("button", { name: `Place at ${zone}` }).click()
}

/** Run the stress test and wait for the all-clear verdict (animation plays). */
async function runStress(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Run the stress test" }).click()
  await expect(page.getByText(/Your design holds up/)).toBeVisible({
    timeout: 15_000,
  })
}

/** Click the verdict's Continue to advance to the next segment / completion. */
async function continueTrial(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Continue", exact: true }).click()
}

test("a learner opens the Trial from the path and finishes Mission A", async ({
  page,
}) => {
  const uid = await createEmulatorUser(EMAIL, PASSWORD)
  await seedCompletedLinearUnit(uid)

  await page.goto("/")
  await signIn(page)

  // Reach the path and step into the Trial through its immersive gate.
  await openTrialFromPath(page)
  await page.getByRole("button", { name: "Begin the Trial" }).click()

  // A1 - intake: a queue keeps the line fair (join the back, serve the front).
  await chooseStructure(page, /^Queue\b/)
  await placeOp(page, "a new student arrives", "back")
  await placeOp(page, "serve the next student", "front")
  await runStress(page)
  await continueTrial(page)

  // A2 - cancellation: a linked list also closes a middle gap cleanly.
  await chooseStructure(page, /^Linked list\b/)
  await placeOp(page, "a new student arrives", "back")
  await placeOp(page, "serve the next student", "front")
  await placeOp(page, "a middle student cancels", "middle")
  await runStress(page)
  await continueTrial(page)

  // A3 - undo: a stack reverses the most recent action off the top.
  await chooseStructure(page, /^Stack\b/)
  await placeOp(page, "record a desk action", "top")
  await placeOp(page, "undo the last action", "top")
  await runStress(page)
  await continueTrial(page)

  // A4 - final review: predict the front after the mixed script. The line ends
  // [B, D, E, F], so the true front is "B"; a correct call reads "Correct".
  await expect(page.getByText("Trace the program")).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole("button", { name: "B", exact: true }).click()
  await page.getByRole("button", { name: "Lock in prediction" }).click()
  await expect(page.getByText("You traced it correctly.")).toBeVisible({
    timeout: 15_000,
  })
  await continueTrial(page)

  // Completion: the retrospective crests the Trial and, on a clean all-viable
  // run, marks it a clean run.
  await expect(page.getByText("Trial conquered")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Clean run")).toBeVisible()
})
