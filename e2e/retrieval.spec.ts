import { readFileSync } from "node:fs"

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { doc, setDoc, type Firestore } from "firebase/firestore"
import { expect, test, type Page } from "@playwright/test"

/**
 * The spaced-repetition retrieval tracer: a signed-in learner who finished
 * Stacks & Queues and has a *due* concept gets a short warm-up drill BEFORE the
 * next lesson. They answer it, proceed into the lesson, and (in-session) do not
 * see the drill again when they leave and re-enter the lesson.
 *
 * Seeding mirrors how the app persists (see firestoreProgressRepository): the
 * Auth-emulator account is created so the UI can sign in with a real password,
 * and its signed-in-only Firestore docs are written through the same
 * authenticated-owner path the emulator integration tests use.
 */
const PROJECT_ID = "demo-willow"
const EMAIL = `retrieval_${Date.now()}@willow.test`
const PASSWORD = "willow-test-pass"
const NAME = "Retrieval Learner"

const WARMUP = "Quick warm-up from Stacks & Queues"

/**
 * Create an Auth-emulator account and return its uid. This hits the same REST
 * endpoint the Firebase JS SDK targets when pointed at the emulator; the api key
 * is not validated by the emulator, only the project's auth config.
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
 * Seed the docs LessonHost reads to gate the warm-up: a *completed* Stacks &
 * Queues, the user's current course, and a classify ConceptReview whose dueAt is
 * far in the past (due now). Written as the authenticated owner (rules allow it),
 * exactly like the FirestoreProgressRepository emulator tests.
 */
async function seedDueConcept(uid: string): Promise<void> {
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
    await setDoc(doc(db, "users", uid, "lessonProgress", "stacks-and-queues"), {
      counters: { classify: 1 },
      currentPart: "compare",
      completed: true,
    })
    await setDoc(
      doc(db, "users", uid, "conceptReviews", "stacks-and-queues:classify"),
      {
        level: 0,
        correctStreak: 0,
        lapses: 0,
        seen: 1,
        lastSeenAt: 0,
        dueAt: 1,
        graduated: false,
      },
    )
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
  await nav.getByRole("button", { name: "Profile", exact: true }).click()
  await page.getByRole("button", { name: "Sign in to save your progress" }).click()
  await page.getByPlaceholder("Email address").fill(EMAIL)
  await page.getByPlaceholder("Password").fill(PASSWORD)
  await page.getByPlaceholder("Display name").fill(NAME)
  await page.getByRole("button", { name: "Create account" }).click()
}

/** From the dashboard, open the next lesson (Arrays, once S&Q is complete). */
async function openNextLesson(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Continue learning" }).click()
}

/**
 * Answer the 3-option classify warm-up to a terminal verdict without knowing the
 * seeded answer: one option + Check is either correct (terminal) or a
 * non-terminal nudge; a second, different option + Check is always terminal
 * (the shared 2-wrong feedback machine).
 *
 * A single-item warm-up has no concept left due once a terminal verdict records
 * the review, so LessonHost re-selects to nothing and drops the learner straight
 * into the lesson (the verdict's "Continue to ..." button is transient). The
 * helper therefore drives to a terminal verdict and confirms the lesson chrome,
 * which only renders once the drill has yielded.
 */
async function answerWarmup(page: Page): Promise<void> {
  const stack = page.getByRole("button", { name: "Stack (last in, first out)" })
  const queue = page.getByRole("button", { name: "Queue (first in, first out)" })
  const check = page.getByRole("button", { name: "Check" })
  const nudge = page.getByText("Not quite. Take another look and try again.")
  const inLesson = page.getByRole("button", { name: "Close lesson" })

  await stack.click()
  await check.click()
  // Settle the verdict: a wrong first pick nudges a retry; otherwise the answer
  // is recorded and the warm-up advances into the lesson.
  await expect(nudge.or(inLesson)).toBeVisible()
  if (await nudge.isVisible()) {
    await queue.click()
    await check.click()
  }
  await expect(inLesson).toBeVisible()
}

test("a due concept warms up before the next lesson, once per session", async ({
  page,
}) => {
  const uid = await createEmulatorUser(EMAIL, PASSWORD)
  await seedDueConcept(uid)

  await page.goto("/")
  await signIn(page)

  // Into the next lesson: the warm-up gates ahead of Arrays.
  await page.getByRole("navigation").getByRole("button", { name: "Home", exact: true }).click()
  await openNextLesson(page)
  await expect(page.getByText(WARMUP)).toBeVisible()

  // Answer it; the warm-up yields and the lesson itself (with its close control)
  // is showing, the warm-up gone.
  await answerWarmup(page)
  await expect(page.getByRole("button", { name: "Close lesson" })).toBeVisible()
  await expect(page.getByText(WARMUP)).toHaveCount(0)

  // Leave the lesson and re-enter it (in-app navigation, no reload): the warm-up
  // does not reappear for the rest of the session.
  await page.getByRole("button", { name: "Close lesson" }).click()
  await openNextLesson(page)
  await expect(page.getByRole("button", { name: "Close lesson" })).toBeVisible()
  await expect(page.getByText(WARMUP)).toHaveCount(0)
})
