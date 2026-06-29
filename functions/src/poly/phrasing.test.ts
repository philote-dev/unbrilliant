import { describe, it, expect } from "vitest"
import { applyPhrasing } from "./phrasing"

describe("applyPhrasing", () => {
  it("returns the hint unchanged on the first attempt", () => {
    expect(applyPhrasing("Look at your first move.", { attemptIndex: 0 })).toBe(
      "Look at your first move.",
    )
  })
  it("adds a gentle lead-in on the second attempt", () => {
    expect(applyPhrasing("Look again.", { attemptIndex: 1 })).toBe("One more look: Look again.")
  })
  it("caps the lead-in variety for later attempts", () => {
    expect(applyPhrasing("Look again.", { attemptIndex: 9 })).toBe("Try this angle: Look again.")
  })
  it("treats a missing attemptIndex as the first attempt", () => {
    expect(applyPhrasing("Hi.", {})).toBe("Hi.")
  })
})
