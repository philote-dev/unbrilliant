import { useLayoutEffect, useRef, useState, type Dispatch, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { LessonAction } from "@/features/lesson/engine"
import {
  correctNextStep,
  cursorNode,
  droppedNodeIds,
  isTerminalTrees,
  nodeById,
  subtreeSize,
  tappableChildren,
  type Side,
  type TreeNode,
  type TreesState,
} from "@/features/lesson/treesEngine"
import {
  NODE_H,
  NODE_R,
  NODE_W,
  ROW_Y,
  compactLayout,
  tidyLayout,
  type NodePos,
  type TreeLayout,
} from "./treeLayout"

/**
 * The hierarchical tree figure: SVG edges under absolute-positioned circular node
 * buttons, scaled to fit (the NodeGraph idiom). Three faces, all driven by the
 * pure engine + layout (jsdom-safe — positions come from `treeLayout`, not from
 * measuring the DOM):
 *  - **descend** (Locate): only the cursor's two children (and a dashed ghost slot
 *    for each empty side) are tappable; tapping steps down and the opposite
 *    subtree dims/collapses (the halving made visible). Reduced motion → it just
 *    greys, and an SR status announces the comparison + dropped count.
 *  - **sequence** (Predict-the-sequence): nodes drawn at COMPACT (non-monotonic)
 *    coords so the row can't be read; tapping appends to the order, and on Why the
 *    nodes straighten to their tidy in-order x so the sorted row assembles itself.
 *  - **display**: a read-only tidy tree (teach beats + the compare-shape pair).
 *
 * DEV-only e2e hooks (guarded by `import.meta.env.DEV`): `data-answer="1"` on the
 * single correct next descend step, and `data-inorder-rank` on every sequence node.
 */

const GHOST_DX = 30
const DEV = import.meta.env.DEV

const edgesOf = (tree: TreeNode): { from: string; to: string }[] => {
  const out: { from: string; to: string }[] = []
  const walk = (n: TreeNode | null) => {
    if (!n) return
    if (n.left) {
      out.push({ from: n.id, to: n.left.id })
      walk(n.left)
    }
    if (n.right) {
      out.push({ from: n.id, to: n.right.id })
      walk(n.right)
    }
  }
  walk(tree)
  return out
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

export function TreeFigure({
  state,
  dispatch,
  lockDescend = false,
  reducedMotion,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
  /** Hold descend taps until a prerequisite finishes (the T5 felt pre-walk). */
  lockDescend?: boolean
  /** Override the reduced-motion media query (tests; otherwise the hook decides). */
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const q = state.question
  if (!q) return null
  if (q.mode === "sequence") {
    return <SequenceFigure state={state} dispatch={dispatch} reduced={reduced} />
  }
  return (
    <DescendFigure state={state} dispatch={dispatch} lockDescend={lockDescend} reduced={reduced} />
  )
}

/* --------------------------------- fit box --------------------------------- */

function FitBox({
  figW,
  figH,
  reduced,
  children,
}: {
  figW: number
  figH: number
  reduced: boolean
  children: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const avail = el.clientWidth
      setScale(avail > 0 ? Math.min(1, avail / figW) : 1)
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
  }, [figW])

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div className="relative mx-auto" style={{ width: figW * scale, height: figH * scale }}>
        <div
          data-testid="tree-figure"
          data-reduced-motion={reduced ? "1" : undefined}
          className="absolute left-0 top-0"
          style={{ width: figW, height: figH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- edges ----------------------------------- */

type EdgeTone = "muted" | "path" | "dropped"
const EDGE_STROKE: Record<EdgeTone, string> = {
  muted: "var(--border)",
  path: "var(--lilac-strong)",
  dropped: "var(--faint)",
}

function Edges({
  tree,
  pos,
  tone,
  reduced,
}: {
  tree: TreeNode
  pos: Map<string, NodePos>
  tone: (from: string, to: string) => EdgeTone
  reduced: boolean
}) {
  const transition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 220, damping: 28 }
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      {edgesOf(tree).map(({ from, to }) => {
        const a = pos.get(from)
        const b = pos.get(to)
        if (!a || !b) return null
        const t = tone(from, to)
        return (
          <motion.line
            key={`${from}-${to}`}
            initial={false}
            animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y, opacity: t === "dropped" ? 0.4 : 1 }}
            transition={transition}
            stroke={EDGE_STROKE[t]}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

/* -------------------------------- descend ---------------------------------- */

function DescendFigure({
  state,
  dispatch,
  lockDescend,
  reduced,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
  lockDescend: boolean
  reduced: boolean
}) {
  const q = state.question!
  const tree = q.tree
  const layout = tidyLayout(tree)
  const dropped = droppedNodeIds(state)
  const pathIds = new Set(state.tappedPath)
  const cur = cursorNode(state)
  const tc = tappableChildren(state)
  const interactive = !isTerminalTrees(state) && !lockDescend
  const next = DEV ? correctNextStep(state) : null

  const leftChildId = cur?.left?.id ?? null
  const rightChildId = cur?.right?.id ?? null
  const isTappable = (id: string) =>
    interactive && ((tc.left && id === leftChildId) || (tc.right && id === rightChildId))

  // Extend the canvas for ghost slots / a committed slot one level below the cursor.
  const hasSlots = tc.ghostSides.length > 0 || state.tappedSlot != null
  const figW = layout.width
  const figH = layout.height + (hasSlots ? ROW_Y : 0)

  const curPos = cur ? layout.pos.get(cur.id) : null
  const slotPos = (side: Side): NodePos =>
    curPos
      ? { x: clamp(curPos.x + (side === "left" ? -GHOST_DX : GHOST_DX), NODE_R, figW - NODE_R), y: curPos.y + ROW_Y }
      : { x: figW / 2, y: figH - NODE_R }

  const edgeTone = (from: string, to: string): EdgeTone => {
    if (dropped.has(from) || dropped.has(to)) return "dropped"
    if (pathIds.has(from) && pathIds.has(to)) return "path"
    return "muted"
  }

  const transition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 24 }

  return (
    <div className="flex flex-col items-center gap-3">
      <FitBox figW={figW} figH={figH} reduced={reduced}>
        <Edges tree={tree} pos={layout.pos} tone={edgeTone} reduced={reduced} />

        {[...layout.pos.entries()].map(([id, p]) => {
          const node = nodeById(tree, id)!
          const isDropped = dropped.has(id)
          const onPath = pathIds.has(id)
          const tappable = isTappable(id)
          const answer = next?.kind === "node" && next.id === id && tappable
          return (
            <motion.div
              key={id}
              initial={false}
              animate={{
                x: p.x - NODE_R,
                y: p.y - NODE_R,
                opacity: isDropped ? 0.3 : 1,
                scale: isDropped && !reduced ? 0.62 : 1,
              }}
              transition={transition}
              className="absolute left-0 top-0"
              style={{ width: NODE_W, height: NODE_H }}
            >
              {tappable ? (
                <button
                  type="button"
                  data-tappable="1"
                  data-node-id={id}
                  data-answer={answer ? "1" : undefined}
                  aria-label={`node ${node.key}`}
                  onClick={() => dispatch({ type: "select", letter: id })}
                  className={cn(
                    "flex size-full items-center justify-center rounded-full border-2 text-base font-bold text-foreground outline-none transition-colors",
                    "cursor-pointer border-lilac-strong/60 bg-card ring-4 ring-lilac-strong/15 hover:bg-lilac-soft",
                    "focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {node.key}
                </button>
              ) : (
                <div
                  data-node-id={id}
                  aria-label={`node ${node.key}${isDropped ? ", discarded" : ""}`}
                  className={cn(
                    "flex size-full items-center justify-center rounded-full border-2 text-base font-bold transition-colors",
                    onPath
                      ? "border-lilac-strong bg-lilac-soft text-foreground"
                      : isDropped
                        ? "border-dashed border-faint bg-card/40 text-faint"
                        : "border-border bg-card text-foreground",
                  )}
                >
                  {node.key}
                </div>
              )}
            </motion.div>
          )
        })}

        {/* dashed ghost slots for empty sides at the cursor (tap = "it falls here") */}
        {interactive &&
          tc.ghostSides.map((side) => {
            const p = slotPos(side)
            const answer = next?.kind === "ghost" && next.side === side
            return (
              <button
                key={`ghost-${side}`}
                type="button"
                data-tappable="1"
                data-ghost-side={side}
                data-answer={answer ? "1" : undefined}
                aria-label={`empty ${side} slot — tap if ${q.target ?? "the value"} would attach here`}
                onClick={() => dispatch({ type: "select", letter: side === "left" ? "ghost:left" : "ghost:right" })}
                className={cn(
                  "absolute flex items-center justify-center rounded-full border-2 border-dashed border-lilac-strong/70 bg-lilac-soft/40 text-sm font-semibold text-lilac-strong outline-none",
                  "cursor-pointer hover:bg-lilac-soft focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
                style={{ left: p.x - NODE_R, top: p.y - NODE_R, width: NODE_W, height: NODE_H }}
              >
                +
              </button>
            )
          })}

        {/* the committed slot (after the learner taps a ghost) */}
        {state.tappedSlot && (
          <div
            aria-label={`${q.target ?? "value"} ${q.insertAt ? "attaches" : "would be"} here`}
            className="absolute flex items-center justify-center rounded-full border-2 border-lilac-strong bg-lilac-soft text-base font-bold text-lilac-strong"
            style={(() => {
              const p = slotPos(state.tappedSlot.side)
              return { left: p.x - NODE_R, top: p.y - NODE_R, width: NODE_W, height: NODE_H }
            })()}
          >
            {q.target}
          </div>
        )}
      </FitBox>

      <p className="sr-only" role="status">
        {descendStatus(state)}
      </p>
    </div>
  )
}

function descendStatus(state: TreesState): string {
  const q = state.question
  if (!q) return ""
  const tree = q.tree
  const droppedCount = droppedNodeIds(state).size
  const remaining = subtreeSize(tree) - droppedCount
  const len = state.tappedPath.length
  if (state.tappedSlot) {
    return `${q.target ?? "The value"} would attach at an empty slot — ${remaining} node${remaining === 1 ? "" : "s"} were searched.`
  }
  if (len <= 1) return `At the root. ${remaining} node${remaining === 1 ? "" : "s"} in play.`
  const parent = nodeById(tree, state.tappedPath[len - 2])
  const childId = state.tappedPath[len - 1]
  if (!parent) return ""
  const goLeft = parent.left?.id === childId
  const opp = goLeft ? parent.right : parent.left
  const d = subtreeSize(opp)
  return `${q.target ?? "The value"} ${goLeft ? "is less than" : "is greater than"} ${parent.key} — go ${goLeft ? "left" : "right"}; dropped ${d} node${d === 1 ? "" : "s"}; ${remaining} left.`
}

/* -------------------------------- sequence --------------------------------- */

function SequenceFigure({
  state,
  dispatch,
  reduced,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
  reduced: boolean
}) {
  const q = state.question!
  const tree = q.tree
  const compact = compactLayout(tree)
  const tidy = tidyLayout(tree)
  // On Why (or once correct), straighten the compact layout into sorted order.
  const straightened = state.showWhy
  const layout: TreeLayout = straightened ? tidy : compact

  const order = q.order
  const rank = new Map(order.map((id, i) => [id, i]))
  const tappedAt = new Map(state.tappedOrder.map((id, i) => [id, i + 1]))
  const terminal = isTerminalTrees(state)
  const figW = Math.max(compact.width, tidy.width)
  const figH = Math.max(compact.height, tidy.height)

  const transition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 220, damping: 26 }

  return (
    <FitBox figW={figW} figH={figH} reduced={reduced}>
      <Edges tree={tree} pos={layout.pos} tone={() => "muted"} reduced={reduced} />

      {[...layout.pos.entries()].map(([id, p]) => {
        const node = nodeById(tree, id)!
        const orderNo = tappedAt.get(id)
        const tapped = orderNo != null
        const tappable = !tapped && !terminal
        return (
          <motion.div
            key={id}
            initial={false}
            animate={{ x: p.x - NODE_R, y: p.y - NODE_R }}
            transition={transition}
            className="absolute left-0 top-0"
            style={{ width: NODE_W, height: NODE_H }}
          >
            {tappable ? (
              <button
                type="button"
                data-tappable="1"
                data-node-id={id}
                data-inorder-rank={DEV ? rank.get(id) : undefined}
                aria-label={`node ${node.key}`}
                onClick={() => dispatch({ type: "select", letter: id })}
                className={cn(
                  "flex size-full items-center justify-center rounded-full border-2 border-border bg-card text-base font-bold text-foreground outline-none transition-colors",
                  "cursor-pointer hover:border-lilac-strong/50 focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                {node.key}
              </button>
            ) : (
              <div
                data-node-id={id}
                data-inorder-rank={DEV ? rank.get(id) : undefined}
                aria-label={`node ${node.key}${orderNo ? `, tapped ${orderNo}` : ""}`}
                className={cn(
                  "relative flex size-full items-center justify-center rounded-full border-2 text-base font-bold transition-colors",
                  tapped ? "border-lilac-strong bg-lilac-soft text-foreground" : "border-border bg-card text-foreground",
                )}
              >
                {node.key}
                {orderNo != null && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-lilac text-[11px] font-bold text-lilac-foreground">
                    {orderNo}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )
      })}
    </FitBox>
  )
}

/* ------------------------------ display tree ------------------------------- */

/**
 * A read-only tidy tree for the teach beats and the compare-shape pair. Highlight
 * a path (e.g. an example descend) or dim the whole thing for context.
 */
export function DisplayTree({
  tree,
  highlightIds,
  caption,
}: {
  tree: TreeNode
  highlightIds?: string[]
  caption?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = prefersReduced ?? false
  const layout = tidyLayout(tree)
  const lit = new Set(highlightIds ?? [])

  const edgeTone = (from: string, to: string): EdgeTone =>
    lit.has(from) && lit.has(to) ? "path" : "muted"

  return (
    <div className="flex flex-col items-center gap-1.5">
      <FitBox figW={layout.width} figH={layout.height} reduced={reduced}>
        <Edges tree={tree} pos={layout.pos} tone={edgeTone} reduced={reduced} />
        {[...layout.pos.entries()].map(([id, p]) => {
          const node = nodeById(tree, id)!
          return (
            <div
              key={id}
              data-node-id={id}
              aria-label={`node ${node.key}`}
              className={cn(
                "absolute flex items-center justify-center rounded-full border-2 text-base font-bold transition-colors",
                lit.has(id)
                  ? "border-lilac-strong bg-lilac-soft text-foreground"
                  : "border-border bg-card text-foreground",
              )}
              style={{ left: p.x - NODE_R, top: p.y - NODE_R, width: NODE_W, height: NODE_H }}
            >
              {node.key}
            </div>
          )
        })}
      </FitBox>
      {caption && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {caption}
        </span>
      )}
    </div>
  )
}
