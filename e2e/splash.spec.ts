import { expect, test, type Page } from "@playwright/test"

/**
 * The splash assertion set. We never test the motion frame-by-frame: we assert
 * the load-in is present on a fresh session and that the landing takes over, that
 * a same-session reload skips the beat, and that reduced motion renders the
 * landing with no beat at all.
 */
const HEADING = "Build real intuition for algorithmic thinking."

async function expectLanding(page: Page) {
  await expect(page.getByRole("heading", { name: HEADING })).toBeVisible()
}

test("a fresh session plays the splash, then hands off to the landing", async ({
  page,
}) => {
  await page.goto("/")
  const splash = page.getByTestId("willow-splash")
  await expect(splash).toBeVisible()
  // Tap to skip straight to the landing (no timing-dependent assertions).
  await splash.click()
  await expectLanding(page)
  await expect(splash).toHaveCount(0)
})

test("within the same session, a reload skips the splash", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("willow-splash").click()
  await expectLanding(page)
  await page.reload()
  await expectLanding(page)
  await expect(page.getByTestId("willow-splash")).toHaveCount(0)
})

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("snaps to the landing with no splash beat", async ({ page }) => {
    await page.goto("/")
    await expectLanding(page)
    await expect(page.getByTestId("willow-splash")).toHaveCount(0)
  })
})
