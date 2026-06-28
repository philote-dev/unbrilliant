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

  // Stack: demo -> teach -> predict (centered cell) -> real-world -> construct (drag).
  await playDemo(page, /Push/)
  await continueOn(page)
  await answerCell(page)
  await dismissNudge(page)
  await answerCell(page)
  await buildConstruct(page)

  // Queue.
  await playDemo(page, /Enqueue/)
  await continueOn(page)
  await answerCell(page)
  await dismissNudge(page)
  await answerCell(page)
  await buildConstruct(page)

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
  await expect(page.getByRole("button", { name: /Continue to Arrays/ })).toBeVisible()
})
