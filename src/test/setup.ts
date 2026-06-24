import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

/**
 * Shared setup for the jsdom ("dom") test project: register jest-dom matchers
 * on Vitest's `expect`, and unmount React trees between tests. The repo uses
 * explicit `vitest` imports (no globals), so cleanup is wired manually here.
 */
afterEach(() => {
  cleanup()
})
