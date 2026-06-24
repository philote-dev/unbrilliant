import { defineConfig, devices } from "@playwright/test"

/**
 * One happy-path E2E tracer (see docs/prototype.md "Testing Decisions"). Run via
 * `npm run e2e`, which wraps this in `firebase emulators:exec` so Auth +
 * Firestore emulators are up; Playwright starts the Vite dev server itself.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 90_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
