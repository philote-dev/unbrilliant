import { useMemo, useRef } from "react"
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
import { TRANSIT_LINES, stationName, type TransitLine } from "./transitData"

/**
 * The subway skin: the SAME draw / display contract as GraphCanvas, dressed as a
 * metro map. Route-colored strokes, interchange-aware station markers, station
 * names, the Phase-1 live stretch, and the draw-on commit. None of it grades:
 * the colors and the two layouts (geographic vs diagrammatic) are decoration
 * over the engine's adjacency. The picture is the decoration; adjacency is the
 * data. Draw stations carry the same DEV hooks as GraphCanvas's DrawNode, so the
 * e2e tracer drives the transit beat identically (data-graph-correct-target +
 * data-rewire-source/target via useRewireNode with sourceId = targetId = n).
 */

export const SUBWAY_W = 300
export const SUBWAY_H = 300
const STATION_R = 22
const STATION_D = STATION_R * 2
/** Station markers never shrink below the 44px touch/a11y target (see GraphCanvas). */
const stationSize = (scale: number) => Math.max(44, STATION_D * scale)

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
  pendingEdge,
  missingEdge,
  litEdges,
  terminal,
  reducedMotion,
}: SubwayMapProps) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const { outerRef, scale } = useFitScale(SUBWAY_W)
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
  const sd = stationSize(scale)

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
        {/* Backdrop + routes: pure decoration, hidden from assistive tech. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={W}
          height={H}
          viewBox={`0 0 ${SUBWAY_W} ${SUBWAY_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <rect
            x={4}
            y={4}
            width={SUBWAY_W - 8}
            height={SUBWAY_H - 8}
            rx={20}
            className="fill-lilac-soft/25"
          />
          <circle cx={SUBWAY_W - 64} cy={64} r={40} className="fill-success-soft/40" />

          {edges.map((e) => {
            const k = edgeKey(e[0], e[1])
            const a = center(layout, e[0])
            const b = center(layout, e[1])
            const color = edgeColor.get(k) ?? "var(--lilac-strong)"
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
              <motion.line
                key={k}
                initial={false}
                animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
                transition={transition}
                stroke={color}
                strokeWidth={glow ? 9 : 7}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={glow ? 1 : 0.92}
              />
            )
          })}

          {mode === "draw" && armedSource && layout[armedSource] && cursor && (
            <LiveEdgeStretch from={center(layout, armedSource)} to={cursor} color="var(--foreground)" />
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
              {mode === "draw" ? (
                <StationDraw n={n} interchange={interchanges.has(n)} missingEdge={missingEdge} terminal={terminal} />
              ) : (
                <StationDisplay n={n} interchange={interchanges.has(n)} />
              )}
              <StationLabel name={stationName(n)} />
            </motion.div>
          )
        })}
      </div>

      <div className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1" aria-hidden>
        {lines.map((l) => (
          <span key={l.id} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="h-1.5 w-4 rounded-full" style={{ background: l.color }} />
            {l.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- station pieces --------------------------------- */

const STATION =
  "flex size-full items-center justify-center rounded-full border-2 bg-card text-sm font-bold text-foreground outline-none transition-colors"
const FOCUSABLE =
  "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

function StationLabel({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap text-[10px] font-medium leading-tight text-muted-foreground"
    >
      {name}
    </span>
  )
}

function StationDisplay({ n, interchange }: { n: NodeId; interchange: boolean }) {
  return (
    <span
      aria-label={`${stationName(n)} station`}
      className={cn(
        STATION,
        interchange
          ? "border-foreground/70 ring-4 ring-background"
          : "border-border",
      )}
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
        STATION,
        FOCUSABLE,
        "touch-none select-none",
        armed
          ? "cursor-grabbing border-lilac-strong bg-lilac-soft text-lilac-strong ring-4 ring-lilac-strong/20"
          : showLegal
            ? "cursor-pointer border-dashed border-lilac-strong bg-lilac-soft text-lilac-strong"
            : interchange
              ? "cursor-grab border-foreground/70 ring-4 ring-background hover:border-lilac-strong/60"
              : "cursor-grab border-border hover:border-lilac-strong/45",
        hovered && "border-solid ring-4 ring-lilac-strong/25",
        terminal && "cursor-default",
      )}
    >
      {n}
    </button>
  )
}
