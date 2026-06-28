import type { CSSProperties } from "react"
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
import { useOptionalTheme } from "@/lib/theme"
import { parentIndex, leftIndex, rightIndex, type SwapStep } from "@/features/lesson/heapsEngine"
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
import { patientFor, triageTier, type PatientIcon, type TriageTierId } from "./triagePatients"
import type { HeapFigureProps, SlotTone } from "./HeapDualView"

/**
 * The ER triage real-life skin of the heap figure, dressed as a hospital triage
 * MONITOR. It is the SAME dual tree+array view as HeapDualView (it reuses
 * `heapLayout`, so the index map is byte-for-byte identical): each tree node is a
 * patient card placed by `nodePositions`, the parent->child edges are an SVG layer
 * behind the cards, and the index-ruled "intake list" (the packed array) stays
 * ALWAYS visible beneath. The root is tagged MOST URGENT (the max-heap promise, in
 * plain language).
 *
 * Theme-aware brand takeover. Unlike the fixed Spotify/metro skins it adapts to the
 * app theme, with white present in BOTH coats: light is white + red (white card
 * stock, clean clinical), dark is near-black + red (white still present in the type,
 * the hairlines, and the ambulance). `surface` forces a coat ("light" / "dark")
 * regardless of the app theme; "auto" follows it. The bold, signature red lives in
 * the MOST URGENT root tag (the severity IS the heap key); everything else stays
 * quiet and clinical. `accent` tints the held / lit emphasis (amber ambulance, teal
 * gown, rose bandaid) and `tier` shows patients by triage category instead of by a
 * severity-derived name (see triageTier).
 *
 * It mirrors HeapDualView's signature TRAVELING-NODE motion: each patient card and
 * each intake cell is keyed by its VALUE identity (the severity, which is the
 * distinct heap key), so when `heap` changes (a swap) the card and its cell travel
 * together from the old slot to the new one with a spring. Addresses stay put; the
 * patients move over them. `prefers-reduced-motion` snaps every path to the final
 * arrangement (no travel, no fade).
 *
 * Presentational only: it reads `heap` plus a few highlight/lift hints and NEVER
 * computes correctness (severities are the distinct keys, so the sift path is
 * already unique). Beyond the shared replay contract (highlightSlots, liftPair,
 * connectorSlot, reducedMotion, srLabel) it also takes the do-the-sift interaction
 * props (selectedSlot / selectedTone, siftPair, onTapSlot, onTapNode) so the ER
 * extract and the ER synthesis can be performed (tap a patient, then its target)
 * directly on the board, exactly like HeapDualView.
 */

const CARD_W = 76
const CARD_H = 48

/** Shared patient-icon map (also used by the monitor's banner). */
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

/** Which coat to paint: an explicit surface, else follow the app theme. */
export type ERSurface = "auto" | "light" | "dark"
/** The emphasis hue for held / lit patients (the variant's accent direction). */
export type ERAccent = "red" | "amber" | "teal" | "rose" | "sky"

type Mode = "light" | "dark"

interface ERPalette {
  ink: string
  sub: string
  addr: string
  cardBg: string
  cellBg: string
  border: string
  edgeFaint: string
  ringOffset: string
  /** The ER red: the MOST URGENT tag + the most-urgent root highlight. */
  urgent: string
  /** A faint red wash for the most-urgent root card / cell. */
  rootFill: string
}

const PALETTE: Record<Mode, ERPalette> = {
  light: {
    ink: "#0f1115",
    sub: "#6b7280",
    addr: "#9aa3af",
    cardBg: "#ffffff",
    cellBg: "#ffffff",
    border: "#e3e7ee",
    edgeFaint: "rgba(15,17,21,0.14)",
    ringOffset: "#ffffff",
    urgent: "#e5343a",
    rootFill: "#fff1f1",
  },
  dark: {
    ink: "#e6e8ec",
    sub: "#8b93a3",
    addr: "#6b7280",
    cardBg: "#11151c",
    cellBg: "#0f141c",
    border: "#232831",
    edgeFaint: "rgba(148,163,184,0.30)",
    ringOffset: "#0b0d12",
    urgent: "#fb5a60",
    rootFill: "#241317",
  },
}

