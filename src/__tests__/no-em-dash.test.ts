import { describe, expect, it } from "vitest"

/**
 * Regression guard: no em dash (U+2014) may appear in shipped source or docs.
 *
 * Rationale and scope (see the project no-em-dashes rule): em dashes are banned
 * project-wide; this test pins that for the files cleaned in "Scope B". File
 * contents are read via Vite's `import.meta.glob(..., { query: "?raw" })` rather
 * than the filesystem so the check is hermetic AND immune to a Dropbox
 * online-only hydration quirk that makes shell tools (e.g. `rg`) undercount.
 *
 * Excluded for now (cleaned in separate, coordinated passes, so this stays green):
 *  - test files (`*.test.*`) and this guard itself,
 *  - the deferred / in-flight files owned by a parallel agent (rewire infra,
 *    progress feature, auth/firebase libs, linked-lists lesson + engine, the
 *    shared FeedbackFooter).
 */

const EM_DASH = "\u2014"

const sources = import.meta.glob(
  [
    "/src/**/*.ts",
    "/src/**/*.tsx",
    "/src/**/*.css",
    "/docs/**/*.md",
    "/README.md",
    "/CONTEXT.md",
    "/index.html",
    "/gallery.html",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>

// Paths excluded from the assertion. Substring match against the glob key.
const EXCLUDED = [
  ".test.", // all test files (a separate fast-follow) + this guard
  "/src/components/willow/FeedbackFooter.tsx",
  "/src/components/rewire/",
  "/src/features/progress/",
  "/src/lib/auth.tsx",
  "/src/lib/firebase.ts",
  "/src/lessons/linkedLists/",
  "/src/features/lesson/linkedListsEngine.ts",
]

const scanned = Object.keys(sources)
  .filter((path) => !EXCLUDED.some((needle) => path.includes(needle)))
  .sort()

describe("no em dash (U+2014) in shipped source & docs", () => {
  it("actually found files to scan", () => {
    expect(scanned.length).toBeGreaterThan(50)
  })

  for (const path of scanned) {
    it(path, () => {
      expect(sources[path]).not.toContain(EM_DASH)
    })
  }
})
