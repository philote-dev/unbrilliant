import { describe, it, expect } from "vitest"

import {
  CELL,
  capacitySlots,
  cellBox,
  cellCenter,
  doubledLayout,
  jumpMarker,
  jumpPath,
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
  it("a jump marker lands on cell k, from a halo fixed-centered above the array", () => {
    const n = 6
    const m = jumpMarker(3, n)
    // the lookup lands on the top-center of cell 3
    expect(m.cell.x).toBe(cellCenter(3).x)
    expect(m.cell.y).toBe(0)
    // the halo is centered over the whole strip, off the top, and big enough to see
    expect(m.circle.x).toBe(stripExtent(n).width / 2)
    expect(m.circle.y).toBeLessThan(0)
    expect(m.circle.r).toBeGreaterThan(0)
  })

  it("the halo stays fixed while the line reaches further for the end cells", () => {
    const n = 6
    const first = jumpMarker(0, n)
    const mid = jumpMarker(3, n)
    const last = jumpMarker(n - 1, n)
    // halo position never moves with the selection
    expect(first.circle.x).toBe(last.circle.x)
    expect(first.circle.x).toBe(mid.circle.x)
    expect(first.circle.y).toBe(last.circle.y)
    // the end cells are the furthest horizontally from the centered halo
    const dx = (m: { cell: { x: number }; circle: { x: number } }) =>
      Math.abs(m.cell.x - m.circle.x)
    expect(dx(first)).toBeGreaterThan(dx(mid))
    expect(dx(last)).toBeGreaterThan(dx(mid))
  })

  it("jumpPath is an orthogonal route (down, across, down) with rounded corners", () => {
    const r = jumpPath(120, -76, 23, 0)
    // ordered waypoints are axis-aligned: down, then across, then down
    expect(r.points).toHaveLength(4)
    expect(r.points[0]).toEqual({ x: 120, y: -76 })
    expect(r.points[1].x).toBe(120) // P0 -> P1 is vertical (down a little)
    expect(r.points[2].y).toBe(r.points[1].y) // P1 -> P2 is horizontal (across)
    expect(r.points[2].x).toBe(23)
    expect(r.points[3]).toEqual({ x: 23, y: 0 }) // P2 -> P3 is vertical (into the cell)
    // two rounded right-angle turns, no diagonal
    expect((r.d.match(/Q/g) ?? []).length).toBe(2)
    expect(r.d.startsWith("M 120 -76")).toBe(true)
    expect(r.d.trimEnd().endsWith(" 0")).toBe(true)
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
