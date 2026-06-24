import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireContext } from "@/components/rewire/RewireContext"
import { useRewireNode } from "@/components/rewire/useRewireNode"
import {
  edgeKey,
  edgeList,
  type Adjacency,
  type Edge,
  type NodeId,
  type Pt,
} from "@/features/lesson/graphsEngine"

/** Intrinsic drawing surface. Nodes are circles kept at the 44px touch target. */
export const CANVAS_W = 280
export const CANVAS_H = 240
export const NODE_R = 22
const NODE_D = NODE_R * 2
/**
 * The hard floor for a node's on-screen size. The canvas coordinates scale down
 * to fit narrow phones, but the tappable circle never shrinks below this, so the
 * 44px touch/a11y target holds even when the figure is squeezed (the audit's
 * "nodes drop below 44px" fix). max(44, NODE_D*scale) collapses to 44 because
 * scale <= 1, but it is written out so the intent is obvious.
 */
const nodeSize = (scale: number) => Math.max(44, NODE_D * scale)

type CanvasMode = "display" | "demo" | "multiselect" | "draw"

export interface GraphCanvasProps {
  mode: CanvasMode
  nodes: NodeId[]
  /** The adjacency whose edges are drawn (workingAdj on draw beats). */
  adj: Adjacency
  layout: Record<NodeId, Pt>
  /** Ring the asked node(s): the prompt's focus / the path pair. */
  markedNodes?: NodeId[]
  /** Multi-select: the currently chosen neighbor set (filled lilac). */
  selectedNodes?: NodeId[]
  /** Multi-select: the correct neighbor set (DEV-only e2e hook). */
  answerSet?: NodeId[]
  onToggleNode?: (n: NodeId) => void
  /** Draw: the single drawn edge (glows + draws on). */
  pendingEdge?: Edge | null
  /** Draw: the correct missing edge (DEV-only e2e hook on its source node). */
  missingEdge?: Edge
  /** Edges to emphasise (sync highlight / Why-replay). */
  litEdges?: Edge[]
  terminal?: boolean
  reducedMotion?: boolean
}

export function GraphCanvas(props: GraphCanvasProps) {
  const prefersReduced = useReducedMotion()
  const reduced = props.reducedMotion ?? prefersReduced ?? false

  if (props.mode === "demo") {
    return <DemoCanvas nodes={props.nodes} adj={props.adj} layout={props.layout} reduced={reduced} />
  }
  return <StaticCanvas {...props} reduced={reduced} />
}

/* ------------------------------- scale-to-fit shell ------------------------------- */

/**
 * Measure the available width and return a 0..1 scale that fits `intrinsicWidth`.
 * Exported so the subway renderer shares the exact same fit math.
 */
export function useFitScale(intrinsicWidth: number) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const avail = el.clientWidth
      setScale(avail > 0 ? Math.min(1, avail / intrinsicWidth) : 1)
    }
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } else {
      window.addEventListener("resize", measure)
    }
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [intrinsicWidth])
  return { outerRef, scale }
}

function center(layout: Record<NodeId, Pt>, n: NodeId): Pt {
  return layout[n] ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 }
}

/* ------------------------------ shared draw affordances ------------------------------ */

/**
 * While a rewire source is armed, track the pointer in *canvas* coordinates so a
 * live "rubber-band" edge can follow it. Reads the armed source straight off the
 * shared RewireContext (exactly like the playlist's LiveQueueStretch) and maps
 * the viewport pointer back through the inner rect + scale (the DemoCanvas math).
 */
