import type { ReactNode } from "react"
import { Check, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { leftIndex, parentIndex, rightIndex, type SwapStep } from "@/features/lesson/heapsEngine"
import {
  BAND_H,
  CELL,
  GAP,
  NODE_R,
  W,
  arrayRowWidth,
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
 * The signature motion is a TRAVELING-NODE sift: each node is keyed by its VALUE
 * identity (distinct keys), so when the `heap` changes (a swap) the node physically
 * travels between its old and new slot with a spring. The tree node and the array
 * cell for the same value both key off that value and react to the same `heap`
 * change at the same time, so they travel in sync across the two panels. Addresses
 * are fixed: the tree edges, the 0-based index ruler, and the slot labels stay put
 * while the values move over them (values move between addresses, addresses do not
 * move). Extract reads as the root leaving (its node fades out) and the last leaf
 * arriving at the root (it travels up). `prefers-reduced-motion` snaps every path:
 * no travel, no fade, just the final arrangement.
 *
 * Selecting a slot draws faint connectors to its children (`2i+1`/`2i+2`) and its
 * parent (`(i-1)/2`) in BOTH panels (the arithmetic made visible). Slot beats commit
 * by tapping an array cell (>=44px); do-the-sift beats also accept a tap on the tree
 * node (`onTapNode`). The synced tree node lights, and selected/correct/fail cells
 * carry an icon overlay (never colour alone).
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
  /**
   * A swap pair to emphasize together. HeapDualView now travels nodes by VALUE off
   * the `heap` prop and ignores this; the ER triage skin still uses it to lift. Kept
   * on the shared contract so both figures honour the same replay props.
   */
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
  /** The learner's tapped slot (slot + do-the-sift beats). */
  selectedSlot = null,
  selectedTone = "selected",
  /** When set, paint this slot green (the revealed answer). */
  revealSlot = null,
  /** The correct slot: exposes a DEV-only test hook on its cell (slot beats). */
  correctSlot = null,
  /** The next correct do-the-sift swap: a DEV-only automation hook (never visible). */
  siftPair = null,
  /** A tighter layout (shorter tree) for predict beats, so the cards sit higher. */
  compact = false,
  onTapSlot,
  onTapNode,
  reducedMotion,
  srLabel,
  className,
}: HeapFigureProps & {
  treeSlot?: number | null
  selectedSlot?: number | null
  selectedTone?: SlotTone
  revealSlot?: number | null
  correctSlot?: number | null
  siftPair?: SwapStep | null
  compact?: boolean
  onTapSlot?: (index: number) => void
  /** Tap a TREE node (do-the-sift only). Slot beats leave this off so the index
   * math is computed in the array, not traced from the tree. */
  onTapNode?: (index: number) => void
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const spring = reduced
    ? ({ duration: 0 } as const)
    : ({ type: "spring", stiffness: 360, damping: 26 } as const)

  const n = heap.length
  const layout = compact ? { rowH: 50, padTop: 14, nodeR: 15 } : undefined
  const nodeR = compact ? 15 : NODE_R
  const svgH = treeHeight(n, layout)
  const nodes = nodePositions(n, layout)

  // The array strip scales to fit its wrapper rather than scrolling once the heap
  // is wide (a 7-cell strip overruns the phone): small heaps stay at the full 44px
  // tap size, and only an oversized row shrinks, so every cell stays on screen.
  const MAX_ROW = 340
  const fit = Math.min(1, MAX_ROW / arrayRowWidth(n))
  const cell = Math.floor(CELL * fit)
  const gap = Math.floor(GAP * fit)
  const cellMid = (i: number): number => i * (cell + gap) + cell / 2
  const cellLeft = (i: number): number => i * (cell + gap)
  const rowWidth = n * cell + Math.max(0, n - 1) * gap

  // Family edges (subject → children / parent) light up; the rest stay faint.
  const familyEdge = (child: number): boolean =>
    connectorSlot != null && (parentIndex(child) === connectorSlot || child === connectorSlot)

  const slotTone = (i: number): SlotTone | "highlight" | null => {
    if (revealSlot === i) return "correct"
    if (selectedSlot === i) return selectedTone
    if (highlightSlots.includes(i) || connectorSlot === i) return "highlight"
    return null
  }

  // The connectors drawn in the ARRAY panel for the subject slot (children + parent).
  const arcTargets: number[] = []
  if (connectorSlot != null) {
    const l = leftIndex(connectorSlot)
    const r = rightIndex(connectorSlot)
    if (l < n) arcTargets.push(l)
    if (r < n) arcTargets.push(r)
    if (connectorSlot > 0) arcTargets.push(parentIndex(connectorSlot))
  }

  const DEV = import.meta.env.DEV

  // Render nodes in a STABLE DOM order (by value), positioning each to its current
  // slot via a transform. Keeping the DOM order fixed (rather than re-ordering by
  // slot every frame) is what lets Motion spring each node cleanly to its new slot:
  // reordering keyed children moves DOM nodes, which strands their in-flight travel.
  const slotByValue = new Map(heap.map((v, i) => [v, i]))
  const ordered = [...heap].sort((a, b) => a - b)

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
        {/* FIXED structure: edges + the address labels stay put while values travel. */}
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
        {nodes.map((node) => (
          <g key={`addr-${node.i}`} aria-hidden>
            <text
              x={node.cx}
              y={node.cy + nodeR + 11}
              textAnchor="middle"
              fontSize="9"
              fill="var(--faint)"
            >
              {node.i}
            </text>
            {node.i === 0 && (
              <text
                x={node.cx}
                y={node.cy - nodeR - 6}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="var(--lilac-strong)"
              >
                TOP
              </text>
            )}
          </g>
        ))}

        {/* TRAVELING values: keyed by value identity, so a swap springs each node
            between slots. The matching array cell keys off the same value below. */}
        <AnimatePresence initial={false}>
          {ordered.map((value) => {
            const slot = slotByValue.get(value) as number
            const pos = nodes[slot]
            const tone = slotTone(slot)
            const treeLit = tone != null || treeSlot === slot
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
            const tappable = onTapNode != null
            return (
              <motion.g
                key={`node-${value}`}
                data-testid="heap-node"
                data-slot={slot}
                data-lit={treeLit ? "1" : undefined}
                aria-hidden
                initial={{ opacity: 0, x: pos.cx, y: pos.cy }}
                animate={{ opacity: 1, x: pos.cx, y: pos.cy }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={spring}
                onClick={tappable ? () => onTapNode(slot) : undefined}
                style={{ cursor: tappable ? "pointer" : "default" }}
              >
                {tappable && <circle cx={0} cy={0} r={nodeR + 8} fill="transparent" />}
                <circle cx={0} cy={0} r={nodeR} fill={fill} stroke={stroke} strokeWidth={2.5} />
                <text
                  x={0}
                  y={5}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="700"
                  fill="var(--foreground)"
                >
                  {value}
                </text>
              </motion.g>
            )
          })}
        </AnimatePresence>
      </svg>

      <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        same data
      </p>

      {/* ----------------------------- array panel ---------------------------- */}
      {/* `mx-auto` centers the strip; the cell size already scales to fit the
          wrapper (see `fit` above), so a wide 7-cell heap shrinks to stay fully
          on screen rather than clipping or needing a horizontal scroll. */}
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
              const x1 = cellMid(connectorSlot as number)
              const x2 = cellMid(t)
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

          {/* TRAVELING cells: absolute + keyed by value, so a swap springs the cell
              across the fixed address ruler beneath (values move, addresses do not). */}
          <div className="relative" style={{ height: cell }}>
            <AnimatePresence initial={false}>
              {ordered.map((value) => {
                const slot = slotByValue.get(value) as number
                const tone = slotTone(slot)
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
                    key={`cell-${value}`}
                    type="button"
                    data-testid="heap-cell"
                    data-slot={slot}
                    data-lit={tone != null ? "1" : undefined}
                    data-heap-correct-slot={DEV && correctSlot === slot ? String(slot) : undefined}
                    data-sift-from={DEV && siftPair?.a === slot ? "1" : undefined}
                    data-sift-to={DEV && siftPair?.b === slot ? "1" : undefined}
                    disabled={!onTapSlot}
                    onClick={() => onTapSlot?.(slot)}
                    aria-label={`slot ${slot}, value ${value}`}
                    initial={{ opacity: 0, scale: 0.6, x: cellLeft(slot) }}
                    animate={{ opacity: 1, scale: 1, x: cellLeft(slot) }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={spring}
                    className={cn(
                      "absolute left-0 top-0 flex items-center justify-center rounded-lg border-2 font-bold text-foreground outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      onTapSlot ? "cursor-pointer" : "cursor-default",
                      toneClass,
                    )}
                    style={{ width: cell, height: cell }}
                  >
                    <span className="text-[15px] leading-none">{value}</span>
                    {badgeTone && <SlotBadge tone={badgeTone} />}
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>

          {/* FIXED address ruler: the 0-based slot index under each cell position. */}
          <div className="mt-1 flex" style={{ gap }} aria-hidden>
            {heap.map((_, i) => (
              <span
                key={`addr-${i}`}
                className="text-center text-[9px] font-medium leading-none text-faint"
                style={{ width: cell }}
              >
                {i}
              </span>
            ))}
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
