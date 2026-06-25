import { useLayoutEffect, useRef, useState, type Dispatch, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { LessonAction } from "@/features/lesson/engine"
import {
  candidatesRemaining,
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
import { HalvingMeter } from "./HalvingMeter"

/**
 * The hierarchical tree figure: SVG edges under absolute-positioned circular node
 * buttons, scaled to fit (the NodeGraph idiom). Three faces, all driven by the
 * pure engine + layout (jsdom-safe: positions come from `treeLayout`, not from
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

/**
 * Visual skin. "tree" is the abstract circular figure; "bracket" re-shapes the
 * same nodes/edges into a top-down tournament bracket (rounded seed cards +
 * orthogonal connectors) for the arena. Logic and every `data-*` hook are
 * identical across variants; colors come from the arena's CSS-variable override.
 */
export type FigureVariant = "tree" | "bracket"
const nodeRadius = (variant: FigureVariant) =>
  variant === "bracket" ? "rounded-xl" : "rounded-full"

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
  variant = "tree",
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
  /** Hold descend taps until a prerequisite finishes (the T5 felt pre-walk). */
  lockDescend?: boolean
  /** Override the reduced-motion media query (tests; otherwise the hook decides). */
  reducedMotion?: boolean
  /** Visual skin (logic + hooks unchanged); "bracket" draws the arena bracket. */
  variant?: FigureVariant
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const q = state.question
  if (!q) return null
  if (q.mode === "sequence") {
    return <SequenceFigure state={state} dispatch={dispatch} reduced={reduced} variant={variant} />
  }
  return (
    <DescendFigure
      state={state}
      dispatch={dispatch}
      lockDescend={lockDescend}
      reduced={reduced}
      variant={variant}
    />
  )
}

/* --------------------------------- fit box --------------------------------- */

function FitBox({
  figW,
  figH,
  reduced,
  straightened,
  children,
}: {
  figW: number
  figH: number
  reduced: boolean
  /** Sequence only: whether the compact layout has straightened into in-order.
   * Surfaced as `data-straightened` so jsdom can assert the teaching payoff. */
  straightened?: boolean
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
          data-straightened={straightened === undefined ? undefined : straightened ? "1" : "0"}
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
  variant = "tree",
}: {
  tree: TreeNode
  pos: Map<string, NodePos>
  tone: (from: string, to: string) => EdgeTone
  reduced: boolean
  variant?: FigureVariant
}) {
  const transition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 220, damping: 28 }
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      {edgesOf(tree).map(({ from, to }) => {
        const a = pos.get(from)
        const b = pos.get(to)
        if (!a || !b) return null
        const t = tone(from, to)
        const opacity = t === "dropped" ? 0.4 : 1
        const stroke = EDGE_STROKE[t]
        const width = variant === "bracket" ? 2.8 : 2.4
        if (variant === "bracket") {
          // Orthogonal bracket connector: down, across, down (3 animatable segments).
          const mid = (a.y + b.y) / 2
          const seg = (key: string, x1: number, y1: number, x2: number, y2: number) => (
            <motion.line
              key={key}
              initial={false}
              animate={{ x1, y1, x2, y2, opacity }}
              transition={transition}
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
            />
          )
          return (
            <g key={`${from}-${to}`}>
              {seg(`${from}-${to}-v1`, a.x, a.y, a.x, mid)}
              {seg(`${from}-${to}-h`, a.x, mid, b.x, mid)}
              {seg(`${from}-${to}-v2`, b.x, mid, b.x, b.y)}
            </g>
          )
        }
        return (
          <motion.line
            key={`${from}-${to}`}
            initial={false}
            animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y, opacity }}
            transition={transition}
            stroke={stroke}
            strokeWidth={width}
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
  variant,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
  lockDescend: boolean
  reduced: boolean
  variant: FigureVariant
}) {
  const q = state.question!
  const tree = q.tree
  const radius = nodeRadius(variant)
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
        <Edges tree={tree} pos={layout.pos} tone={edgeTone} reduced={reduced} variant={variant} />

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
                    "flex size-full items-center justify-center border-2 text-base font-bold text-foreground outline-none transition-colors",
                    radius,
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
                    "flex size-full items-center justify-center border-2 text-base font-bold transition-colors",
                    radius,
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

        {/* dashed ghost slots for empty sides at the cursor (tap = "it falls here").
            Once a slot is committed they vanish: the filled slot stands in its
            place (no same-side overlap) and no opposite-side ghost lingers. */}
        {interactive &&
          state.tappedSlot == null &&
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
                aria-label={`empty ${side} slot. Tap if ${q.target ?? "the value"} would attach here`}
                onClick={() => dispatch({ type: "select", letter: side === "left" ? "ghost:left" : "ghost:right" })}
                className={cn(
                  "absolute flex items-center justify-center border-2 border-dashed border-lilac-strong/70 bg-lilac-soft/40 text-sm font-semibold text-lilac-strong outline-none",
                  radius,
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
            className={cn(
              "absolute flex items-center justify-center border-2 border-lilac-strong bg-lilac-soft text-base font-bold text-lilac-strong",
              radius,
            )}
            style={(() => {
              const p = slotPos(state.tappedSlot.side)
              return { left: p.x - NODE_R, top: p.y - NODE_R, width: NODE_W, height: NODE_H }
            })()}
          >
            {q.target}
          </div>
        )}
      </FitBox>

      {variant === "bracket" ? (
        // The halving is felt through the eliminated (greyed) half of the bracket,
        // so the abstract pip meter is folded away; the count survives in the SR
        // line + a compact "seeds still in" caption.
        <p className="text-xs font-bold uppercase tracking-wide tabular-nums" style={{ color: "#0b1f4d" }}>
          {candidatesRemaining(state)} seed{candidatesRemaining(state) === 1 ? "" : "s"} still in
        </p>
      ) : (
        <HalvingMeter
          total={subtreeSize(tree)}
          remaining={candidatesRemaining(state)}
          reducedMotion={reduced}
        />
      )}

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
  const remaining = candidatesRemaining(state)
  const inPlay = `${remaining} node${remaining === 1 ? "" : "s"} in play`
  const len = state.tappedPath.length
  if (state.tappedSlot) {
    return `${q.target ?? "The value"} runs off into an empty slot; ${inPlay}.`
  }
  if (len <= 1) return `At the root; ${inPlay}.`
  const parent = nodeById(tree, state.tappedPath[len - 2])
  const childId = state.tappedPath[len - 1]
  if (!parent) return ""
  const goLeft = parent.left?.id === childId
  const opp = goLeft ? parent.right : parent.left
  const d = subtreeSize(opp)
  return `${q.target ?? "The value"} ${goLeft ? "is less than" : "is greater than"} ${parent.key}, go ${goLeft ? "left" : "right"}; dropped ${d} node${d === 1 ? "" : "s"}; ${inPlay}.`
}

/* -------------------------------- sequence --------------------------------- */

function SequenceFigure({
  state,
  dispatch,
  reduced,
  variant,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
  reduced: boolean
  variant: FigureVariant
}) {
  const q = state.question!
  const tree = q.tree
  const radius = nodeRadius(variant)
  const compact = compactLayout(tree)
  const tidy = tidyLayout(tree)
  // The teaching payoff: straighten the compact layout into sorted order on a
  // correct in-order tap (the row assembles itself), and also on Why after a
  // fail so the answer is shown. Either path fires the same straighten.
  const straightened = state.showWhy || state.feedback === "correct"
  const layout: TreeLayout = straightened ? tidy : compact

  const order = q.order
  const rank = new Map(order.map((id, i) => [id, i]))
  const tappedAt = new Map(state.tappedOrder.map((id, i) => [id, i + 1]))
  const terminal = isTerminalTrees(state)
  const figW = Math.max(compact.width, tidy.width)
  const figH = Math.max(compact.height, tidy.height)

  const transition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 220, damping: 26 }

  return (
    <FitBox figW={figW} figH={figH} reduced={reduced} straightened={straightened}>
      <Edges tree={tree} pos={layout.pos} tone={() => "muted"} reduced={reduced} variant={variant} />

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
                  "flex size-full items-center justify-center border-2 border-border bg-card text-base font-bold text-foreground outline-none transition-colors",
                  radius,
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
                  "relative flex size-full items-center justify-center border-2 text-base font-bold transition-colors",
                  radius,
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
 * A read-only tidy tree for the teach beats, the compare-shape pair, and the
 * post-correct contrast race. Highlight a path (e.g. an example descend), grey the
 * discarded subtrees (`droppedIds`, for the race), or dim the whole thing for
 * context (`dim`). All extra props are optional and backward compatible.
 */
export function DisplayTree({
  tree,
  highlightIds,
  droppedIds,
  orderRanks,
  dim = false,
  caption,
  variant = "tree",
}: {
  tree: TreeNode
  highlightIds?: string[]
  /** Discarded subtrees to grey out read-only (the BST-vs-list race). */
  droppedIds?: string[]
  /** Node ids in traversal order; each gets a 1..n badge so the order is visible
   * (teach-inorder: lighting the whole tree alone hides left → node → right). */
  orderRanks?: string[]
  /** Dim the whole figure (background / context). */
  dim?: boolean
  caption?: string
  /** Visual skin; "bracket" draws seed cards + orthogonal connectors. */
  variant?: FigureVariant
}) {
  const prefersReduced = useReducedMotion()
  const reduced = prefersReduced ?? false
  const radius = nodeRadius(variant)
  const layout = tidyLayout(tree)
  const lit = new Set(highlightIds ?? [])
  const dropped = new Set(droppedIds ?? [])
  const rankOf = new Map((orderRanks ?? []).map((id, i) => [id, i + 1]))

  const edgeTone = (from: string, to: string): EdgeTone => {
    if (dropped.has(from) || dropped.has(to)) return "dropped"
    return lit.has(from) && lit.has(to) ? "path" : "muted"
  }

  return (
    <div className={cn("flex flex-col items-center gap-1.5", dim && "opacity-50")}>
      <FitBox figW={layout.width} figH={layout.height} reduced={reduced}>
        <Edges tree={tree} pos={layout.pos} tone={edgeTone} reduced={reduced} variant={variant} />
        {[...layout.pos.entries()].map(([id, p]) => {
          const node = nodeById(tree, id)!
          const isDropped = dropped.has(id)
          const rank = rankOf.get(id)
          return (
            <div
              key={id}
              data-node-id={id}
              data-dropped={isDropped ? "1" : undefined}
              data-order-rank={rank}
              aria-label={`node ${node.key}${rank ? `, visited ${rank}` : ""}${isDropped ? ", discarded" : ""}`}
              className={cn(
                "absolute flex items-center justify-center border-2 text-base font-bold transition-colors",
                radius,
                isDropped
                  ? "border-dashed border-faint bg-card/40 text-faint opacity-40"
                  : lit.has(id)
                    ? "border-lilac-strong bg-lilac-soft text-foreground"
                    : "border-border bg-card text-foreground",
              )}
              style={{ left: p.x - NODE_R, top: p.y - NODE_R, width: NODE_W, height: NODE_H }}
            >
              {node.key}
              {rank != null && (
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-lilac text-[11px] font-bold text-lilac-foreground">
                  {rank}
                </span>
              )}
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
