import { describe, it, expect } from "vitest"

import {
  REVIEW_THRESHOLD,
  lessonRetention,
  needsReview,
  retentionBand,
  currentMastery,
  type ConceptStrength,
} from "./retention"

const c = (retrievable: boolean, strength: number | null): ConceptStrength => ({
  retrievable,
  strength,
})

describe("lessonRetention (weakest link / min)", () => {
  it("returns the minimum strength across load-bearing concepts", () => {
    expect(lessonRetention([c(true, 0.3), c(true, 0.62), c(true, 0.48)])).toBeCloseTo(0.3)
  })
  it("ignores non-load-bearing concepts", () => {
    expect(lessonRetention([c(false, 0.05), c(true, 0.7)])).toBeCloseTo(0.7)
  })
  it("treats a load-bearing concept with no review as freshly earned (1)", () => {
    expect(lessonRetention([c(true, null), c(true, 0.9)])).toBeCloseTo(0.9)
  })
  it("returns null when there are no load-bearing concepts", () => {
    expect(lessonRetention([c(false, 0.2)])).toBeNull()
    expect(lessonRetention([])).toBeNull()
  })
})

describe("needsReview", () => {
  it("is true strictly below the threshold", () => {
    expect(needsReview(REVIEW_THRESHOLD - 0.01)).toBe(true)
  })
  it("is false at/above the threshold and for null", () => {
    expect(needsReview(REVIEW_THRESHOLD)).toBe(false)
    expect(needsReview(0.9)).toBe(false)
    expect(needsReview(null)).toBe(false)
  })
})

describe("retentionBand", () => {
  it("maps a retention fraction to a band", () => {
    expect(retentionBand(0.95)).toBe("fresh")
    expect(retentionBand(0.6)).toBe("fading")
    expect(retentionBand(0.3)).toBe("rusty")
    expect(retentionBand(0.1)).toBe("lost")
  })
})

describe("currentMastery", () => {
  it("decays earned mastery by retention", () => {
    expect(currentMastery(1, 0.3)).toBeCloseTo(0.3)
    expect(currentMastery(0.8, 0.5)).toBeCloseTo(0.4)
  })
  it("returns earned mastery unchanged when retention is null", () => {
    expect(currentMastery(0.8, null)).toBeCloseTo(0.8)
  })
})
