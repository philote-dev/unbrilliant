import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

/**
 * Two test projects sharing one config:
 *  - "node": fast, deterministic pure-logic tests (`*.test.ts`) — the lesson
 *    engines and the rewire surface's pure core. No browser, no Firebase.
 *  - "dom": component tests (`*.test.tsx`) under jsdom + Testing Library, used
 *    sparingly for interaction seams (e.g. the rewire surface's snap-back +
 *    keyboard/drag intent parity) that a pure function can't express.
 *
 * Emulator integration tests live in *.emulator.test.ts (vitest.emulator.config.ts);
 * end-to-end flows live in e2e/ (Playwright). Both stay out of these projects.
 */

const alias = { "@": path.resolve(__dirname, "./src") }

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/*.emulator.test.ts", "e2e/**"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
})
