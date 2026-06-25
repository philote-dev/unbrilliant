import { defineConfig, devices } from "@playwright/test"

/**
 * One happy-path E2E tracer (see docs/prd/mvp-proto.md "Testing Decisions"). Run
 * via `npm run e2e`, which wraps this in `firebase emulators:exec` so Auth +
 * Firestore emulators are up. Playwright runs its OWN Vite dev server on a
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
  // cold Vite server compiles on demand mid-chain; give generous headroom so the
  // first (cold) run can't trip the per-test budget.
  timeout: 240_000,
  use: {
    baseURL: "http://localhost:5273",
    trace: "on-first-retry",
  },
  projects: [
    // The original happy-path tracer is pinned to a sub-`lg` viewport so it keeps
    // exercising the (unchanged) mobile layout, immune to the desktop shell.
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 500, height: 900 } },
      testMatch: /(?:tracer|splash)\.spec\.ts/,
    },
    // The desktop layout (sidebar shell, split/centered lessons, palette) is
    // covered by its own smoke at a wide viewport.
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      testMatch: /desktop-.*\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev:e2e",
    url: "http://localhost:5273",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
