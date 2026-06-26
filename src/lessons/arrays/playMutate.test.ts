import { describe, it, expect } from "vitest"

import { applyDelete, applyInsert, freeLabel, type PlayCell } from "./playMutate"

const row = (labels: string[]): PlayCell[] => labels.map((label, id) => ({ id, label }))

describe("playMutate.applyInsert", () => {
  it("places the new cell at index k with the prior cells in their original order", () => {
    const { cells } = applyInsert(row(["A", "B", "C", "D"]), 2, { id: 99, label: "E" })
    expect(cells.map((c) => c.label)).toEqual(["A", "B", "E", "C", "D"])
  })

  it("marks only the cells at or after k as moving (cells before k never move)", () => {
    const { movingIds } = applyInsert(row(["A", "B", "C", "D"]), 2, { id: 99, label: "E" })
    expect([...movingIds].sort((a, b) => a - b)).toEqual([2, 3]) // C and D slide right
  })

  it("a front insert slides every existing cell", () => {
    const { cells, movingIds } = applyInsert(row(["A", "B", "C"]), 0, { id: 99, label: "Z" })
    expect(cells.map((c) => c.label)).toEqual(["Z", "A", "B", "C"])
    expect(movingIds.size).toBe(3)
  })

  it("an end insert slides nothing", () => {
    const { cells, movingIds } = applyInsert(row(["A", "B", "C"]), 3, { id: 99, label: "Z" })
    expect(cells.map((c) => c.label)).toEqual(["A", "B", "C", "Z"])
    expect(movingIds.size).toBe(0)
  })

  it("clamps an out-of-range index to the end of the row", () => {
    const { cells } = applyInsert(row(["A", "B"]), 9, { id: 99, label: "Z" })
    expect(cells.map((c) => c.label)).toEqual(["A", "B", "Z"])
  })

  it("does not mutate the input row", () => {
    const base = row(["A", "B"])
    applyInsert(base, 1, { id: 99, label: "Z" })
    expect(base.map((c) => c.label)).toEqual(["A", "B"])
  })
})

describe("playMutate.applyDelete", () => {
  it("removes index k and slides only the cells after it", () => {
    const { cells, movingIds } = applyDelete(row(["A", "B", "C", "D"]), 1)
    expect(cells.map((c) => c.label)).toEqual(["A", "C", "D"])
    expect([...movingIds].sort((a, b) => a - b)).toEqual([2, 3]) // C and D slide left
  })

  it("deleting the last cell slides nothing", () => {
    const { cells, movingIds } = applyDelete(row(["A", "B", "C"]), 2)
    expect(cells.map((c) => c.label)).toEqual(["A", "B"])
    expect(movingIds.size).toBe(0)
  })

  it("ignores an out-of-range index", () => {
    const { cells, movingIds } = applyDelete(row(["A", "B"]), 5)
    expect(cells.map((c) => c.label)).toEqual(["A", "B"])
    expect(movingIds.size).toBe(0)
  })
})

describe("playMutate.freeLabel", () => {
  it("returns the first pool label not already on the row", () => {
    expect(freeLabel(row(["A", "B", "D"]), ["A", "B", "C", "D"])).toBe("C")
  })

  it("returns null when every pool label is in use", () => {
    expect(freeLabel(row(["A", "B"]), ["A", "B"])).toBeNull()
  })
})
