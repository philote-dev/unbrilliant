import { describe, it, expect } from "vitest"

import { homeMode } from "./homeMode"

describe("homeMode (adaptive Home selector)", () => {
  it("is vision before a course is entered", () => {
    expect(homeMode({ currentCourseId: null })).toBe("vision")
  })

  it("is dashboard once a course is entered", () => {
    expect(homeMode({ currentCourseId: "data-structures" })).toBe("dashboard")
  })
})
