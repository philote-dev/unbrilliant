import { expect, test, type Page } from "@playwright/test"

/**
 * Desktop (lg+) smoke. Runs only in the `desktop` Playwright project (1280px),
 * complementing the mobile tracer. It proves the desktop shell, sidebar nav, and
 * Cmd/Ctrl+K palette work, and that a full lesson is playable in the desktop
 * layout (centered, drag, and split beats), signed out.
 */

async function continueOn(page: Page) {
  const b = page.getByRole("button", { name: "Continue", exact: true })
  await b.waitFor({ state: "visible" })
  await b.click()
}

async function dismissNudge(page: Page) {
  const d = page.getByRole("button", { name: "Dismiss" })
  if (await d.isVisible().catch(() => false)) await d.click()
}

async function playDemo(page: Page, verb: RegExp) {
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: verb }).click()
  await continueOn(page)
}

async function answerCell(page: Page) {
  await page.locator('[data-answer="1"]').first().click()
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

async function buildConstruct(page: Page) {
  for (let step = 0; step < 3; step++) {
    const wraps = page.locator("[data-push-order]")
    const n = await wraps.count()
    let best = 0
    let bestOrder = Number.POSITIVE_INFINITY
    for (let i = 0; i < n; i++) {
      const o = Number(await wraps.nth(i).getAttribute("data-push-order"))
      if (o < bestOrder) {
        bestOrder = o
        best = i
      }
    }
    await wraps.nth(best).locator("[data-construct-card]").click()
  }
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page)
}

/** Move on from a completion screen. Signed out, the sign-in re-prompt recurs on
 * every completion, so dismiss it (if shown), then take the "Continue to X" CTA. */
async function nextLesson(page: Page, cta: RegExp) {
  const maybeLater = page.getByRole("button", { name: "Maybe later", exact: true })
  if (await maybeLater.isVisible().catch(() => false)) await maybeLater.click()
  await page.getByRole("button", { name: cta }).click()
}

/** Play the Introduction gate that now fronts Lesson 1: the animated welcome, two
 * reading pages, then four checks (three job MCQs and the faster-object pick).
 * Completing it unlocks Stacks & Queues. Mirrors the tracer's intro recipe. */
async function playIntro(page: Page) {
  await page.getByRole("button", { name: "Begin" }).click() // welcome hero
  await continueOn(page) // reading page 1
  await continueOn(page) // reading page 2
  await page.getByRole("button", { name: "Start the questions" }).click() // jobs page
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-testid="answer-card"][data-answer="1"]').first().click()
    await page.getByRole("button", { name: "Check" }).click()
    await continueOn(page)
  }
  await page.getByRole("button", { name: "Alphabetized" }).click() // faster-object pick
  await page.getByRole("button", { name: "Check" }).click()
  await continueOn(page) // commits the last check → completes the intro
}

/** S&Q shows a Poly "quick check" after each construct (cp-stacks / cp-queues). It
 * opens in voice mode, unavailable headless, so fall back to typing: reveal the
 * keyboard if needed, give any explanation, submit, and continue on the recap. */
async function polyCheckpoint(page: Page) {
  const box = page.getByPlaceholder("Type your explanation...")
  await box.waitFor({ state: "visible", timeout: 12_000 }).catch(async () => {
    await page.getByRole("button", { name: "Type instead" }).click()
    await box.waitFor({ state: "visible", timeout: 12_000 })
  })
  await box.fill("A stack is last in, first out; a queue is first in, first out.")
  await page.getByRole("button", { name: "Submit", exact: true }).click()
  await continueOn(page)
}

test("desktop shell: sidebar nav + command palette", async ({ page }) => {
  await page.goto("/")

  const nav = page.getByRole("navigation")
  for (const label of ["Home", "Learn", "Progress", "Settings"]) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible()
  }

  await nav.getByRole("button", { name: "Progress", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible()

  await nav.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()

  // Command palette: open, filter, close.
  await page.getByRole("button", { name: /Search/ }).click()
  const input = page.getByPlaceholder("Search lessons and courses...")
  await expect(input).toBeVisible()
  await input.fill("arr")
  await expect(page.getByText("Arrays").first()).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(input).toBeHidden()
})

test("desktop: a lesson plays end to end (centered, drag, split beats)", async ({
  page,
}) => {
  await page.goto("/")

  await page.getByRole("button", { name: "Choose a course" }).click()
  await page.getByRole("button", { name: /Data Structures/ }).click()
  await page.getByRole("button", { name: "Start", exact: true }).click()

  // The Introduction now gates Lesson 1: play it, then continue to Stacks & Queues.
  await playIntro(page)
  await nextLesson(page, /Continue to Stacks & Queues/)

  // Stack: demo -> teach -> predict (centered cell) -> real-world -> construct
  // (drag) -> Poly quick-check.
  await playDemo(page, /Push/)
  await continueOn(page)
  await answerCell(page)
  await dismissNudge(page)
  await answerCell(page)
  await buildConstruct(page)
  await polyCheckpoint(page)

  // Queue.
  await playDemo(page, /Enqueue/)
  await continueOn(page)
  await answerCell(page)
  await dismissNudge(page)
  await answerCell(page)
  await buildConstruct(page)
  await polyCheckpoint(page)

  // Compare gate (split beats): classify, contrast.
  await answerCell(page)
  await answerCell(page)

  await expect(page.getByText("You mastered Stacks & Queues.")).toBeVisible({
    timeout: 30_000,
  })

  // Signed out, the completion screen re-prompts to sign in (dismissible, and it
  // recurs on every completion until the learner signs in).
  const maybeLater = page.getByRole("button", { name: "Maybe later", exact: true })
  await expect(maybeLater).toBeVisible()
  await maybeLater.click()
  await expect(maybeLater).toBeHidden()

  // It then offers the next step. Signed out, in-memory progress overlays only the
  // active run, so "next" is recomputed without the earlier intro completion (the
  // mobile tracer signs in to prove the real Arrays unlock). Assert the continue
  // affordance is present, not a specific lesson.
  await expect(page.getByRole("button", { name: /^Continue to / })).toBeVisible()
})
