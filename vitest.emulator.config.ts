import path from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Persistence-seam integration tests against the Firebase emulator (Auth +
 * Firestore). Run via `npm run test:emulator`, which wraps these in
 * `firebase emulators:exec` against a demo project (never production).
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.emulator.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
