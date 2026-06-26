import {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireContext } from "@/components/rewire/RewireContext"
import { useRewireNode } from "@/components/rewire/useRewireNode"
import {
  edgeKey,
  neighbors,
  type Adjacency,
  type Edge,
  type NodeId,
  type Pt,
} from "@/features/lesson/graphsEngine"
import { useFitScale } from "./GraphCanvas"
import { octolinearPoints, roundedPath, lineRuns } from "./metroPath"
import { METRO, TRANSIT_LINES, stationName, type TransitLine } from "./transitData"

/**
 * The subway skin: the SAME draw / display contract as GraphCanvas, dressed as a
 * real metro diagram. Routes are drawn per LINE as octolinear polylines (every
 * segment 0/45/90 degrees) with rounded corners, so a route sweeps through a
 * station the way a published transit map does. White-circle stops, colored
 * line-end rings, and a thick-ringed white transfer capsule sit on top. None of
 * it grades: the colors, the routing, and the two layouts (geographic vs
 * diagrammatic) are decoration over the engine's adjacency; the route list is the
 * data. Draw stations carry the same DEV hooks as GraphCanvas's DrawNode, so the
 * e2e tracer drives the transit beat identically (data-graph-correct-target +
 * data-rewire-source/target via useRewireNode with sourceId = targetId = n).
 */

export const SUBWAY_W = 300
export const SUBWAY_H = 300

/** Intrinsic marker diameters per role (before the fit scale), `node` style. */
const REG_D = 30
const TERM_D = 34
const INT_D = 36
/** Corner radius (viewBox units) for the rounded metro bends. */
const CORNER_R = 18
/** Route stroke weights (viewBox units): white casing under the colored line. */
const CASING_W = 13.5
const LINE_W = 10
/** Visual dot diameter inside the 44px draw hit-area (`dot` style). */
const DRAW_DOT = 26

export type SubwayVariant = "geographic" | "diagrammatic"
/** Station rendering: big lettered circles (`node`) or ref-style tiny dots (`dot`). */
export type SubwayMarker = "node" | "dot"
/** What the label beside each station shows. */
export type SubwayLabels = "letter" | "name" | "both" | "none"
/** The greyed-out "complete plan" the active network is being built toward. */
export interface SubwayGhost {
  nodes: NodeId[]
  adj: Adjacency
  lines: TransitLine[]
}
type Role = "interchange" | "terminus" | "regular"

export interface SubwayMapProps {
  mode: "display" | "draw"
  nodes: NodeId[]
  /** The adjacency whose segments are drawn (workingAdj on the draw beat). */
  adj: Adjacency
  layout: Record<NodeId, Pt>
  variant: SubwayVariant
  /** Routes (decoration): the colored lines + interchange detection. */
  lines?: TransitLine[]
  /** Force octolinear (true) / straight (false) routing. Defaults to the variant
   *  (diagrammatic = octolinear, geographic = straight). */
  octolinear?: boolean
  /** Station rendering. `dot` (default) is the ref-style tiny marker + label;
   *  `node` is the larger lettered circle. */
  marker?: SubwayMarker
  /** What to write beside each station (default the letter id, the route-list key). */
  labels?: SubwayLabels
  /** The greyed-out complete plan, drawn faint behind the active colored network. */
  ghost?: SubwayGhost
  /** Fill empty space with soft map geography (a park, residential blocks, water). */
  decor?: boolean
  /** Map base + line-casing color (the "gap" shown where lines cross). Defaults to
   *  white; a city skin passes its own ground color so casing matches the scene. */
  paper?: string
  /** Custom SVG art (in the 0..300 viewBox) drawn behind the lines: a city skin's
   *  rivers, parks, districts, blocks, etc. Decoration only. */
  backdrop?: ReactNode
  /** Grow to fill the full-bleed scene. */
  fill?: boolean
  /** Draw: the single drawn segment (draws on in its route color). */
  pendingEdge?: Edge | null
  /** Draw: the correct missing segment (DEV-only e2e hook on its source). */
  missingEdge?: Edge
  terminal?: boolean
  reducedMotion?: boolean
}

