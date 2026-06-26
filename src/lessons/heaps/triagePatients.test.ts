import { describe, it, expect } from "vitest"

import { patientFor, triageLevel } from "./triagePatients"

/**
 * The ER patient data is pure and deterministic: a heap of distinct keys becomes
 * a board of patients whose severity IS the key, so the "no duplicate priorities"
 * guarantee is inherited straight from the heap's distinct-key invariant.
 */

// The skin's curated board after a severity-100 admission (distinct keys).
const BOARD = [100, 95, 90, 80, 60, 50]

describe("triagePatients (deterministic ER data)", () => {
  it("carries each severity through as the distinct heap key", () => {
    for (const v of BOARD) expect(patientFor(v, BOARD).severity).toBe(v)
  })

  it("is deterministic: identical inputs yield an identical patient", () => {
    expect(patientFor(90, BOARD)).toEqual(patientFor(90, BOARD))
  })

  it("distinct severities yield distinct patients (no two share a priority)", () => {
    const severities = BOARD.map((v) => patientFor(v, BOARD).severity)
    expect(new Set(severities).size).toBe(BOARD.length)
    // and the curated board hands out distinct names, too.
    const names = BOARD.map((v) => patientFor(v, BOARD).name)
    expect(new Set(names).size).toBe(BOARD.length)
  })

  it("ranks urgency by the max-heap order (root = level 1, most urgent)", () => {
    const heap = [95, 90, 80, 60, 50]
    expect(triageLevel(95, heap)).toBe(1)
    expect(triageLevel(50, heap)).toBe(heap.length)
    expect(patientFor(95, heap).level).toBe(1)
    expect(patientFor(50, heap).level).toBe(5)
  })

  it("handles every curated heap with collision-free names", () => {
    const heaps = [
      [9, 7, 6, 3, 2],
      [10, 9, 5, 8, 7, 4, 3],
      [95, 80, 90, 60, 50],
      [90, 80, 70, 40, 30], // teach-extract ER board
    ]
    for (const heap of heaps) {
      const names = heap.map((v) => patientFor(v, heap).name)
      expect(new Set(names).size).toBe(heap.length)
    }
  })
})