export function useArmedCursor(innerRef: RefObject<HTMLDivElement | null>, scale: number) {
  const ctx = useContext(RewireContext)
  const armedSource = ctx?.armedSource ?? null
  const [cursor, setCursor] = useState<Pt | null>(null)

  useEffect(() => {
    if (!armedSource) {
      setCursor(null)
      return
    }
    const onMove = (e: PointerEvent) => {
      const rect = innerRef.current?.getBoundingClientRect()
      if (!rect) return
      const s = scale || 1
      setCursor({ x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s })
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [armedSource, scale, innerRef])

  return { armedSource, cursor }
}

/**
 * The live dashed edge from a grabbed node to the pointer. Purely presentational
 * and position-only, so it is fine under reduced motion (no transition, it just
 * tracks). Drawn in the pointer-events-none overlay in canvas coordinates.
 */
export function LiveEdgeStretch({ from, to, color }: { from: Pt; to: Pt; color: string }) {
  return (
    <g style={{ color }}>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <circle cx={to.x} cy={to.y} r={4.5} fill="currentColor" />
    </g>
  )
}

/* --------------------------------- static canvas --------------------------------- */

function StaticCanvas({
  mode,
  nodes,
  adj,
  layout,
  markedNodes,
  selectedNodes,
  answerSet,
  onToggleNode,
  pendingEdge,
  missingEdge,
  litEdges,
  terminal,
  reduced,
}: GraphCanvasProps & { reduced: boolean }) {
  const { outerRef, scale } = useFitScale(CANVAS_W)
  const innerRef = useRef<HTMLDivElement>(null)
  const { armedSource, cursor } = useArmedCursor(innerRef, scale)

  const marked = new Set(markedNodes ?? [])
  const selected = new Set(selectedNodes ?? [])
  const answers = new Set(answerSet ?? [])
  const lit = new Set((litEdges ?? []).map((e) => edgeKey(e[0], e[1])))
  const pendingKey = pendingEdge ? edgeKey(pendingEdge[0], pendingEdge[1]) : null

  const edges = edgeList(adj)
  const transition = reduced ? { duration: 0 } : { duration: 0.45, ease: "easeInOut" as const }
  const W = CANVAS_W * scale
  const H = CANVAS_H * scale
  const nd = nodeSize(scale)

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div
        ref={innerRef}
        data-testid="graph-canvas"
        data-reduced-motion={reduced ? "1" : undefined}
        className="relative mx-auto"
        style={{ width: W, height: H }}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width={W}
          height={H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {edges.map((e) => {
            const k = edgeKey(e[0], e[1])
            const a = center(layout, e[0])
            const b = center(layout, e[1])
            const glow = k === pendingKey || lit.has(k)
            if (k === pendingKey) {
              // The just-drawn edge grows on (pathLength) instead of popping in.
              return (
                <motion.line
                  key={k}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
                  stroke="var(--lilac-strong)"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              )
            }
            return (
              <motion.line
                key={k}
                initial={false}
                animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
                transition={transition}
                stroke={glow ? "var(--lilac-strong)" : "var(--border)"}
                strokeWidth={glow ? 4 : 2.4}
                strokeLinecap="round"
              />
            )
          })}

          {mode === "draw" && armedSource && layout[armedSource] && cursor && (
            <LiveEdgeStretch from={center(layout, armedSource)} to={cursor} color="var(--lilac-strong)" />
          )}
        </svg>

        {nodes.map((n) => {
          const p = center(layout, n)
          return (
            <motion.div
              key={n}
              className="absolute left-0 top-0"
              style={{ width: nd, height: nd }}
              initial={false}
              animate={{ x: p.x * scale - nd / 2, y: p.y * scale - nd / 2 }}
              transition={transition}
            >
              {mode === "multiselect" ? (
                <SelectNode
                  n={n}
                  selected={selected.has(n)}
                  marked={marked.has(n)}
                  isAnswer={answers.has(n)}
                  terminal={terminal}
                  onToggle={onToggleNode}
                />
              ) : mode === "draw" ? (
                <DrawNode n={n} missingEdge={missingEdge} terminal={terminal} />
              ) : (
                <DisplayNode n={n} marked={marked.has(n)} />
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ----------------------------------- node pieces ----------------------------------- */

const CIRCLE =
  "flex size-full items-center justify-center rounded-full border-2 text-base font-bold outline-none transition-colors"
const FOCUSABLE =
  "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

function DisplayNode({ n, marked }: { n: NodeId; marked: boolean }) {
  return (
    <span
      aria-label={`node ${n}`}
      className={cn(
        CIRCLE,
        "border-border bg-card text-foreground",
        marked && "border-lilac-strong bg-lilac-soft text-lilac-strong ring-4 ring-lilac-strong/20",
      )}
    >
      {n}
    </span>
  )
}

function SelectNode({
  n,
  selected,
  marked,
  isAnswer,
  terminal,
  onToggle,
}: {
  n: NodeId
  selected: boolean
  marked: boolean
  isAnswer: boolean
  terminal?: boolean
  onToggle?: (n: NodeId) => void
}) {
  return (
    <button
      type="button"
      aria-label={`node ${n}`}
      aria-pressed={selected}
      disabled={terminal}
      data-answer={isAnswer && import.meta.env.DEV ? "1" : undefined}
      onClick={() => onToggle?.(n)}
      className={cn(
        CIRCLE,
        FOCUSABLE,
        "cursor-pointer text-foreground",
        selected
          ? "border-lilac-strong bg-lilac-soft text-lilac-strong ring-4 ring-lilac-strong/15"
          : "border-border bg-card hover:border-lilac-strong/45",
        marked && !selected && "ring-2 ring-lilac-strong/40",
        terminal && "cursor-default",
      )}
    >
      {n}
    </button>
  )
}

/**
 * A draw node: simultaneously a rewire **source** (grab it to start an edge) and
 * a **target** (release on it to connect), via `useRewireNode` with
 * `sourceId = targetId = n`. Drag, tap, and keyboard all emit the same from/to
 * intent; the engine normalizes it to an undirected edge. The DEV-only
 * `data-graph-correct-target` marks the missing edge's source for the e2e tracer.
 */
function DrawNode({
  n,
  missingEdge,
  terminal,
}: {
  n: NodeId
  missingEdge?: Edge
  terminal?: boolean
}) {
  const { ref, armed, showLegal, hovered, rootProps } = useRewireNode({
    sourceId: n,
    targetId: n,
    sourceLabel: `node ${n}, drag to connect`,
    targetLabel: `node ${n}`,
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
          ? `node ${n} grabbed, choose a node to connect`
          : showLegal
            ? `node ${n}, available to connect`
            : `node ${n}, drag to connect`
      }
      className={cn(
        CIRCLE,
        FOCUSABLE,
        "touch-none select-none",
        armed
          ? "cursor-grabbing border-lilac-strong bg-lilac-soft text-lilac-strong ring-4 ring-lilac-strong/20"
          : showLegal
            ? "cursor-pointer border-dashed border-lilac-strong bg-lilac-soft text-lilac-strong"
            : "cursor-grab border-border bg-card text-foreground hover:border-lilac-strong/45",
        hovered && "border-solid ring-4 ring-lilac-strong/25",
        terminal && "cursor-default",
      )}
    >
      {n}
    </button>
  )
}

/* ---------------------------------- demo canvas ---------------------------------- */

const NUDGE_STEP = 16

/**
 * Free-play: drag a node anywhere and **nothing changes**. The edges follow, the
 * adjacency is byte-for-byte identical. Position is decoration (the L3 echo).
 * Keyboard parity: focus a node and use the arrow keys to nudge it. Either way an
 * SR-only live region announces "Position changed; connections unchanged."
 */
function DemoCanvas({
  nodes,
  adj,
  layout,
  reduced,
}: {
  nodes: NodeId[]
  adj: Adjacency
  layout: Record<NodeId, Pt>
  reduced: boolean
}) {
  const { outerRef, scale } = useFitScale(CANVAS_W)
  const [pos, setPos] = useState<Record<NodeId, Pt>>(() => ({ ...layout }))
  const [announce, setAnnounce] = useState("")
  const dragRef = useRef<{ id: NodeId; ptr: number } | null>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const at = (n: NodeId): Pt => pos[n] ?? center(layout, n)
  const edges = edgeList(adj)
  const W = CANVAS_W * scale
  const H = CANVAS_H * scale
  const nd = nodeSize(scale)
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

  function moveTo(id: NodeId, x: number, y: number) {
    setPos((prev) => ({
      ...prev,
      [id]: { x: clamp(x, NODE_R, CANVAS_W - NODE_R), y: clamp(y, NODE_R, CANVAS_H - NODE_R) },
    }))
    setAnnounce("Position changed; connections unchanged.")
  }

  function startDrag(id: NodeId, e: React.PointerEvent) {
    e.preventDefault()
    const ptr = e.pointerId
    dragRef.current = { id, ptr }
    try {
      e.currentTarget.setPointerCapture?.(ptr)
    } catch {
      // jsdom / unsupported: window listeners cover the gesture.
    }
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d || ev.pointerId !== d.ptr) return
      const rect = innerRef.current?.getBoundingClientRect()
      if (!rect) return
      const s = scale || 1
      moveTo(d.id, (ev.clientX - rect.left) / s, (ev.clientY - rect.top) / s)
    }
    const stop = (ev: PointerEvent) => {
      if (dragRef.current && ev.pointerId !== dragRef.current.ptr) return
      dragRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  function onNodeKeyDown(id: NodeId, e: React.KeyboardEvent) {
    const p = at(id)
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      moveTo(id, p.x - NUDGE_STEP, p.y)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      moveTo(id, p.x + NUDGE_STEP, p.y)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveTo(id, p.x, p.y - NUDGE_STEP)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      moveTo(id, p.x, p.y + NUDGE_STEP)
    }
  }

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div
        ref={innerRef}
        data-testid="graph-canvas"
        data-reduced-motion={reduced ? "1" : undefined}
        className="relative mx-auto"
        style={{ width: W, height: H }}
      >
        <svg
          className="pointer-events-none absolute inset-0"
          width={W}
          height={H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {edges.map((e) => {
            const a = at(e[0])
            const b = at(e[1])
            return (
              <line
                key={edgeKey(e[0], e[1])}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--border)"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            )
          })}
        </svg>

        {nodes.map((n) => {
          const p = at(n)
          return (
            <button
              key={n}
              type="button"
              aria-label={`node ${n}, drag or use arrow keys to move`}
              onPointerDown={(e) => startDrag(n, e)}
              onKeyDown={(e) => onNodeKeyDown(n, e)}
              className={cn(
                CIRCLE,
                FOCUSABLE,
                "absolute touch-none cursor-grab border-border bg-card text-foreground shadow-sm active:cursor-grabbing",
              )}
              style={{ left: p.x * scale - nd / 2, top: p.y * scale - nd / 2, width: nd, height: nd }}
            >
              {n}
            </button>
          )
        })}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  )
}
