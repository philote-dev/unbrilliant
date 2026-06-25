import { useId, useMemo, useRef, type CSSProperties } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { useRewireNode } from "@/components/rewire/useRewireNode"
import {
  edgeKey,
  edgeList,
  neighbors,
  type Adjacency,
  type Edge,
  type NodeId,
  type Pt,
} from "@/features/lesson/graphsEngine"
import { LiveEdgeStretch, useArmedCursor, useFitScale } from "./GraphCanvas"
import { METRO, TRANSIT_LINES, stationName, type TransitLine } from "./transitData"

/**
 * The subway skin: the SAME draw / display contract as GraphCanvas, dressed as a
 * real transit-map poster in the style of a clean metro diagram + a city "L" map.
 * Distinct route colors, white-circle / capsule transfer markers with thick ink
 * outlines, colored-filled termini, small regular stops, and a faint street grid.
 * None of it grades: the colors and the two layouts (geographic vs diagrammatic)
 * are decoration over the engine's adjacency; the route list is the data. Draw
 * stations carry the same DEV hooks as GraphCanvas's DrawNode, so the e2e tracer
 * drives the transit beat identically (data-graph-correct-target +
 * data-rewire-source/target via useRewireNode with sourceId = targetId = n).
 */

export const SUBWAY_W = 300
export const SUBWAY_H = 300

/** Intrinsic marker diameters per role (before the fit scale). */
const REG_D = 30
const TERM_D = 34
const INT_D = 42

export type SubwayVariant = "geographic" | "diagrammatic"
type Role = "interchange" | "terminus" | "regular"

export interface SubwayMapProps {
  mode: "display" | "draw"
  nodes: NodeId[]
  /** The adjacency whose segments are drawn (workingAdj on the draw beat). */
  adj: Adjacency
  layout: Record<NodeId, Pt>
  variant: SubwayVariant
  /** Routes (decoration): tints the segments + flags interchanges. */
  lines?: TransitLine[]
  /** Grow to fill the full-bleed scene + show the street-grid backdrop. */
  fill?: boolean
  /** Draw: the single drawn segment (draws on in its route color). */
  pendingEdge?: Edge | null
  /** Draw: the correct missing segment (DEV-only e2e hook on its source). */
  missingEdge?: Edge
  litEdges?: Edge[]
  terminal?: boolean
  reducedMotion?: boolean
}

function center(layout: Record<NodeId, Pt>, n: NodeId): Pt {
  return layout[n] ?? { x: SUBWAY_W / 2, y: SUBWAY_H / 2 }
}

/**
 * Marker footprint per role + mode. In DRAW mode every station is a >=44px tap
 * target (a11y); in DISPLAY mode regular stops shrink to ref-style dots (they are
 * not interactive, the route list carries the data). The interchange is a tall
 * rounded capsule, the metro "major transfer" marker.
 */
function markerSize(role: Role, scale: number, draw: boolean): { w: number; h: number } {
  if (role === "interchange") {
    const w = draw ? Math.max(44, INT_D * scale) : Math.max(20, INT_D * scale)
    return { w, h: w * 1.28 }
  }
  const base = role === "terminus" ? TERM_D : REG_D
  const floor = draw ? 44 : role === "terminus" ? 16 : 13
  const d = Math.max(floor, base * scale)
  return { w: d, h: d }
}

