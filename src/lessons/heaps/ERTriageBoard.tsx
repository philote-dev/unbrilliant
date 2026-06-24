import {
  Activity,
  Bandage,
  Bone,
  Brain,
  Heart,
  Pill,
  Stethoscope,
  Thermometer,
  type LucideIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { parentIndex, leftIndex, rightIndex } from "@/features/lesson/heapsEngine"
import {
  BAND_H,
  CELL,
  GAP,
  W,
  arrayRowWidth,
  cellCenter,
  nodePositions,
  treeHeight,
} from "./heapLayout"
import { patientFor, type PatientIcon } from "./triagePatients"
import type { HeapFigureProps } from "./HeapDualView"

/**
 * The ER triage real-life skin of the heap figure: the SAME dual tree+array view
 * as HeapDualView (it reuses `heapLayout`, so the index map is byte-for-byte
 * identical), re-dressed as a hospital triage board. Each tree node becomes a
 * patient card placed by `nodePositions`, the parent->child edges are an SVG layer
 * behind the cards, and the index-ruled array strip stays ALWAYS visible beneath
 * (the "it's secretly an array" idea). The root is tagged MOST URGENT. The
 * max-heap promise, in plain language.
 *
 * Presentational only: it reads `heap` and a couple of highlight/lift hints and
 * NEVER computes correctness (severities are the distinct keys, so the sift path
 * is already unique). It honours the same sync contract as HeapDualView
 * (highlightSlots, liftPair, connectorSlot, reducedMotion, srLabel) and snaps to
 * the end-state under reduced motion.
 */

const CARD_W = 72
const CARD_H = 46

const ICON: Record<PatientIcon, LucideIcon> = {
  heart: Heart,
  activity: Activity,
  bone: Bone,
  thermometer: Thermometer,
  stethoscope: Stethoscope,
  pill: Pill,
  bandage: Bandage,
  brain: Brain,
}

export function ERTriageBoard({
  heap,
  highlightSlots = [],
  liftPair = null,
  connectorSlot = null,
  reducedMotion,
  srLabel,
  className,
}: HeapFigureProps) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const n = heap.length
  const svgH = treeHeight(n)
  const nodes = nodePositions(n)

  const lit = (i: number): boolean => highlightSlots.includes(i) || connectorSlot === i
  const lifted = (i: number): boolean => liftPair != null && (liftPair.a === i || liftPair.b === i)
  const familyEdge = (child: number): boolean =>
    connectorSlot != null && (parentIndex(child) === connectorSlot || child === connectorSlot)

  const rowWidth = arrayRowWidth(n)

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
      data-testid="er-triage-board"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex w-full max-w-[360px] flex-col gap-3", className)}
    >
      {/* ----------------------------- triage tree ---------------------------- */}
      <div className="w-full overflow-x-auto">
        <div className="relative mx-auto" style={{ width: W, height: svgH }}>
          <svg
            viewBox={`0 0 ${W} ${svgH}`}
            width={W}
            height={svgH}
            className="absolute inset-0"
            aria-hidden
          >
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
          </svg>

          {nodes.map((node) => {
            const patient = patientFor(heap[node.i], heap)
            const Glyph = ICON[patient.icon]
            const isRoot = node.i === 0
            return (
              <motion.div
                key={`card-${node.i}`}
                data-testid="triage-card"
                data-slot={node.i}
                data-lit={lit(node.i) ? "1" : undefined}
                data-lifted={lifted(node.i) ? "1" : undefined}
                aria-hidden
                animate={{ y: lifted(node.i) && !reduced ? -7 : 0 }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24 }}
                className={cn(
                  "absolute flex items-stretch overflow-hidden rounded-lg border-2 bg-card shadow-soft",
                  lit(node.i) ? "border-lilac-strong ring-4 ring-lilac-strong/15" : "border-border",
                )}
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  left: node.cx - CARD_W / 2,
                  top: node.cy - CARD_H / 2,
                }}
              >
                <span className="w-1 shrink-0" style={{ backgroundColor: patient.accent }} />
                <span className="flex min-w-0 flex-1 flex-col justify-center px-1.5 py-1">
                  <span className="flex items-center gap-1">
                    <Glyph className="size-3 shrink-0" style={{ color: patient.accent }} />
                    <span className="text-[15px] font-bold leading-none text-foreground">
                      {patient.severity}
                    </span>
                  </span>
                  <span className="mt-0.5 truncate text-[8px] font-medium leading-tight text-muted-foreground">
                    {patient.name} · L{patient.level}
                  </span>
                </span>
                {isRoot && (
                  <span
                    className="absolute -top-px left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-t-md px-1.5 py-px text-[7px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: patient.accent }}
                  >
                    Most urgent
                  </span>
                )}
                <span className="absolute bottom-0 right-0.5 text-[7px] font-medium leading-none text-faint">
                  {node.i}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>

      <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        the board is an array
      </p>

      {/* ----------------------- board log (the array) ------------------------ */}
      <div className="w-full overflow-x-auto">
        <div className="relative mx-auto" style={{ width: rowWidth }}>
          <svg width={rowWidth} height={BAND_H} className="pointer-events-none block" aria-hidden>
            {arcTargets.map((t) => {
              const x1 = cellCenter(connectorSlot as number)
              const x2 = cellCenter(t)
              const mid = (x1 + x2) / 2
              const apex = Math.max(2, BAND_H - 6 - Math.abs(x2 - x1) * 0.12)
              return (
                <path
                  key={`arc-${t}`}
                  data-testid="triage-connector"
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
              const patient = patientFor(v, heap)
              return (
                <motion.div
                  key={`slot-${i}`}
                  data-testid="triage-cell"
                  data-slot={i}
                  data-value={v}
                  data-lit={lit(i) ? "1" : undefined}
                  data-lifted={lifted(i) ? "1" : undefined}
                  aria-hidden
                  animate={{ y: lifted(i) && !reduced ? -7 : 0 }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24 }}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg border-2 font-bold text-foreground transition-colors",
                    lit(i) ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
                  )}
                  style={{ width: CELL, height: CELL }}
                >
                  <span
                    className="absolute left-0.5 top-0.5 size-1.5 rounded-full"
                    style={{ backgroundColor: patient.accent }}
                  />
                  <span className="text-[15px] leading-none">{v}</span>
                  <span className="mt-0.5 text-[9px] font-medium leading-none text-faint">{i}</span>
                </motion.div>
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
