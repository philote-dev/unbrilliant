import { useLayoutEffect, useRef, useState } from "react"
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

/** Intrinsic drawing surface; nodes are circles ≥44px (touch + a11y target). */
export const CANVAS_W = 280
export const CANVAS_H = 240
export const NODE_R = 22
const NODE_D = NODE_R * 2

type CanvasMode = "display" | "demo" | "multiselect" | "draw"

export interface GraphCanvasProps {
  mode: CanvasMode
  nodes: NodeId[]
  /** The adjacency whose edges are drawn (workingAdj on draw beats). */
  adj: Adjacency
  layout: Record<NodeId, Pt>
  /** Ring the asked node(s) — the prompt's focus / the path pair. */
  markedNodes?: NodeId[]
  /** Multi-select: the currently chosen neighbor set (filled lilac). */
  selectedNodes?: NodeId[]
  /** Multi-select: the correct neighbor set — DEV-only e2e hook. */
  answerSet?: NodeId[]
  onToggleNode?: (n: NodeId) => void
  /** Draw: the single drawn edge (glows). */
  pendingEdge?: Edge | null
  /** Draw: the correct missing edge — DEV-only e2e hook on its source node. */
  missingEdge?: Edge
  /** Edges to emphasise (sync highlight / Why-replay). */
  litEdges?: Edge[]
  terminal?: boolean
  transit?: boolean
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

function useFitScale() {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const avail = el.clientWidth
      setScale(avail > 0 ? Math.min(1, avail / CANVAS_W) : 1)
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
  }, [])
  return { outerRef, scale }
}

function center(layout: Record<NodeId, Pt>, n: NodeId): Pt {
  return layout[n] ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 }
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
  transit,
  reduced,
}: GraphCanvasProps & { reduced: boolean }) {
  const { outerRef, scale } = useFitScale()

  const marked = new Set(markedNodes ?? [])
  const selected = new Set(selectedNodes ?? [])
  const answers = new Set(answerSet ?? [])
  const lit = new Set((litEdges ?? []).map((e) => edgeKey(e[0], e[1])))
  const pendingKey = pendingEdge ? edgeKey(pendingEdge[0], pendingEdge[1]) : null

  const edges = edgeList(adj)
  const transition = reduced
    ? { duration: 0 }
    : { duration: 0.45, ease: "easeInOut" as const }

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div className="relative mx-auto" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
        <div
          data-testid="graph-canvas"
          data-reduced-motion={reduced ? "1" : undefined}
          className="absolute left-0 top-0"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <svg className="pointer-events-none absolute inset-0" width={CANVAS_W} height={CANVAS_H} aria-hidden>
            {edges.map((e) => {
              const k = edgeKey(e[0], e[1])
              const glow = k === pendingKey || lit.has(k)
              const a = center(layout, e[0])
              const b = center(layout, e[1])
              return (
                <motion.line
                  key={k}
                  initial={false}
                  animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
                  transition={transition}
                  stroke={glow ? "var(--lilac-strong)" : transit ? "var(--lilac)" : "var(--border)"}
                  strokeWidth={glow ? 4 : transit ? 4 : 2.4}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {nodes.map((n) => {
            const p = center(layout, n)
            return (
              <motion.div
                key={n}
                className="absolute left-0 top-0"
                style={{ width: NODE_D, height: NODE_D }}
                initial={false}
                animate={{ x: p.x - NODE_R, y: p.y - NODE_R }}
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
                  <DrawNode
                    n={n}
                    missingEdge={missingEdge}
                    terminal={terminal}
                    transit={transit}
                  />
                ) : (
                  <DisplayNode n={n} marked={marked.has(n)} transit={transit} />
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------- node pieces ----------------------------------- */

const CIRCLE =
  "flex size-full items-center justify-center rounded-full border-2 text-base font-bold outline-none transition-colors"
const FOCUSABLE =
  "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

function DisplayNode({ n, marked, transit }: { n: NodeId; marked: boolean; transit?: boolean }) {
  return (
    <span
      aria-label={`node ${n}`}
      className={cn(
        CIRCLE,
        transit
          ? "border-lilac-strong bg-lilac-soft text-lilac-strong"
          : "border-border bg-card text-foreground",
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
 * `sourceId = targetId = n`. Drag/tap/keyboard all emit the same `from → to`
 * intent; the engine normalizes it to an undirected edge. The DEV-only
 * `data-graph-correct-target` marks the missing edge's source for the e2e tracer.
 */
function DrawNode({
  n,
  missingEdge,
  terminal,
  transit,
}: {
  n: NodeId
  missingEdge?: Edge
  terminal?: boolean
  transit?: boolean
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
          ? `node ${n} grabbed — choose a node to connect`
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
            : transit
              ? "cursor-grab border-lilac-strong bg-lilac-soft text-lilac-strong hover:ring-4 hover:ring-lilac-strong/15"
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

/**
 * Free-play: drag a node anywhere and **nothing changes** — the edges follow, the
 * adjacency is byte-for-byte identical. Position is decoration (the L3 echo).
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
  const { outerRef, scale } = useFitScale()
  const [pos, setPos] = useState<Record<NodeId, Pt>>(() => ({ ...layout }))
  const dragRef = useRef<{ id: NodeId; ptr: number } | null>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const at = (n: NodeId): Pt => pos[n] ?? center(layout, n)
  const edges = edgeList(adj)

  function startDrag(id: NodeId, e: React.PointerEvent) {
    e.preventDefault()
    const ptr = e.pointerId
    dragRef.current = { id, ptr }
    try {
      e.currentTarget.setPointerCapture?.(ptr)
    } catch {
      // jsdom / unsupported — window listeners cover the gesture.
    }
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d || ev.pointerId !== d.ptr) return
      const rect = innerRef.current?.getBoundingClientRect()
      if (!rect) return
      const s = scale || 1
      setPos((prev) => ({
        ...prev,
        [d.id]: {
          x: clamp((ev.clientX - rect.left) / s, NODE_R, CANVAS_W - NODE_R),
          y: clamp((ev.clientY - rect.top) / s, NODE_R, CANVAS_H - NODE_R),
        },
      }))
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

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div className="relative mx-auto" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
        <div
          ref={innerRef}
          data-testid="graph-canvas"
          data-reduced-motion={reduced ? "1" : undefined}
          className="absolute left-0 top-0"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <svg className="pointer-events-none absolute inset-0" width={CANVAS_W} height={CANVAS_H} aria-hidden>
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
                aria-label={`node ${n}, drag to move`}
                onPointerDown={(e) => startDrag(n, e)}
                className={cn(
                  CIRCLE,
                  FOCUSABLE,
                  "absolute touch-none cursor-grab border-border bg-card text-foreground shadow-sm active:cursor-grabbing",
                )}
                style={{ left: p.x - NODE_R, top: p.y - NODE_R, width: NODE_D, height: NODE_D }}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
