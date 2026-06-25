/**
 * Pure geometry for the contiguous ArrayStrip: a row of cells that TOUCH (gap 0,
 * the load-bearing "contiguity" fact) over an address ruler rendered beneath.
 * No DOM, no React, every function deterministic, so the routing math is
 * unit-tested in node (jsdom zeroes getBoundingClientRect). The figure is a thin
 * shell that scales this intrinsic layout to fit its container.
 *
 * Two access overlays make the O(1)-vs-O(n) asymmetry visible:
 *  - `jumpArc(k)`: a single arc from ruler tick k up to cell k (one hop).
 *  - `scanPath(k)`: a step-by-step polyline through cell centers 0..k (a walk).
 * Plus the dynamic-array `capacitySlots` / `doubledLayout` for the grow figure.
 */

export interface Pt {
  x: number
  y: number
}
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Cells are squares that touch (no gap): contiguity is the visual fact. */
export const CELL = 46
export const GAP = 0
/** The address ruler sits beneath the row. */
export const RULER_GAP = 10
export const RULER_H = 22

/** Left→right contiguous cell box; cells share edges (x + CELL === next x). */
export function cellBox(i: number): Box {
  return { x: i * (CELL + GAP), y: 0, w: CELL, h: CELL }
}

export function cellX(i: number): number {
  return i * (CELL + GAP)
}

export function cellCenter(i: number): Pt {
  return { x: cellX(i) + CELL / 2, y: CELL / 2 }
}

/** The ruler tick for index i sits centered directly beneath cell i. */
export function rulerTickX(i: number): number {
  return cellX(i) + CELL / 2
}

/** Y of the ruler ticks (centerline of the ruler band). */
export const rulerY = CELL + RULER_GAP + RULER_H / 2

/** The intrinsic drawing surface for a row of n cells (+ the ruler band). */
export function stripExtent(n: number): { width: number; height: number } {
  return {
    width: Math.max(0, n) * (CELL + GAP) - (n > 0 ? GAP : 0),
    height: CELL + RULER_GAP + RULER_H,
  }
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/**
 * A single "jump" arc: from the address ruler tick at index k up and over into
 * the top of cell k. One hop, no walking: the O(1) random-access picture.
 */
export function jumpArc(k: number): { from: Pt; to: Pt; control: Pt; d: string } {
  const from: Pt = { x: rulerTickX(k), y: CELL + RULER_GAP }
  const to: Pt = { x: cellCenter(k).x, y: 0 }
  // bow up and to the side so it reads as one springing hop, not a straight line
  const control: Pt = { x: rulerTickX(k) + CELL * 0.85, y: -CELL * 0.45 }
  const d = `M ${r2(from.x)} ${r2(from.y)} Q ${r2(control.x)} ${r2(control.y)} ${r2(to.x)} ${r2(to.y)}`
  return { from, to, control, d }
}

/**
 * A step-by-step "scan": a polyline through the centers of cells 0..k, the
 * O(n) search picture (you walk every cell until the value matches).
 */
export function scanPath(toIndex: number): { points: Pt[]; d: string } {
  const points: Pt[] = []
  for (let i = 0; i <= toIndex; i++) points.push(cellCenter(i))
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${r2(p.x)} ${r2(p.y)}`)
    .join(" ")
  return { points, d }
}

/* ----------------------------- capacity frame ----------------------------- */

/** `capacity` contiguous slot boxes in a row (the backing block for A6). */
export function capacitySlots(capacity: number): Box[] {
  return Array.from({ length: Math.max(0, capacity) }, (_, i) => cellBox(i))
}

/**
 * The doubling layout: the old block, the new block twice as wide, and the
 * copy map (each old slot i copies straight across to new slot i).
 */
export function doubledLayout(capacity: number): {
  from: Box[]
  to: Box[]
  copyMap: { from: number; to: number }[]
} {
  return {
    from: capacitySlots(capacity),
    to: capacitySlots(capacity * 2),
    copyMap: Array.from({ length: Math.max(0, capacity) }, (_, i) => ({ from: i, to: i })),
  }
}
