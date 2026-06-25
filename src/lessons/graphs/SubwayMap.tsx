import { useMemo, useRef, type CSSProperties } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { useRewireNode } from "@/components/rewire/useRewireNode"
import {
  edgeKey,
  edgeList,
  type Adjacency,
  type Edge,
  type NodeId,
  type Pt,
} from "@/features/lesson/graphsEngine"
import { LiveEdgeStretch, useArmedCursor, useFitScale } from "./GraphCanvas"
import { METRO, TRANSIT_LINES, stationName, type TransitLine } from "./transitData"

/**
 * The subway skin: the SAME draw / display contract as GraphCanvas, dressed as a
 * real transit-map poster. Route-colored named lines, interchange-aware station
 * markers, station names, the live "rubber-band" stretch, and the draw-on commit.
 * None of it grades: the colors and the two layouts (geographic vs diagrammatic)
 * are decoration over the engine's adjacency. The picture is the decoration; the
 * route list is the data. Draw stations carry the same DEV hooks as GraphCanvas's
 * DrawNode, so the e2e tracer drives the transit beat identically
 * (data-graph-correct-target + data-rewire-source/target via useRewireNode with
 * sourceId = targetId = n).
 */

export const SUBWAY_W = 300
export const SUBWAY_H = 300
const STATION_R = 22
const STATION_D = STATION_R * 2
/**
 * Marker size floor. In DRAW mode it never shrinks below the 44px touch/a11y
 * target even when scaled; in DISPLAY mode the markers are not tap targets (the
 * route list carries the data), so they may scale smaller for the side-by-side
 * comparison, with a legibility floor.
 */
const stationSize = (scale: number, draw: boolean) =>
  Math.max(draw ? 44 : 24, STATION_D * scale)

export type SubwayVariant = "geographic" | "diagrammatic"

export interface SubwayMapProps {
  mode: "display" | "draw"
  nodes: NodeId[]
  /** The adjacency whose segments are drawn (workingAdj on the draw beat). */
  adj: Adjacency
  layout: Record<NodeId, Pt>
  variant: SubwayVariant
  /** Routes (decoration): tints the segments + flags interchanges. */
  lines?: TransitLine[]
  /** Grow to fill the full-bleed scene width (caps the up-scale). */
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

  const W = SUBWAY_W * scale
  const H = SUBWAY_H * scale
  const sd = stationSize(scale, draw)

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
        {/* Map card + routes: pure decoration, hidden from assistive tech. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={W}
          height={H}
          viewBox={`0 0 ${SUBWAY_W} ${SUBWAY_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
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
          {/* Decorative geography (a park and a waterfront), well clear of routes. */}
          <ellipse cx={SUBWAY_W - 58} cy={62} rx={46} ry={34} fill={METRO.park} opacity={0.55} />
          <rect x={12} y={SUBWAY_H - 74} width={92} height={56} rx={18} fill={METRO.water} opacity={0.55} />

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
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            }
            return (
              <g key={k}>
                {/* White casing lifts each route off the paper and separates crossings. */}
                <motion.line
                  initial={false}
                  animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
                  transition={transition}
                  stroke={METRO.station}
                  strokeWidth={glow ? 13 : 11}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <motion.line
                  initial={false}
                  animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
                  transition={transition}
                  stroke={color}
                  strokeWidth={glow ? 9 : 7}
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
          return (
            <motion.div
              key={n}
              className="absolute left-0 top-0"
              style={{ width: sd, height: sd }}
              initial={false}
              animate={{ x: p.x * scale - sd / 2, y: p.y * scale - sd / 2 }}
              transition={transition}
            >
              {draw ? (
                <StationDraw n={n} interchange={interchanges.has(n)} missingEdge={missingEdge} terminal={terminal} />
              ) : (
                <StationDisplay n={n} interchange={interchanges.has(n)} />
              )}
              <StationLabel name={stationName(n)} small={sd < 40} />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------- station pieces --------------------------------- */

const STATION_BASE =
  "flex size-full items-center justify-center rounded-full border-2 font-bold outline-none transition-colors"
const FOCUSABLE =
  "focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** Classic interchange tick: a white gap then an ink outer ring. */
const INTERCHANGE_RING = `0 0 0 3px ${METRO.card}, 0 0 0 5px ${METRO.ink}`

function restingStyle(interchange: boolean): CSSProperties {
  return {
    background: METRO.station,
    borderColor: METRO.ink,
    color: METRO.ink,
    boxShadow: interchange ? INTERCHANGE_RING : undefined,
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

function StationDisplay({ n, interchange }: { n: NodeId; interchange: boolean }) {
  return (
    <span
      aria-label={`${stationName(n)} station`}
      className={cn(STATION_BASE, "text-sm")}
      style={restingStyle(interchange)}
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
  interchange,
  missingEdge,
  terminal,
}: {
  n: NodeId
  interchange: boolean
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

  // Resting = white/ink map marker; the interaction states reuse the shared lilac
  // accent so "grabbed / drop here / hovered" reads the same as every lesson.
  let style: CSSProperties = restingStyle(interchange)
  if (armed) {
    style = { background: METRO.activeSoft, borderColor: METRO.active, color: METRO.active, boxShadow: `0 0 0 4px ${METRO.active}33` }
  } else if (showLegal) {
    style = { background: METRO.activeSoft, borderColor: METRO.active, color: METRO.active, borderStyle: "dashed" }
  } else if (hovered) {
    style = { ...restingStyle(interchange), borderColor: METRO.active, boxShadow: `0 0 0 4px ${METRO.active}40` }
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
        "touch-none select-none text-sm",
        armed ? "cursor-grabbing" : showLegal ? "cursor-pointer" : "cursor-grab",
        terminal && "cursor-default",
      )}
      style={style}
    >
      {n}
    </button>
  )
}
