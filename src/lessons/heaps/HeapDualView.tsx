import type { ReactNode } from "react"
import { Check, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { leftIndex, parentIndex, rightIndex, type SwapStep } from "@/features/lesson/heapsEngine"
import {
  BAND_H,
  CELL,
  GAP,
  NODE_R,
  W,
  arrayRowWidth,
  cellCenter,
  nodePositions,
  treeHeight,
} from "./heapLayout"

/**
 * The signature Heaps figure: a dual, synced tree + array view. A node-link
 * complete-tree (top) sits over an index-ruled array strip (bottom); they are the
 * SAME data, so a highlighted slot lights in both panels and the index map is
 * drawn, not implied. Layout is hand-rolled by arithmetic in `heapLayout` (no
 * `d3-hierarchy`): slot `i` sits at depth `floor(log2(i+1))`, position `i-(2^depth-1)`.
 *
 * Selecting a slot draws faint connectors to its children (`2i+1`/`2i+2`) and its
 * parent (`(i-1)/2`) in BOTH panels (the arithmetic made visible). A swap lifts the
 * two tree nodes and the two array cells together (synchronous), and the whole
 * figure honors `prefers-reduced-motion` by snapping (no lift, no draw). Array
 * cells are keyed by their stable 0-based SLOT (not value), so on a swap a cell
 * morphs its value in place and the lift springs in sync with the tree node rather
 * than hard-cutting. Slot beats commit by tapping an array cell (>=44px); the
 * synced tree node lights, and selected/correct/fail cells carry an icon overlay
 * (never colour alone). The 0-based index ruler is always shown.
 */

export type SlotTone = "selected" | "correct" | "fail" | "nudge"

/**
 * The minimal prop contract a synced heap figure honours, shared by HeapDualView
 * and the ER triage skin so the replay stepper can swap figures via `renderFigure`.
 */
export interface HeapFigureProps {
  heap: number[]
  /** Slots highlighted (lilac) in both panels: the question subject / family / replay pair. */
  highlightSlots?: number[]
  /** Two slots to lift together (a swap, synchronous in both panels). */
  liftPair?: SwapStep | null
  /** Subject slot whose `2i+1 / 2i+2 / (i-1)/2` connectors are drawn in both panels. */
  connectorSlot?: number | null
  reducedMotion?: boolean
  srLabel?: string
  className?: string
}

export type HeapFigureRenderer = (props: HeapFigureProps) => ReactNode

const ARRAY_SURFACE: Record<SlotTone, string> = {
  selected: "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15",
  correct: "border-success bg-success-soft",
  fail: "border-danger bg-danger-soft",
  nudge: "border-warning bg-warning-soft",
}

/** A small corner badge so a cell's verdict reads without relying on colour. */
function SlotBadge({ tone }: { tone: SlotTone }) {
  if (tone === "correct") {
    return (
      <span
        data-testid="heap-cell-icon"
        className="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-success text-white"
      >
        <Check className="size-2.5" strokeWidth={3.5} />
      </span>
    )
  }
  if (tone === "fail" || tone === "nudge") {
    return (
      <span
        data-testid="heap-cell-icon"
        className={cn(
          "absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full text-white",
          tone === "fail" ? "bg-danger" : "bg-warning",
        )}
      >
        <X className="size-2.5" strokeWidth={3.5} />
      </span>
    )
  }
  return (
    <span
      data-testid="heap-cell-icon"
      aria-hidden
      className="absolute right-0.5 top-0.5 flex size-3.5 items-center justify-center rounded-full bg-lilac"
    >
      <span className="size-1.5 rounded-full bg-lilac-foreground" />
    </span>
  )
}

export function HeapDualView({
  heap,
  highlightSlots = [],
  /** A tree-only highlight (the "same data" beat lights a node; the learner finds its cell). */
  treeSlot = null,
  connectorSlot = null,
  liftPair = null,
  /** The learner's tapped slot (slot beats). */
  selectedSlot = null,
  selectedTone = "selected",
  /** When set, paint this slot green (the revealed answer). */
  revealSlot = null,
  /** The correct slot: exposes a DEV-only test hook on its cell (slot beats). */
  correctSlot = null,
  onTapSlot,
  reducedMotion,
  srLabel,
  className,
}: HeapFigureProps & {
  treeSlot?: number | null
  selectedSlot?: number | null
  selectedTone?: SlotTone
  revealSlot?: number | null
  correctSlot?: number | null
  onTapSlot?: (index: number) => void
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const n = heap.length
  const svgH = treeHeight(n)
  const nodes = nodePositions(n)

  const lifted = (i: number): boolean => liftPair != null && (liftPair.a === i || liftPair.b === i)

  // Family edges (subject → children / parent) light up; the rest stay faint.
  const familyEdge = (child: number): boolean =>
    connectorSlot != null && (parentIndex(child) === connectorSlot || child === connectorSlot)

  const slotTone = (i: number): SlotTone | "highlight" | null => {
    if (revealSlot === i) return "correct"
    if (selectedSlot === i) return selectedTone
    if (highlightSlots.includes(i) || connectorSlot === i) return "highlight"
    return null
  }

  const rowWidth = arrayRowWidth(n)

  // The connectors drawn in the ARRAY panel for the subject slot (children + parent).
  const arcTargets: number[] = []
  if (connectorSlot != null) {
    const l = leftIndex(connectorSlot)
    const r = rightIndex(connectorSlot)
    if (l < n) arcTargets.push(l)
    if (r < n) arcTargets.push(r)
    if (connectorSlot > 0) arcTargets.push(parentIndex(connectorSlot))
  }

  return (
    <div
      data-testid="heap-dual-view"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex w-full max-w-[360px] flex-col gap-3 lg:max-w-[460px]", className)}
    >
      {/* ----------------------------- tree panel ----------------------------- */}
      <svg
        viewBox={`0 0 ${W} ${svgH}`}
        className="w-full"
        style={{ height: "auto" }}
        role="img"
        aria-hidden
      >
        {/* edges (parent → child), family edges lit */}
        {nodes.map((node) => {
          if (node.i === 0) return null
          const p = nodes[parentIndex(node.i)]
          return (
            <line
              key={`edge-${node.i}`}
              x1={p.cx}
              y1={p.cy}
              x2={node.cx}
              y2={node.cy}
              stroke={familyEdge(node.i) ? "var(--lilac-strong)" : "var(--border)"}
              strokeWidth={familyEdge(node.i) ? 2.5 : 1.5}
            />
          )
        })}

        {nodes.map((node) => {
          const tone = slotTone(node.i)
          const treeLit = tone != null || treeSlot === node.i
          const isCorrect = tone === "correct"
          const isFail = tone === "fail"
          const isNudge = tone === "nudge"
          const fill = isCorrect
            ? "var(--success-soft)"
            : isFail
              ? "var(--danger-soft)"
              : isNudge
                ? "var(--warning-soft)"
                : treeLit
                  ? "var(--lilac-soft)"
                  : "var(--card)"
          const stroke = isCorrect
            ? "var(--success)"
            : isFail
              ? "var(--danger)"
              : isNudge
                ? "var(--warning)"
                : treeLit
                  ? "var(--lilac-strong)"
                  : "var(--border)"
          return (
            <motion.g
              key={`node-${node.i}`}
              data-testid="heap-node"
              data-slot={node.i}
              data-lit={treeLit ? "1" : undefined}
              data-lifted={lifted(node.i) ? "1" : undefined}
              animate={{ y: lifted(node.i) && !reduced ? -7 : 0 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24 }}
            >
              <circle cx={node.cx} cy={node.cy} r={NODE_R} fill={fill} stroke={stroke} strokeWidth={2.5} />
              <text
                x={node.cx}
                y={node.cy + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="var(--foreground)"
              >
                {heap[node.i]}
              </text>
              <text
                x={node.cx}
                y={node.cy + NODE_R + 11}
                textAnchor="middle"
                fontSize="9"
                fill="var(--faint)"
              >
                {node.i}
              </text>
              {node.i === 0 && (
                <text
                  x={node.cx}
                  y={node.cy - NODE_R - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="var(--lilac-strong)"
                >
                  TOP
                </text>
              )}
            </motion.g>
          )
        })}
      </svg>

      <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        same data
      </p>

      {/* ----------------------------- array panel ---------------------------- */}
      {/* `overflow-x-auto` + `mx-auto`: centers when it fits, scrolls a wide (7-cell)
          strip instead of clipping it past the 360px wrapper (LAYOUT guard). */}
      <div className="w-full overflow-x-auto">
        <div className="relative mx-auto" style={{ width: rowWidth }}>
          {/* drawn index connectors (children + parent) above the strip */}
          <svg
            width={rowWidth}
            height={BAND_H}
            className="pointer-events-none block"
            aria-hidden
          >
            {arcTargets.map((t) => {
              const x1 = cellCenter(connectorSlot as number)
              const x2 = cellCenter(t)
              const mid = (x1 + x2) / 2
              const apex = Math.max(2, BAND_H - 6 - Math.abs(x2 - x1) * 0.12)
              return (
                <path
                  key={`arc-${t}`}
                  data-testid="heap-connector"
                  d={`M ${x1} ${BAND_H} Q ${mid} ${apex} ${x2} ${BAND_H}`}
                  fill="none"
                  stroke="var(--lilac-strong)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          <div className="flex" style={{ gap: GAP }}>
            {heap.map((v, i) => {
              const tone = slotTone(i)
              const badgeTone: SlotTone | null =
                tone === "correct" || tone === "fail" || tone === "selected" || tone === "nudge"
                  ? tone
                  : null
              const toneClass = badgeTone
                ? ARRAY_SURFACE[badgeTone]
                : tone === "highlight"
                  ? "border-lilac-strong bg-lilac-soft"
                  : "border-border bg-card"
              return (
                <motion.button
                  key={`slot-${i}`}
                  type="button"
                  data-testid="heap-cell"
                  data-slot={i}
                  data-lit={tone != null ? "1" : undefined}
                  data-lifted={lifted(i) ? "1" : undefined}
                  data-heap-correct-slot={
                    import.meta.env.DEV && correctSlot === i ? String(i) : undefined
                  }
                  disabled={!onTapSlot}
                  onClick={() => onTapSlot?.(i)}
                  aria-label={`slot ${i}, value ${v}`}
                  animate={{ y: lifted(i) && !reduced ? -7 : 0 }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24 }}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg border-2 font-bold text-foreground outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    onTapSlot ? "cursor-pointer" : "cursor-default",
                    toneClass,
                  )}
                  style={{ width: CELL, height: CELL }}
                >
                  <span className="text-[15px] leading-none">{v}</span>
                  <span className="mt-0.5 text-[9px] font-medium leading-none text-faint">{i}</span>
                  {badgeTone && <SlotBadge tone={badgeTone} />}
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      {srLabel && (
        <p className="sr-only" role="status">
          {srLabel}
        </p>
      )}
    </div>
  )
}
