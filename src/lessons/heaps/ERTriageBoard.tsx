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
 * The ER triage real-life skin of the heap figure, dressed as a hospital triage
 * MONITOR (always clinical-dark, like the Spotify queue is always dark). It is the
 * SAME dual tree+array view as HeapDualView (it reuses `heapLayout`, so the index
 * map is byte-for-byte identical): each tree node is a patient card placed by
 * `nodePositions`, the parent->child edges are an SVG layer behind the cards, and
 * the index-ruled "intake list" (the packed array) stays ALWAYS visible beneath.
 * The root is tagged MOST URGENT (the max-heap promise, in plain language).
 *
 * Presentational only: it reads `heap` plus a few highlight/lift hints and NEVER
 * computes correctness (severities are the distinct keys, so the sift path is
 * already unique). It honours the same sync contract as HeapDualView
 * (highlightSlots, liftPair, connectorSlot, reducedMotion, srLabel) and snaps to
 * the end-state under reduced motion.
 */

const CARD_W = 76
const CARD_H = 48

/** Shared patient-icon map (also used by the monitor's SEEN NEXT banner). */
export const PATIENT_ICON: Record<PatientIcon, LucideIcon> = {
  heart: Heart,
  activity: Activity,
  bone: Bone,
  thermometer: Thermometer,
  stethoscope: Stethoscope,
  pill: Pill,
  bandage: Bandage,
  brain: Brain,
}

// Clinical monitor palette (hardcoded so the figure stays dark in any app theme).
const EDGE_FAINT = "rgba(148,163,184,0.30)"
const EDGE_FAMILY = "#5eead4"
const CONNECTOR = "#5eead4"

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
      className={cn("mx-auto flex w-full max-w-[360px] flex-col gap-2.5", className)}
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
                  stroke={familyEdge(node.i) ? EDGE_FAMILY : EDGE_FAINT}
                  strokeWidth={familyEdge(node.i) ? 2.5 : 1.5}
                />
              )
            })}
          </svg>

          {nodes.map((node) => {
            const patient = patientFor(heap[node.i], heap)
            const Glyph = PATIENT_ICON[patient.icon]
            const isRoot = node.i === 0
            const on = lit(node.i)
            return (
              <motion.div
                key={`card-${node.i}`}
                data-testid="triage-card"
                data-slot={node.i}
                data-lit={on ? "1" : undefined}
                data-lifted={lifted(node.i) ? "1" : undefined}
                aria-hidden
                animate={{ y: lifted(node.i) && !reduced ? -7 : 0 }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24 }}
                className={cn(
                  "absolute flex items-stretch overflow-hidden rounded-lg border bg-white/[0.04] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.6)] backdrop-blur-sm",
                  on ? "border-teal-300 ring-2 ring-teal-300/30" : "border-white/10",
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
                    <span className="text-[15px] font-bold leading-none text-white">
                      {patient.severity}
                    </span>
                  </span>
                  <span className="mt-0.5 truncate text-[8px] font-medium leading-tight text-slate-400">
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
                <span className="absolute bottom-0 right-0.5 text-[7px] font-medium leading-none text-slate-500">
                  {node.i}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>

      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Intake list · packed array
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
                  stroke={CONNECTOR}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          <div className="flex" style={{ gap: GAP }}>
            {heap.map((v, i) => {
              const patient = patientFor(v, heap)
              const on = lit(i)
              return (
                <motion.div
                  key={`slot-${i}`}
                  data-testid="triage-cell"
                  data-slot={i}
                  data-value={v}
                  data-lit={on ? "1" : undefined}
                  data-lifted={lifted(i) ? "1" : undefined}
                  aria-hidden
                  animate={{ y: lifted(i) && !reduced ? -7 : 0 }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24 }}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg border font-bold text-white transition-colors",
                    on ? "border-teal-300 bg-teal-400/10" : "border-white/10 bg-white/[0.04]",
                  )}
                  style={{ width: CELL, height: CELL }}
                >
                  <span
                    className="absolute left-0.5 top-0.5 size-1.5 rounded-full"
                    style={{ backgroundColor: patient.accent }}
                  />
                  <span className="text-[15px] leading-none text-slate-50">{v}</span>
                  <span className="mt-0.5 text-[9px] font-medium leading-none text-slate-500">{i}</span>
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
