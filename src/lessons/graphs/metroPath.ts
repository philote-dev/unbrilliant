import { edgeKey, type Adjacency, type NodeId, type Pt } from "@/features/lesson/graphsEngine"
import type { TransitLine } from "./transitData"

/**
 * Pure geometry for the subway skin: turn station coordinates into real
 * metro-diagram lines. Two ideas:
 *
 *  1. **Octolinear routing.** Every segment runs at 0, 45, or 90 degrees (the
 *     classic transit-map constraint). When two stations don't already line up
 *     on one of those angles, the segment gets ONE bend: a straight run then a
 *     45 degree diagonal into the destination.
 *  2. **Rounded corners.** Lines are drawn per ROUTE (not per edge) so a line
 *     that turns at a station sweeps through it with a rounded corner, exactly
 *     like a published metro map.
 *
 * Everything here is presentational. The adjacency (the route list) is still the
 * only data; these helpers just decide how to *draw* it. No DOM, no React.
 */

const EPS = 0.5

/** Distance between two points. */
const dist = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y)
const approxEq = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

/**
 * The single bend point for one segment a -> b. Octolinear: a straight run along
 * the dominant axis, then ONE clean 45 degree diagonal into b (so an edge is at
 * most two clear segments - a straight and a diagonal - never a squiggle). Pairs
 * already on a 0/45/90 line stay a single straight segment (the bend is colinear).
 * Non-octolinear routing returns the midpoint (colinear), a plain straight line.
 * Always returning one point keeps the command structure identical, so a
 * geographic -> diagram morph can still tween the `d` string smoothly.
 */
export function edgeBend(a: Pt, b: Pt, octolinear: boolean): Pt {
  if (!octolinear) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (adx >= ady) return { x: a.x + Math.sign(dx) * (adx - ady), y: a.y }
  return { x: a.x, y: a.y + Math.sign(dy) * (ady - adx) }
}

/** Expand stations into [s0, bend, s1, bend, s2, ...] so every segment carries its
 *  single bend (a straight run + one 45 diagonal). `closed` wraps back to the
 *  first station. Constant point count = tweenable on morph. */
export function octolinearPoints(stations: Pt[], octolinear: boolean, closed: boolean): Pt[] {
  const n = stations.length
  if (n < 2) return stations.slice()
  const out: Pt[] = [stations[0]]
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const a = stations[i]
    const b = stations[(i + 1) % n]
    out.push(edgeBend(a, b, octolinear), b)
  }
  return out
}

/**
 * An SVG path through `points` with rounded corners of radius `r` at every
 * interior vertex (stations the line turns at, and mid-segment bends). `closed`
 * rounds the wrap-around corner too and appends Z. A corner's radius is clamped
 * to half its shorter neighbor so short segments never overshoot.
 */
export function roundedPath(points: Pt[], r: number, closed = false): string {
  const pts = closed && points.length > 1 && approxEq(points[0], points[points.length - 1])
    ? points.slice(0, -1)
    : points
  const n = pts.length
  if (n < 2) return ""
  if (n === 2 && !closed) return `M ${f(pts[0].x)} ${f(pts[0].y)} L ${f(pts[1].x)} ${f(pts[1].y)}`

  const corner = (prev: Pt, c: Pt, next: Pt): string => {
    const d1 = dist(prev, c) || 1e-6
    const d2 = dist(next, c) || 1e-6
    const rad = Math.min(r, d1 / 2, d2 / 2)
    const inx = c.x + ((prev.x - c.x) / d1) * rad
    const iny = c.y + ((prev.y - c.y) / d1) * rad
    const outx = c.x + ((next.x - c.x) / d2) * rad
    const outy = c.y + ((next.y - c.y) / d2) * rad
    return `L ${f(inx)} ${f(iny)} Q ${f(c.x)} ${f(c.y)} ${f(outx)} ${f(outy)} `
  }

  if (closed) {
    let d = `M ${f((pts[0].x + pts[1].x) / 2)} ${f((pts[0].y + pts[1].y) / 2)} `
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n]
      const c = pts[i]
      const next = pts[(i + 1) % n]
      d += corner(prev, c, next)
    }
    return d + "Z"
  }

  let d = `M ${f(pts[0].x)} ${f(pts[0].y)} `
  for (let i = 1; i < n - 1; i++) d += corner(pts[i - 1], pts[i], pts[i + 1])
  d += `L ${f(pts[n - 1].x)} ${f(pts[n - 1].y)}`
  return d
}

const f = (n: number): number => Math.round(n * 100) / 100

/** One drawable run of a route: a maximal stretch of present, consecutive
 *  segments. `closed` marks a complete loop line. */
export interface LineRun {
  key: string
  color: string
  points: Pt[]
  closed: boolean
}

/**
 * Break each route into the runs that should actually be drawn for `adj`: a
 * maximal sequence of consecutive stations whose connecting segment exists in the
 * adjacency (skipping `excludeKey`, e.g. the just-drawn edge rendered separately).
 * A loop whose every segment is present becomes a single closed run. Each run is
 * expanded to octolinear points so it can be drawn as one rounded polyline.
 */
export function lineRuns(
  lines: TransitLine[],
  adj: Adjacency,
  layout: Record<NodeId, Pt>,
  octolinear: boolean,
  excludeKey?: string | null,
): LineRun[] {
  const present = new Set<string>()
  for (const u of Object.keys(adj)) for (const v of adj[u]) present.add(edgeKey(u, v))
  const at = (id: NodeId): Pt => layout[id] ?? { x: 0, y: 0 }
  const has = (u: NodeId, v: NodeId): boolean =>
    present.has(edgeKey(u, v)) && edgeKey(u, v) !== excludeKey

  const runs: LineRun[] = []
  for (const line of lines) {
    const path = line.path
    const loop = path.length > 2 && path[0] === path[path.length - 1]
    const segOk: boolean[] = []
    for (let i = 0; i < path.length - 1; i++) segOk.push(has(path[i], path[i + 1]))

    if (loop && segOk.every(Boolean)) {
      const stations = path.slice(0, -1).map(at)
      runs.push({
        key: line.id,
        color: line.color,
        points: octolinearPoints(stations, octolinear, true),
        closed: true,
      })
      continue
    }

    let cur: NodeId[] = []
    let runIdx = 0
    const flush = () => {
      if (cur.length >= 2) {
        runs.push({
          key: `${line.id}-${runIdx++}`,
          color: line.color,
          points: octolinearPoints(cur.map(at), octolinear, false),
          closed: false,
        })
      }
      cur = []
    }
    for (let i = 0; i < path.length - 1; i++) {
      if (segOk[i]) {
        if (cur.length === 0) cur.push(path[i])
        cur.push(path[i + 1])
      } else {
        flush()
      }
    }
    flush()
  }
  return runs
}