const ACCENT_HEX: Record<ERAccent, Record<Mode, string>> = {
  red: { light: "#e5343a", dark: "#fb5a60" },
  amber: { light: "#f59e0b", dark: "#fbbf24" },
  teal: { light: "#0d9488", dark: "#2dd4bf" },
  rose: { light: "#db5c83", dark: "#fb7faa" },
  sky: { light: "#0ea5e9", dark: "#7dd3fc" },
}

/** A wrong move's caution hue: orange in both coats, distinct from every accent. */
const NUDGE_HEX: Record<Mode, string> = { light: "#ea580c", dark: "#fb923c" }

/** Themed triage-tier colours (real-world red / amber / teal banding). */
const TIER_HEX: Record<TriageTierId, Record<Mode, string>> = {
  critical: { light: "#e5343a", dark: "#fb5a60" },
  serious: { light: "#d97706", dark: "#fbbf24" },
  stable: { light: "#0d9488", dark: "#2dd4bf" },
}

/** Mix a hex with an alpha (00..ff) for faint fills / rings. */
const alpha = (hex: string, a: string): string => `${hex}${a}`

export function ERTriageBoard({
  heap,
  highlightSlots = [],
  liftPair = null,
  connectorSlot = null,
  /** The learner's held patient (do-the-sift): lit with the selected/nudge tone. */
  selectedSlot = null,
  selectedTone = "selected",
  /** The next correct do-the-sift swap: a DEV-only automation hook (never visible). */
  siftPair = null,
  /** Tap an intake cell (do-the-sift). */
  onTapSlot,
  /** Tap a patient card (do-the-sift). */
  onTapNode,
  /** Which coat to paint. Defaults to "dark" (the legacy clinical monitor). */
  surface = "dark",
  /** Emphasis hue for held / lit patients. */
  accent = "sky",
  /** Show patients by triage tier (Critical / Serious / Stable) instead of by name. */
  tier = false,
  /** Render the quiet one-line caption explaining the numbers are triage severity. */
  scaleNote = true,
  reducedMotion,
  srLabel,
  className,
}: HeapFigureProps & {
  selectedSlot?: number | null
  selectedTone?: SlotTone
  siftPair?: SwapStep | null
  onTapSlot?: (index: number) => void
  onTapNode?: (index: number) => void
  surface?: ERSurface
  accent?: ERAccent
  tier?: boolean
  scaleNote?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const appTheme = useOptionalTheme()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const mode: Mode = surface === "light" || surface === "dark" ? surface : appTheme
  const pal = PALETTE[mode]
  const accentHex = ACCENT_HEX[accent][mode]
  const nudgeHex = NUDGE_HEX[mode]
  const spring = reduced
    ? ({ duration: 0 } as const)
    : ({ type: "spring", stiffness: 360, damping: 22 } as const)

  const n = heap.length
  const svgH = treeHeight(n)
  const nodes = nodePositions(n)
  const rowWidth = arrayRowWidth(n)

  // Travel by VALUE identity: a stable DOM order (sorted by value) with each node
  // positioned to its current slot via a transform, so a swap springs it cleanly
  // (re-ordering keyed children would strand the in-flight travel).
  const slotByValue = new Map(heap.map((v, i) => [v, i]))
  const ordered = [...heap].sort((a, b) => a - b)

  const lit = (i: number): boolean => highlightSlots.includes(i) || connectorSlot === i
  const lifted = (i: number): boolean => liftPair != null && (liftPair.a === i || liftPair.b === i)
  const familyEdge = (child: number): boolean =>
    connectorSlot != null && (parentIndex(child) === connectorSlot || child === connectorSlot)

  /** A slot's emphasis tone: the held selection wins, then a highlight / connector. */
  const toneOf = (i: number): "selected" | "nudge" | "lit" | null => {
    if (selectedSlot === i) return selectedTone === "nudge" ? "nudge" : "selected"
    if (lit(i)) return "lit"
    return null
  }
  /** The hex a tone paints with (held / lit use the accent, a wrong move is caution). */
  const toneHex = (tone: "selected" | "nudge" | "lit"): string =>
    tone === "nudge" ? nudgeHex : accentHex

  /** A patient's left-rail colour: the triage tier, or the level accent. */
  const railColor = (level: number, severityAccent: string): string =>
    tier ? TIER_HEX[triageTier(level).id][mode] : severityAccent

  const arcTargets: number[] = []
  if (connectorSlot != null) {
    const l = leftIndex(connectorSlot)
    const r = rightIndex(connectorSlot)
    if (l < n) arcTargets.push(l)
    if (r < n) arcTargets.push(r)
    if (connectorSlot > 0) arcTargets.push(parentIndex(connectorSlot))
  }

  const cellLeft = (i: number): number => i * (CELL + GAP)
  const DEV = import.meta.env.DEV

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
            {/* FIXED structure: edges stay put while the patient cards travel over them. */}
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
                  stroke={familyEdge(node.i) ? accentHex : pal.edgeFaint}
                  strokeWidth={familyEdge(node.i) ? 2.5 : 1.5}
                />
              )
            })}
          </svg>

          {/* TRAVELING patient cards: keyed by value, positioned to the current slot. */}
          {ordered.map((value) => {
            const slot = slotByValue.get(value) as number
            const node = nodes[slot]
            const patient = patientFor(value, heap)
            const Glyph = PATIENT_ICON[patient.icon]
            const isRoot = slot === 0
            const tone = toneOf(slot)
            const on = tone != null
            const isLifted = lifted(slot)
            const rail = railColor(patient.level, patient.accent)
            const tierLabel = triageTier(patient.level).label
            const targetX = node.cx - CARD_W / 2
            const targetY = node.cy - CARD_H / 2 - (isLifted && !reduced ? 11 : 0)
            // The most-urgent root carries a persistent red highlight (the heap's
            // top-only promise made visible), unless an active tone overrides it.
            // Every other card is colour-coded by its triage tier (Critical red,
            // Serious amber, Stable teal) via its border + a faint matching ring, so
            // the tier reads across the whole board while the root stays the boldest.
            const rootHi = isRoot && !on
            const tierCoded = tier && !on && !rootHi
            const dropShadow =
              mode === "light"
                ? "0 1px 3px rgba(16,18,24,0.08)"
                : "0 2px 10px -4px rgba(0,0,0,0.6)"
            const cardStyle: CSSProperties = {
              width: CARD_W,
              height: CARD_H,
              backgroundColor: rootHi ? pal.rootFill : pal.cardBg,
              borderColor: on ? toneHex(tone) : rootHi ? pal.urgent : tierCoded ? rail : pal.border,
              boxShadow: on
                ? `0 0 0 2px ${alpha(toneHex(tone), "33")}`
                : rootHi
                  ? `0 0 0 1.5px ${alpha(pal.urgent, "30")}`
                  : tierCoded
                    ? `0 0 0 1px ${alpha(rail, mode === "light" ? "33" : "44")}, ${dropShadow}`
                    : dropShadow,
            }
            return (
              <motion.div
                key={`card-${value}`}
                data-testid="triage-card"
                data-slot={slot}
                data-value={value}
                data-root={isRoot ? "1" : undefined}
                data-lit={on ? "1" : undefined}
                data-lifted={isLifted ? "1" : undefined}
                data-tone={tone ?? undefined}
                aria-hidden
                onClick={onTapNode ? () => onTapNode(slot) : undefined}
                initial={reduced ? false : { opacity: 0, scale: 0.85, x: targetX, y: targetY }}
                animate={{
                  opacity: 1,
                  x: targetX,
                  y: targetY,
                  scale: isLifted && !reduced ? 1.05 : 1,
                }}
                transition={spring}
                className={cn(
                  "absolute left-0 top-0 flex items-stretch overflow-hidden rounded-lg border",
                  onTapNode && "cursor-pointer",
                )}
                style={cardStyle}
              >
                <span className="w-1 shrink-0" style={{ backgroundColor: rail }} />
                <span className="flex min-w-0 flex-1 flex-col justify-center px-1.5 py-1">
                  <span className="flex items-center gap-1">
                    {tier ? (
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: rail }}
                      />
                    ) : (
                      <Glyph className="size-3 shrink-0" style={{ color: rail }} />
                    )}
                    <span
                      className="text-[15px] font-bold leading-none"
                      style={{ color: pal.ink }}
                    >
                      {patient.severity}
                    </span>
                  </span>
                  <span
                    className="mt-0.5 truncate text-[8px] font-medium leading-tight"
                    style={{ color: pal.sub }}
                  >
                    {tier ? `${tierLabel} · P${patient.level}` : `${patient.name} · L${patient.level}`}
                  </span>
                </span>
                {isRoot && (
                  <span
                    className="absolute -top-px left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-t-md px-1.5 py-px text-[7px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: pal.urgent }}
                  >
                    Most urgent
                  </span>
                )}
                <span
                  className="absolute bottom-0 right-0.5 text-[7px] font-medium leading-none"
                  style={{ color: pal.addr }}
                >
                  {slot}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Quiet number-context: what the values mean, once, no legend. */}
      <div className="flex flex-col items-center gap-0.5">
        {scaleNote && (
          <p className="text-center text-[10px] font-medium tracking-wide" style={{ color: pal.sub }}>
            Each number is a triage severity · higher is more urgent
          </p>
        )}
        <p
          className="text-center text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: pal.addr }}
        >
          Intake list · packed array
        </p>
      </div>

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
                  stroke={accentHex}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {/* TRAVELING intake cells: absolute + keyed by value, springing across the
              fixed slot positions beneath (values move, addresses do not). */}
          <div className="relative" style={{ height: CELL }}>
            {ordered.map((value) => {
              const slot = slotByValue.get(value) as number
              const patient = patientFor(value, heap)
              const tone = toneOf(slot)
              const on = tone != null
              const isLifted = lifted(slot)
              const isRoot = slot === 0
              const rootHi = isRoot && !on
              const tierCoded = tier && !on && !rootHi
              const rail = railColor(patient.level, patient.accent)
              const cellStyle: CSSProperties = {
                width: CELL,
                height: CELL,
                backgroundColor: on
                  ? alpha(toneHex(tone), "1f")
                  : rootHi
                    ? pal.rootFill
                    : tierCoded
                      ? alpha(rail, mode === "light" ? "12" : "1f")
                      : pal.cellBg,
                borderColor: on ? toneHex(tone) : rootHi ? pal.urgent : tierCoded ? rail : pal.border,
                // Ring colours for the focus-visible state (Tailwind reads these vars).
                ["--tw-ring-color" as string]: accentHex,
                ["--tw-ring-offset-color" as string]: pal.ringOffset,
              }
              return (
                <motion.button
                  key={`slot-${value}`}
                  type="button"
                  data-testid="triage-cell"
                  data-slot={slot}
                  data-value={value}
                  data-root={isRoot ? "1" : undefined}
                  data-lit={on ? "1" : undefined}
                  data-lifted={isLifted ? "1" : undefined}
                  data-tone={tone ?? undefined}
                  data-sift-from={DEV && siftPair?.a === slot ? "1" : undefined}
                  data-sift-to={DEV && siftPair?.b === slot ? "1" : undefined}
                  aria-hidden={onTapSlot ? undefined : true}
                  aria-label={onTapSlot ? `slot ${slot}, value ${value}` : undefined}
                  disabled={!onTapSlot}
                  onClick={() => onTapSlot?.(slot)}
                  initial={reduced ? false : { opacity: 0, scale: 0.6, x: cellLeft(slot) }}
                  animate={{
                    opacity: 1,
                    x: cellLeft(slot),
                    y: isLifted && !reduced ? -11 : 0,
                    scale: isLifted && !reduced ? 1.07 : 1,
                  }}
                  transition={spring}
                  className={cn(
                    "absolute left-0 top-0 flex flex-col items-center justify-center rounded-lg border font-bold outline-none transition-colors",
                    onTapSlot
                      ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2"
                      : "cursor-default",
                  )}
                  style={cellStyle}
                >
                  <span
                    className="absolute left-0.5 top-0.5 size-1.5 rounded-full"
                    style={{ backgroundColor: rail }}
                  />
                  <span className="text-[15px] leading-none" style={{ color: pal.ink }}>
                    {value}
                  </span>
                  <span
                    className="mt-0.5 text-[9px] font-medium leading-none"
                    style={{ color: pal.addr }}
                  >
                    {slot}
                  </span>
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
