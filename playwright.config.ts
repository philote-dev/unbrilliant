import { defineConfig, devices } from "@playwright/test"

/**
 * One happy-path E2E tracer (see docs/prd/mvp-proto.md "Testing Decisions"). Run
 * via `npm run e2e`, which wraps this in `firebase emulators:exec` so Auth +
 * Firestore emulators are up. Playwright runs its own Vite dev server on a
 * dedicated port (5273, via `npm run dev:e2e`) so it never collides with your
 * manual dev server on 5173.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  // One long chain now plays all seven lessons; warm runs finish in ~18s, but a
  // cold Vite server compiles on demand mid-chain — give generous headroom so the
  // first (cold) run can't trip the per-test budget.
  timeout: 240_000,
  use: {
    baseURL: "http://localhost:5273",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:e2e",
    url: "http://localhost:5273",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
