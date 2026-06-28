import { describe, expect, it } from "vitest"

import { INTRO_CHECKS } from "./introEngine"

describe("intro engine checks", () => {
  it("keeps job answer cards to names, not action definitions", () => {
    for (const check of INTRO_CHECKS.filter((check) => check.id !== "why")) {
      expect(check.options.map((option) => option.label)).toEqual([
        "Store",
        "Sort",
        "Categorize",
      ])
    }
  })
})
