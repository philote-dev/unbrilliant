import { describe, it, expect } from "vitest"

import {
  CELL,
  capacitySlots,
  cellBox,
  cellCenter,
  doubledLayout,
  jumpMarker,
  rulerTickX,
  scanPath,
  stripExtent,
} from "./arrayStripLayout"

describe("arrayStripLayout — contiguous cells over an address ruler", () => {
  it("cells touch (no gap): each cell's right edge is the next cell's left edge", () => {
    for (let i = 0; i < 5; i++) {
      const a = cellBox(i)
      const b = cellBox(i + 1)
      expect(a.x + a.w).toBe(b.x) // contiguity: shared edges, no gap
      expect(a.w).toBe(CELL)
    }
  })

  it("ruler ticks sit centered directly beneath each cell", () => {
    for (let i = 0; i < 5; i++) {
      expect(rulerTickX(i)).toBe(cellBox(i).x + CELL / 2)
      expect(rulerTickX(i)).toBe(cellCenter(i).x)
    }
  })

  it("strip width grows by exactly one cell per element", () => {
    expect(stripExtent(0).width).toBe(0)
    expect(stripExtent(4).width).toBe(4 * CELL)
    expect(stripExtent(5).width - stripExtent(4).width).toBe(CELL)
  })
})

describe("arrayStripLayout — access overlays (jump vs scan)", () => {
  it("a jump marker is a halo above the cell with a straight drop to its top", () => {
    const m = jumpMarker(3)
    // the lookup lands on the top-center of cell 3
    expect(m.cell.x).toBe(cellCenter(3).x)
    expect(m.cell.y).toBe(0)
    // the halo circle sits directly above that cell, off the top of the array
    expect(m.circle.x).toBe(cellCenter(3).x)
    expect(m.circle.y).toBeLessThan(0)
    expect(m.circle.r).toBeGreaterThan(0)
    // the connector is a single straight vertical segment (no arc), ending on the cell
    expect(m.d.startsWith("M")).toBe(true)
    expect(m.d).toContain("L")
    expect(m.d).not.toContain("Q")
    expect(m.d.trimEnd().endsWith("0")).toBe(true) // lands at y = 0 (cell top)
  })

  it("a scan walks every cell center from 0 up to k, in order", () => {
    const scan = scanPath(4)
    expect(scan.points).toHaveLength(5) // cells 0,1,2,3,4
    expect(scan.points.map((p) => p.x)).toEqual([0, 1, 2, 3, 4].map((i) => cellCenter(i).x))
    expect(scan.d.startsWith("M")).toBe(true)
    expect((scan.d.match(/L/g) ?? []).length).toBe(4) // 4 line segments after the move
  })
})

describe("arrayStripLayout — capacity frame (dynamic arrays)", () => {
  it("capacitySlots renders exactly `capacity` contiguous slots", () => {
    expect(capacitySlots(4)).toHaveLength(4)
    expect(capacitySlots(8)).toHaveLength(8)
  })

  it("doubling makes a 2x block and copies every old slot straight across", () => {
    const d = doubledLayout(4)
    expect(d.from).toHaveLength(4)
    expect(d.to).toHaveLength(8)
    expect(d.copyMap).toEqual([
      { from: 0, to: 0 },
      { from: 1, to: 1 },
      { from: 2, to: 2 },
      { from: 3, to: 3 },
    ])
  })
})
