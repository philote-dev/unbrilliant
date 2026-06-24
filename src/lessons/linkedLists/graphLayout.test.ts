import { describe, it, expect } from "vitest"

import {
  NODE_R,
  NODE_W,
  ROW_Y,
  arrowGeom,
  center,
  directArrow,
  elbowLane,
  isAdjacentRow,
  looseBox,
  radius,
  rowBoxes,
  type Pt,
} from "./graphLayout"

/**
 * Pure routing math for the NodeGraph. jsdom zeroes getBoundingClientRect, so the
 * geometry that anchors arrows on the circular rim (and keeps them off the nodes
 * in between) is proven here in node, not the figure.
 */

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Parse the first and last (x,y) coordinate pairs out of an SVG path `d`. */
function endpoints(d: string): { start: Pt; end: Pt } {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  return {
    start: { x: nums[0], y: nums[1] },
    end: { x: nums[nums.length - 2], y: nums[nums.length - 1] },
  }
}

describe("graphLayout — row placement", () => {
  it("lays nodes left→right on one row", () => {
    const boxes = rowBoxes(["A", "B", "C", "D"])
    const xs = ["A", "B", "C", "D"].map((id) => boxes.get(id)!.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b)) // strictly increasing
    expect(new Set(["A", "B", "C", "D"].map((id) => boxes.get(id)!.y)).size).toBe(1) // same row
  })

  it("knows row-adjacent vs non-adjacent vs off-row", () => {
    const boxes = rowBoxes(["A", "B", "C"])
    expect(isAdjacentRow(boxes.get("A")!, boxes.get("B")!)).toBe(true)
    expect(isAdjacentRow(boxes.get("A")!, boxes.get("C")!)).toBe(false)
    const loose = looseBox(center(boxes.get("B")!).x)
    expect(isAdjacentRow(boxes.get("A")!, loose)).toBe(false)
  })
})

describe("graphLayout — circular-edge anchoring & continuity", () => {
  it("anchors a straight arrow on both rims and stops the shaft behind the tip", () => {
    const boxes = rowBoxes(["A", "B"])
    const a = boxes.get("A")!
    const b = boxes.get("B")!
    const g = arrowGeom(a, b)

    expect(g.d).toContain(" L ")
    expect(g.d).not.toContain(" Q ")
    expect(g.angleDeg).toBe(0)
    expect(g.tip.x).toBeCloseTo(b.x) // lands on B's left rim
    expect(dist(g.tip, center(b))).toBeCloseTo(radius(b)) // tip sits on the rim

    const { start, end } = endpoints(g.d)
    expect(start.x).toBeCloseTo(a.x + NODE_W) // leaves A's right rim
    expect(dist(start, center(a))).toBeCloseTo(radius(a))
    // the shaft stops a few px short of the tip so the filled head reads continuous
    const gap = dist(end, g.tip)
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThan(NODE_R)
  })

  it("arcs ABOVE the row for non-adjacent same-row links (clears the nodes between)", () => {
    const boxes = rowBoxes(["A", "B", "C"])
    const g = arrowGeom(boxes.get("A")!, boxes.get("C")!)
    expect(g.d).toContain(" Q ")
    expect(g.mid.y).toBeLessThan(ROW_Y) // bows up above the row
    expect(dist(g.tip, center(boxes.get("C")!))).toBeCloseTo(radius(boxes.get("C")!))
  })

  it("arcs down into a loose node, landing on its upper rim", () => {
    const boxes = rowBoxes(["A", "B"])
    const loose = looseBox(center(boxes.get("B")!).x)
    const g = arrowGeom(boxes.get("A")!, loose)
    expect(g.d).toContain(" Q ")
    expect(dist(g.tip, center(loose))).toBeCloseTo(radius(loose)) // on the rim
    expect(g.tip.y).toBeLessThan(center(loose).y) // enters the top half
  })

  it("arcs up from a loose node, landing on the row node's lower rim", () => {
    const boxes = rowBoxes(["A", "B"])
    const loose = looseBox(center(boxes.get("A")!).x)
    const g = arrowGeom(loose, boxes.get("B")!)
    expect(g.d).toContain(" Q ")
    expect(dist(g.tip, center(boxes.get("B")!))).toBeCloseTo(radius(boxes.get("B")!))
    expect(g.tip.y).toBeGreaterThan(center(boxes.get("B")!).y) // enters from below
  })
})

describe("graphLayout — directArrow (freely placed nodes)", () => {
  it("anchors edge-to-edge along the center line, whatever the angle", () => {
    const from = { x: 20, y: 20, w: NODE_W, h: NODE_W }
    const to = { x: 200, y: 160, w: NODE_W, h: NODE_W }
    const g = directArrow(from, to)

    expect(g.d).toContain(" L ")
    expect(dist(g.tip, center(to))).toBeCloseTo(radius(to)) // tip on target rim
    const { start } = endpoints(g.d)
    expect(dist(start, center(from))).toBeCloseTo(radius(from)) // start on source rim

    // heading points from source toward target
    const expected = (Math.atan2(center(to).y - center(from).y, center(to).x - center(from).x) * 180) / Math.PI
    expect(g.angleDeg).toBeCloseTo(expected)
  })

  it("never produces NaN when two nodes overlap exactly", () => {
    const box = { x: 50, y: 50, w: NODE_W, h: NODE_W }
    const g = directArrow(box, { ...box })
    expect(Number.isNaN(g.tip.x)).toBe(false)
    expect(Number.isNaN(g.angleDeg)).toBe(false)
  })
})

describe("graphLayout: playlist elbow lanes", () => {
  it("gives each source row its own rail x + entry height (no stacked heads)", () => {
    const lanes = [0, 1, 2, 3].map((i) => elbowLane(300, i))
    const railXs = lanes.map((l) => l.railX)
    // Distinct rail per source so the vertical runs don't overlap…
    expect(new Set(railXs).size).toBe(railXs.length)
    // …and adjacent sources also enter the target at distinct heights, so two
    // pointers to the same track (prev→at and X→at) never stack their arrowheads.
    expect(lanes[0].entryDy).not.toBe(lanes[1].entryDy)
    expect(lanes[1].entryDy).not.toBe(lanes[2].entryDy)
  })

  it("is finite / non-NaN for every lane (and stable for odd inputs)", () => {
    for (const i of [0, 1, 5, 12, -3, 2.7]) {
      const { railX, entryDy } = elbowLane(300, i)
      expect(Number.isFinite(railX)).toBe(true)
      expect(Number.isFinite(entryDy)).toBe(true)
    }
  })
})