function center(layout: Record<NodeId, Pt>, n: NodeId): Pt {
  return layout[n] ?? { x: SUBWAY_W / 2, y: SUBWAY_H / 2 }
}

/**
 * The container (and hit-area) footprint per role + mode + marker style.
 *
 * `node`: big lettered circles; the marker IS the tap target (>=44px in draw).
 * `dot`: ref-style tiny markers. In DISPLAY they shrink to small dots / a slim
 * transfer capsule (like a published diagram); in DRAW the container grows to a
 * 44px hit area (a11y) with the small dot drawn centered inside.
 */
function markerBox(
  role: Role,
  scale: number,
  draw: boolean,
  marker: SubwayMarker,
): { w: number; h: number } {
  if (marker === "dot") {
    if (draw) return { w: 44, h: 44 }
    if (role === "interchange") {
      const w = Math.max(15, 18 * scale)
      return { w, h: w }
    }
    const base = role === "terminus" ? 16 : 14
    const d = Math.max(role === "terminus" ? 12 : 11, base * scale)
    return { w: d, h: d }
  }
  if (role === "interchange") {
    const w = draw ? Math.max(44, INT_D * scale) : Math.max(20, INT_D * scale)
    return { w, h: w }
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
  octolinear: octolinearProp,
  marker = "dot",
  labels = "letter",
  ghost,
  decor,
  paper,
  backdrop,
  fill,
  pendingEdge,
  missingEdge,
  terminal,
  reducedMotion,
}: SubwayMapProps) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const draw = mode === "draw"
  const octolinear = octolinearProp ?? variant === "diagrammatic"
  const ground = paper ?? METRO.paper
  const clipId = useId()

  const { outerRef, scale } = useFitScale(SUBWAY_W, fill ? 1.3 : 1)
  const innerRef = useRef<HTMLDivElement>(null)
  const { armedSource, hoveredTarget, cursor } = useDragCursor(innerRef, scale)

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

  const pendingKey = pendingEdge ? edgeKey(pendingEdge[0], pendingEdge[1]) : null
  // Routes drawn per line as rounded octolinear polylines; the just-drawn edge is
  // excluded so it can draw on as its own overlay.
  const runs = useMemo(
    () => lineRuns(lines, adj, layout, octolinear, pendingKey),
    [lines, adj, layout, octolinear, pendingKey],
  )
  // The complete plan, as faint grey rounded polylines behind the active network.
  const ghostRuns = useMemo(
    () => (ghost ? lineRuns(ghost.lines, ghost.adj, layout, octolinear) : []),
    [ghost, layout, octolinear],
  )
  const ghostOnly = useMemo(
    () => (ghost ? ghost.nodes.filter((n) => !nodes.includes(n)) : []),
    [ghost, nodes],
  )
  const transition = reduced ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" as const }

  const roleOf = (n: NodeId): Role => {
    if (interchanges.has(n)) return "interchange"
    return neighbors(adj, n).length <= 1 ? "terminus" : "regular"
  }
  const terminusColor = (n: NodeId): string => {
    const m = neighbors(adj, n)[0]
    return (m && edgeColor.get(edgeKey(n, m))) || METRO.ink
  }

  const liveFrom = draw && armedSource && layout[armedSource] ? center(layout, armedSource) : null
  const liveTo =
    cursor ?? (hoveredTarget && layout[hoveredTarget] ? center(layout, hoveredTarget) : null)

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
        {/* Clean white map field + routes: decoration, hidden from AT. A real
            metro diagram is a schematic, so there is no street grid or geography,
            just the white paper, the colored lines, and the station markers. */}
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
              <rect x={1} y={1} width={SUBWAY_W - 2} height={SUBWAY_H - 2} rx={22} />
            </clipPath>
          </defs>

          <rect
            x={1}
            y={1}
            width={SUBWAY_W - 2}
            height={SUBWAY_H - 2}
            rx={22}
            fill={ground}
            stroke={fill ? "none" : METRO.cardEdge}
            strokeWidth={1}
          />

          {/* City-skin art (rivers, parks, districts), clipped to the rounded map. */}
          {backdrop && <g clipPath={`url(#${clipId})`}>{backdrop}</g>}

          {/* Soft geography to fill empty space (park, residential blocks, water). */}
          {decor && <Decor />}

          {/* The greyed-out complete plan: the metro we are building toward. */}
          {ghostRuns.map((run) => (
            <path
              key={`ghost-${run.key}`}
              d={roundedPath(run.points, CORNER_R, run.closed)}
              fill="none"
              stroke={METRO.ghost}
              strokeWidth={LINE_W - 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* White casing for every route first, so colored lines sit cleanly on
              top and crossings read as one line passing over another. */}
          {runs.map((run) => (
            <motion.path
              key={`casing-${run.key}`}
              initial={false}
              animate={{ d: roundedPath(run.points, CORNER_R, run.closed) }}
              transition={transition}
              fill="none"
              stroke={ground}
              strokeWidth={CASING_W}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {runs.map((run) => (
            <motion.path
              key={`line-${run.key}`}
              initial={false}
              animate={{ d: roundedPath(run.points, CORNER_R, run.closed) }}
              transition={transition}
              fill="none"
              stroke={run.color}
              strokeWidth={LINE_W}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* The just-drawn segment draws on as its own route-colored overlay. */}
          {pendingEdge && layout[pendingEdge[0]] && layout[pendingEdge[1]] && (
            <PendingSegment
              from={center(layout, pendingEdge[0])}
              to={center(layout, pendingEdge[1])}
              color={(pendingKey && edgeColor.get(pendingKey)) || METRO.active}
              casing={ground}
              octolinear={octolinear}
              reduced={reduced}
            />
          )}

          {liveFrom && <LiveDragEdge from={liveFrom} to={liveTo} />}
        </svg>

        {/* Planned-but-unbuilt stations: faint hollow markers on the grey outline. */}
        {ghostOnly.map((n) => {
          const p = center(layout, n)
          const d = Math.max(10, 13 * scale)
          return (
            <div
              key={`ghost-${n}`}
              className="absolute left-0 top-0"
              style={{ width: d, height: d, transform: `translate(${p.x * scale - d / 2}px, ${p.y * scale - d / 2}px)` }}
            >
              <span
                className="block size-full rounded-full border-2 border-dashed"
                style={{ background: METRO.paper, borderColor: METRO.ghostInk }}
              />
              {labels !== "none" && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[8.5px] font-semibold uppercase tracking-wide"
                  style={{ color: METRO.ghostInk, textShadow: "0 0 3px #fff" }}
                >
                  {labels === "name" ? stationName(n) : n}
                </span>
              )}
            </div>
          )
        })}

        {nodes.map((n) => {
          const p = center(layout, n)
          const role = roleOf(n)
          const { w, h } = markerBox(role, scale, draw, marker)
          const fontSize = Math.max(7, Math.min(15, Math.min(w, h) * 0.46))
          const dot = marker === "dot"
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
                dot ? (
                  <DotStationDraw n={n} role={role} termColor={terminusColor(n)} missingEdge={missingEdge} terminal={terminal} />
                ) : (
                  <StationDraw n={n} role={role} termColor={terminusColor(n)} fontSize={fontSize} missingEdge={missingEdge} terminal={terminal} />
                )
              ) : dot ? (
                <DotStationDisplay n={n} role={role} termColor={terminusColor(n)} />
              ) : (
                <StationDisplay n={n} role={role} termColor={terminusColor(n)} fontSize={fontSize} />
              )}
              <StationLabel id={n} name={stationName(n)} mode={labels} small={dot || Math.min(w, h) < 30} />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------- live drag --------------------------------- */

/**
 * Track the pointer in map coordinates the instant it presses ANY station, not
 * just once a drag arms, so the rubber-band edge is already at the fingertip the
 * moment the gesture crosses the drag threshold (the S&Q "it follows your finger
 * immediately" feel). Reads the armed source + hovered target off the shared
 * RewireSurface context so drag/tap/keyboard stay in sync.
 */
function useDragCursor(innerRef: RefObject<HTMLDivElement | null>, scale: number) {
  const ctx = useContext(RewireContext)
  const armedSource = ctx?.armedSource ?? null
  const hoveredTarget = ctx?.hoveredTarget ?? null
  const [cursor, setCursor] = useState<Pt | null>(null)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const toLocal = (e: PointerEvent): Pt | null => {
      const rect = innerRef.current?.getBoundingClientRect()
      if (!rect) return null
      const s = scale || 1
      return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s }
    }
    const onMove = (e: PointerEvent) => {
      const p = toLocal(e)
      if (p) setCursor(p)
    }
    const onUp = () => {
      setCursor(null)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    const onDown = (e: PointerEvent) => {
      const p = toLocal(e)
      if (p) setCursor(p)
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onUp)
    }
    el.addEventListener("pointerdown", onDown)
    return () => {
      el.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [innerRef, scale])

  return { armedSource, hoveredTarget, cursor }
}

/** The live "drawing" edge from the grabbed station to the fingertip (or hovered
 *  station). Lilac, the shared interaction color, so it reads like every other
 *  grab/drop. A short stub shows the instant a source is armed by keyboard. */
function LiveDragEdge({ from, to }: { from: Pt; to: Pt | null }) {
  const end = to ?? { x: from.x, y: from.y - 26 }
  return (
    <g className="pointer-events-none">
      <line
        x1={from.x}
        y1={from.y}
        x2={end.x}
        y2={end.y}
        stroke={METRO.active}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray="0.5 9"
      />
      <circle cx={end.x} cy={end.y} r={5.5} fill={METRO.active} />
    </g>
  )
}

/** The just-drawn segment: white casing + a route-colored line that draws on. */
function PendingSegment({
  from,
  to,
  color,
  casing,
  octolinear,
  reduced,
}: {
  from: Pt
  to: Pt
  color: string
  /** Casing under the drawn line: the map's paper, so the gap matches the skin. */
  casing: string
  octolinear: boolean
  reduced: boolean
}) {
  const d = roundedPath(octolinearPoints([from, to], octolinear, false), CORNER_R, false)
  return (
    <g>
      <path d={d} fill="none" stroke={casing} strokeWidth={CASING_W} strokeLinecap="round" strokeLinejoin="round" />
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={LINE_W}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
      />
    </g>
  )
}

/* --------------------------------- map decor --------------------------------- */

/** Soft, pastel map geography drawn faint behind the network so the field reads
 *  like a real city: a grass park, a pond, and a couple of residential blocks. */
function Decor() {
  return (
    <g aria-hidden opacity={0.9}>
      {/* grass lot, with a few trees */}
      <rect x={206} y={24} width={82} height={50} rx={12} fill={METRO.park} stroke={METRO.parkInk} strokeWidth={1} />
      <circle cx={224} cy={50} r={5} fill={METRO.parkInk} />
      <circle cx={245} cy={43} r={6} fill={METRO.parkInk} />
      <circle cx={266} cy={53} r={5} fill={METRO.parkInk} />
      {/* pond */}
      <rect x={206} y={230} width={82} height={50} rx={18} fill={METRO.water} />
      {/* residential blocks (neighborhoods) */}
      <Blocks x={28} y={26} cols={3} rows={1} />
      <Blocks x={30} y={224} cols={3} rows={2} />
    </g>
  )
}

function Blocks({ x, y, cols, rows }: { x: number; y: number; cols: number; rows: number }) {
  const size = 13
  const gap = 6
  const cells: ReactElement[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x + c * (size + gap)}
          y={y + r * (size + gap)}
          width={size}
          height={size}
          rx={2.5}
          fill={METRO.block}
          stroke={METRO.blockInk}
          strokeWidth={1}
        />,
      )
    }
  }
  return <g>{cells}</g>
}

/* --------------------------------- station pieces --------------------------------- */

const STATION_BASE =
  "flex size-full items-center justify-center rounded-full border-solid font-bold leading-none outline-none transition-colors"
const FOCUSABLE =
  "focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * Resting marker fill/outline per role, straight off a published metro diagram:
 * every station is a WHITE marker (the lines carry the color). A regular stop is a
 * small white circle with a thin ink ring; a line end (terminus) rings in its own
 * route color; the interchange is the thick-ink-ringed white capsule, the classic
 * "major transfer" marker.
 */
function restingStyle(role: Role, termColor: string, fontSize: number): CSSProperties {
  if (role === "terminus") {
    return { background: METRO.station, borderColor: termColor, color: METRO.ink, borderWidth: 3.5, fontSize }
  }
  return {
    background: METRO.station,
    borderColor: METRO.ink,
    color: METRO.ink,
    borderWidth: role === "interchange" ? 3 : 2.5,
    fontSize,
  }
}

/**
 * Station label, set like an official metro map: bold, uppercase, ink, with a
 * white halo so it stays legible where it grazes a route line. `mode` chooses the
 * id (the route-list key), the name, both, or nothing.
 */
function StationLabel({
  id,
  name,
  mode,
  small,
}: {
  id: NodeId
  name: string
  mode: SubwayLabels
  small: boolean
}) {
  if (mode === "none") return null
  const halo = { textShadow: "0 0 3px #fff, 0 1px 2px #fff" } as const
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-full mt-0.5 flex -translate-x-1/2 flex-col items-center whitespace-nowrap leading-tight"
    >
      {mode === "both" ? (
        <>
          <span
            className={cn("font-bold uppercase tracking-wide", small ? "text-[9px]" : "text-[11px]")}
            style={{ color: METRO.ink, ...halo }}
          >
            {id}
          </span>
          <span
            className={cn("font-semibold uppercase tracking-wide", small ? "text-[7px]" : "text-[9px]")}
            style={{ color: METRO.muted, ...halo }}
          >
            {name}
          </span>
        </>
      ) : (
        <span
          className={cn("font-bold uppercase tracking-wide", small ? "text-[8.5px]" : "text-[10px]")}
          style={{ color: METRO.ink, ...halo }}
        >
          {mode === "name" ? name : id}
        </span>
      )}
    </span>
  )
}

/* --------------------------------- dot markers --------------------------------- */

/** The resting dot/pill fill + ring per role (no text): the ref-style marker. */
function dotStyle(role: Role, termColor: string): CSSProperties {
  if (role === "terminus") {
    return { background: METRO.station, borderColor: termColor, borderWidth: 3 }
  }
  return {
    background: METRO.station,
    borderColor: METRO.ink,
    borderWidth: role === "interchange" ? 3 : 2.5,
  }
}

const DOT_BASE = "block rounded-full border-solid transition-colors"

function DotStationDisplay({ n, role, termColor }: { n: NodeId; role: Role; termColor: string }) {
  return (
    <span
      aria-label={`${stationName(n)} station`}
      className={cn(DOT_BASE, "size-full")}
      style={dotStyle(role, termColor)}
    />
  )
}

/**
 * A draw dot: the 44px container is the tap target / rewire source+target, with
 * the small visual dot drawn centered inside. Same DEV + a11y hooks as the node
 * marker; only the look shrinks to the ref aesthetic.
 */
function DotStationDraw({
  n,
  role,
  termColor,
  missingEdge,
  terminal,
}: {
  n: NodeId
  role: Role
  termColor: string
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

  let style: CSSProperties = dotStyle(role, termColor)
  if (armed) {
    style = { background: METRO.activeSoft, borderColor: METRO.active, borderWidth: 3, boxShadow: `0 0 0 4px ${METRO.active}33` }
  } else if (showLegal) {
    style = { background: METRO.activeSoft, borderColor: METRO.active, borderWidth: 2.5, borderStyle: "dashed" }
  } else if (hovered) {
    style = { ...style, borderColor: METRO.active, boxShadow: `0 0 0 4px ${METRO.active}40` }
  }
  const dotD = role === "interchange" ? DRAW_DOT + 4 : DRAW_DOT

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
        "grid size-full place-items-center bg-transparent outline-none",
        FOCUSABLE,
        "touch-none select-none rounded-full",
        armed ? "cursor-grabbing" : showLegal ? "cursor-pointer" : "cursor-grab",
        terminal && "cursor-default",
      )}
    >
      <span className={cn(DOT_BASE)} style={{ ...style, width: dotD, height: dotD }} />
    </button>
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