export function SubwayMap({
  mode,
  nodes,
  adj,
  layout,
  variant,
  lines = TRANSIT_LINES,
  fill,
  pendingEdge,
  missingEdge,
  litEdges,
  terminal,
  reducedMotion,
}: SubwayMapProps) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const draw = mode === "draw"
  const clipId = useId()

  const { outerRef, scale } = useFitScale(SUBWAY_W, fill ? 1.3 : 1)
  const innerRef = useRef<HTMLDivElement>(null)
  const { armedSource, cursor } = useArmedCursor(innerRef, scale)

  // Per-segment tint + interchange set, derived from the routes (decoration only).
  const { edgeColor, interchanges } = useMemo(() => {
    const edgeColor = new Map<string, string>()
    const onLines = new Map<NodeId, number>()
    for (const line of lines) {
      for (const id of new Set(line.path)) onLines.set(id, (onLines.get(id) ?? 0) + 1)
      for (let i = 0; i < line.path.length - 1; i++) {
        edgeColor.set(edgeKey(line.path[i], line.path[i + 1]), line.color)
      }
    }
    const interchanges = new Set<NodeId>()
    for (const [id, n] of onLines) if (n >= 2) interchanges.add(id)
    return { edgeColor, interchanges }
  }, [lines])

  const lit = new Set((litEdges ?? []).map((e) => edgeKey(e[0], e[1])))
  const pendingKey = pendingEdge ? edgeKey(pendingEdge[0], pendingEdge[1]) : null
  const edges = edgeList(adj)
  const transition = reduced ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" as const }

  const roleOf = (n: NodeId): Role => {
    if (interchanges.has(n)) return "interchange"
    return neighbors(adj, n).length <= 1 ? "terminus" : "regular"
  }
  const terminusColor = (n: NodeId): string => {
    const m = neighbors(adj, n)[0]
    return (m && edgeColor.get(edgeKey(n, m))) || METRO.ink
  }

  const W = SUBWAY_W * scale
  const H = SUBWAY_H * scale

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div
        ref={innerRef}
        data-testid="subway-map"
        data-variant={variant}
        data-reduced-motion={reduced ? "1" : undefined}
        className="relative mx-auto"
        style={{ width: W, height: H }}
      >
        {/* Map card, street grid, areas, and routes: decoration, hidden from AT. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={W}
          height={H}
          viewBox={`0 0 ${SUBWAY_W} ${SUBWAY_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={2} y={2} width={SUBWAY_W - 4} height={SUBWAY_H - 4} rx={22} />
            </clipPath>
          </defs>

          <rect
            x={2}
            y={2}
            width={SUBWAY_W - 4}
            height={SUBWAY_H - 4}
            rx={22}
            fill={METRO.card}
            stroke={METRO.cardEdge}
            strokeWidth={2}
          />

          {fill && (
            <g clipPath={`url(#${clipId})`}>
              <GridLines />
              {/* Neighborhood geography: a park and a waterfront, like a city map. */}
              <ellipse cx={SUBWAY_W - 56} cy={60} rx={48} ry={34} fill={METRO.park} opacity={0.55} />
              <rect x={6} y={SUBWAY_H - 76} width={96} height={70} rx={16} fill={METRO.water} opacity={0.5} />
              <NeighborhoodLabel x={12} y={22} anchor="start">
                RIVERSIDE
              </NeighborhoodLabel>
              <NeighborhoodLabel x={20} y={SUBWAY_H - 50} anchor="start">
                HARBOR BAY
              </NeighborhoodLabel>
              <NeighborhoodLabel x={SUBWAY_W - 12} y={SUBWAY_H - 16} anchor="end">
                PARKSIDE
              </NeighborhoodLabel>
            </g>
          )}

          {edges.map((e) => {
            const k = edgeKey(e[0], e[1])
            const a = center(layout, e[0])
            const b = center(layout, e[1])
            const color = edgeColor.get(k) ?? METRO.muted
            const glow = lit.has(k)
            if (k === pendingKey) {
              return (
                <motion.line
                  key={k}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
                  stroke={color}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            }
            return (
              <g key={k}>
                {/* Thin white casing lifts the route off the map + breaks crossings. */}
                <motion.line
                  initial={false}
                  animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
                  transition={transition}
                  stroke={METRO.station}
                  strokeWidth={glow ? 12 : 10.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <motion.line
                  initial={false}
                  animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
                  transition={transition}
                  stroke={color}
                  strokeWidth={glow ? 8 : 7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )
          })}

          {draw && armedSource && layout[armedSource] && cursor && (
            <LiveEdgeStretch from={center(layout, armedSource)} to={cursor} color={METRO.ink} />
          )}
        </svg>

        {nodes.map((n) => {
          const p = center(layout, n)
          const role = roleOf(n)
          const { w, h } = markerSize(role, scale, draw)
          const fontSize = Math.max(7, Math.min(15, Math.min(w, h) * 0.46))
          return (
            <motion.div
              key={n}
              className="absolute left-0 top-0"
              style={{ width: w, height: h }}
              initial={false}
              animate={{ x: p.x * scale - w / 2, y: p.y * scale - h / 2 }}
              transition={transition}
            >
              {draw ? (
                <StationDraw
                  n={n}
                  role={role}
                  termColor={terminusColor(n)}
                  fontSize={fontSize}
                  missingEdge={missingEdge}
                  terminal={terminal}
                />
              ) : (
                <StationDisplay n={n} role={role} termColor={terminusColor(n)} fontSize={fontSize} />
              )}
              <StationLabel name={stationName(n)} small={Math.min(w, h) < 30} />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------- backdrop bits --------------------------------- */

function GridLines() {
  const step = 30
  const lines: number[] = []
  for (let v = step; v < SUBWAY_W; v += step) lines.push(v)
  return (
    <g stroke={METRO.grid} strokeWidth={1}>
      {lines.map((x) => (
        <line key={`v${x}`} x1={x} y1={4} x2={x} y2={SUBWAY_H - 4} />
      ))}
      {lines.map((y) => (
        <line key={`h${y}`} x1={4} y1={y} x2={SUBWAY_W - 4} y2={y} />
      ))}
    </g>
  )
}

function NeighborhoodLabel({
  x,
  y,
  anchor,
  children,
}: {
  x: number
  y: number
  anchor: "start" | "end"
  children: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={METRO.label}
      fontSize={9}
      fontWeight={700}
      letterSpacing={1.5}
    >
      {children}
    </text>
  )
}

/* --------------------------------- station pieces --------------------------------- */

const STATION_BASE =
  "flex size-full items-center justify-center rounded-full border-solid font-bold leading-none outline-none transition-colors"
const FOCUSABLE =
  "focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** Resting marker fill/outline per role: white circle, colored terminus, etc. */
function restingStyle(role: Role, termColor: string, fontSize: number): CSSProperties {
  if (role === "terminus") {
    return { background: termColor, borderColor: METRO.ink, color: "#ffffff", borderWidth: 2.5, fontSize }
  }
  return {
    background: METRO.station,
    borderColor: METRO.ink,
    color: METRO.ink,
    borderWidth: role === "interchange" ? 3.5 : 2,
    fontSize,
  }
}

function StationLabel({ name, small }: { name: string; small: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap font-semibold leading-tight",
        small ? "text-[8px]" : "text-[10px]",
      )}
      style={{ color: METRO.ink }}
    >
      {name}
    </span>
  )
}

function StationDisplay({
  n,
  role,
  termColor,
  fontSize,
}: {
  n: NodeId
  role: Role
  termColor: string
  fontSize: number
}) {
  return (
    <span
      aria-label={`${stationName(n)} station`}
      className={STATION_BASE}
      style={restingStyle(role, termColor, fontSize)}
    >
      {n}
    </span>
  )
}

/**
 * A draw station: a rewire source AND target (sourceId = targetId = n), exactly
 * like GraphCanvas's DrawNode, so drag, tap, and keyboard all emit the same
 * from/to intent and the tracer's data-graph-correct-target / data-rewire-* hooks
 * land on the station markers unchanged.
 */
function StationDraw({
  n,
  role,
  termColor,
  fontSize,
  missingEdge,
  terminal,
}: {
  n: NodeId
  role: Role
  termColor: string
  fontSize: number
  missingEdge?: Edge
  terminal?: boolean
}) {
  const { ref, armed, showLegal, hovered, rootProps } = useRewireNode({
    sourceId: n,
    targetId: n,
    sourceLabel: `${stationName(n)} station, drag to connect`,
    targetLabel: `${stationName(n)} station`,
  })
  const correctTarget =
    import.meta.env.DEV && missingEdge && missingEdge[0] === n ? missingEdge[1] : undefined

  // Resting = the map marker; the interaction states reuse the shared lilac accent
  // so "grabbed / drop here / hovered" reads the same as every lesson.
  let style: CSSProperties = restingStyle(role, termColor, fontSize)
  if (armed) {
    style = { background: METRO.activeSoft, borderColor: METRO.active, color: METRO.active, borderWidth: 3, boxShadow: `0 0 0 4px ${METRO.active}33`, fontSize }
  } else if (showLegal) {
    style = { background: METRO.activeSoft, borderColor: METRO.active, color: METRO.active, borderWidth: 2.5, borderStyle: "dashed", fontSize }
  } else if (hovered) {
    style = { ...style, borderColor: METRO.active, boxShadow: `0 0 0 4px ${METRO.active}40` }
  }

  return (
    <button
      ref={ref}
      type="button"
      {...rootProps}
      disabled={terminal}
      data-graph-correct-target={correctTarget}
      aria-label={
        armed
          ? `${stationName(n)} station grabbed, choose a station to connect`
          : showLegal
            ? `${stationName(n)} station, available to connect`
            : `${stationName(n)} station, drag to connect`
      }
      className={cn(
        STATION_BASE,
        FOCUSABLE,
        "touch-none select-none",
        armed ? "cursor-grabbing" : showLegal ? "cursor-pointer" : "cursor-grab",
        terminal && "cursor-default",
      )}
      style={style}
    >
      {n}
    </button>
  )
}
