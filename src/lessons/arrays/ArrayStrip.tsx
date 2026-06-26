import type { ReactElement } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireSource } from "@/components/rewire/RewireSource"
import { RewireTarget } from "@/components/rewire/RewireTarget"
import type { ShiftFrame } from "@/features/lesson/arraysEngine"
import {
  CELL,
  RULER_GAP,
  RULER_H,
  jumpArc,
  scanPath,
  stripExtent,
} from "./arrayStripLayout"

/**
 * The Arrays figure: a row of contiguous cells (they TOUCH, no gaps) over an
 * address ruler. Contiguity and "index = address" are the load-bearing facts, so
 * the cells share edges and the indices live on a ruler beneath, never as
 * tappable answer labels on the cells.
 *
 * Modes:
 *  - read: de-cued cells (no pre-highlight); tappable for the access asks. On
 *    reveal, an overlay fires the single jump arc (index ask) or the
 *    step-by-step scan (value ask): the visual O(1)-vs-O(n) asymmetry.
 *  - ripple: a post-verdict wave of one-slot shifts (from the pure shiftFrames
 *    selector); the wave length IS the cost. Reduced motion snaps.
 *  - place: the row with a drop target at EVERY gap (0..n) plus a loose cell to
 *    drag in. Where it lands decides how much ripples, so the gesture itself
 *    encodes the cost (the meaningful drag that replaces the old single-target
 *    construct). Drives place-cheapest.
 */

type Tone = "active" | "correct" | "wrong"

const TONE_RING: Record<Tone, string> = {
  active: "border-lilac-strong bg-lilac-soft",
  correct: "border-success bg-success-soft",
  wrong: "border-danger bg-danger-soft",
}

export type Overlay =
  | { kind: "jump"; k: number }
  | { kind: "scan"; to: number }
  | null

export function ArrayStrip(props: {
  mode: "read" | "ripple" | "place"
  cells?: string[]
  ruler?: boolean
  highlight?: number
  tone?: Tone
  onTap?: (i: number) => void
  overlay?: Overlay
  /** Dev-only tracer hook: marks the correct cell so the e2e tracer can tap it. */
  answerIndex?: number
  frame?: ShiftFrame
  opIndex?: number
  /** place mode: the gap the learner has chosen so far (e.g. "gap-3"). */
  selectedGap?: string | null
  /** place mode: the cheapest gap (dev-only tracer hook). */
  correctGap?: string
  /** place mode: the loose cell's label. */
  looseLabel?: string
  reduced?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const isReduced = props.reduced || (prefersReduced ?? false)

  if (props.mode === "ripple" && props.frame) {
    return <RippleStrip frame={props.frame} opIndex={props.opIndex ?? -1} reduced={isReduced} />
  }
  if (props.mode === "place") {
    return (
      <PlaceStrip
        cells={props.cells ?? []}
        selectedGap={props.selectedGap ?? null}
        correctGap={props.correctGap}
        looseLabel={props.looseLabel ?? "X"}
      />
    )
  }
  return (
    <ReadStrip
      cells={props.cells ?? []}
      ruler={props.ruler ?? true}
      highlight={props.highlight ?? -1}
      tone={props.tone ?? "active"}
      onTap={props.onTap}
      overlay={props.overlay ?? null}
      answerIndex={props.answerIndex ?? -1}
      reduced={isReduced}
    />
  )
}

/* --------------------------------- read mode -------------------------------- */

function ReadStrip({
  cells,
  ruler,
  highlight,
  tone,
  onTap,
  overlay,
  answerIndex,
  reduced,
}: {
  cells: string[]
  ruler: boolean
  highlight: number
  tone: Tone
  onTap?: (i: number) => void
  overlay: Overlay
  answerIndex: number
  reduced: boolean
}) {
  const n = cells.length
  const ext = stripExtent(n)

  return (
    <div className="relative mx-auto" style={{ width: ext.width }}>
      {/* the contiguous cell row */}
      <div className="flex" style={{ height: CELL }}>
        {cells.map((c, i) => {
          const lit = i === highlight
          const Tag = onTap ? "button" : "div"
          return (
            <Tag
              key={`${c}-${i}`}
              {...(onTap
                ? {
                    type: "button" as const,
                    onClick: () => onTap(i),
                    "aria-label": `cell ${i}, value ${c}`,
                  }
                : {})}
              data-answer={answerIndex === i && import.meta.env.DEV ? "1" : undefined}
              className={cn(
                "box-border flex items-center justify-center border-y-2 border-l-2 text-lg font-bold text-foreground outline-none last:border-r-2",
                "first:rounded-l-xl last:rounded-r-xl",
                lit ? cn("relative z-10", TONE_RING[tone]) : "border-border bg-card",
                onTap &&
                  "cursor-pointer transition-colors hover:bg-lilac-soft/40 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-lilac-strong/60",
              )}
              style={{ width: CELL, height: CELL }}
            >
              {c}
            </Tag>
          )
        })}
      </div>

      {/* the address ruler beneath */}
      {ruler && (
        <div
          className="flex"
          style={{ height: RULER_H, marginTop: RULER_GAP }}
          aria-hidden
        >
          {cells.map((_, i) => (
            <span
              key={i}
              className={cn(
                "flex items-center justify-center text-xs tabular-nums",
                i === highlight ? "font-bold text-lilac-strong" : "text-faint",
              )}
              style={{ width: CELL }}
            >
              {i}
            </span>
          ))}
        </div>
      )}

      {/* the access overlay (decorative): one jump arc, or a step-by-step scan */}
      {overlay && (
        <AccessOverlay overlay={overlay} width={ext.width} height={ext.height} reduced={reduced} />
      )}
    </div>
  )
}

function AccessOverlay({
  overlay,
  width,
  height,
  reduced,
}: {
  overlay: NonNullable<Overlay>
  width: number
  height: number
  reduced: boolean
}) {
  const draw =
    overlay.kind === "jump" ? jumpArc(overlay.k) : scanPath(overlay.to)
  const transition = reduced
    ? { duration: 0 }
    : { duration: overlay.kind === "jump" ? 0.5 : 0.12 * (overlay.to + 1), ease: "easeInOut" as const }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={width}
      height={height}
      aria-hidden
    >
      <motion.path
        d={draw.d}
        fill="none"
        stroke="var(--color-lilac-strong, #8B7FD6)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0, opacity: 0.2 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={transition}
      />
      {overlay.kind === "jump" && (
        <motion.circle
          r={4.5}
          fill="var(--color-lilac-strong, #8B7FD6)"
          initial={reduced ? false : { cx: draw.d ? jumpArc(overlay.k).to.x : 0, cy: 0, opacity: 0 }}
          animate={{ cx: jumpArc(overlay.k).to.x, cy: 0, opacity: 1 }}
          transition={transition}
        />
      )}
    </svg>
  )
}

/* -------------------------------- ripple mode ------------------------------- */

function RippleStrip({
  frame,
  opIndex,
  reduced,
}: {
  frame: ShiftFrame
  opIndex: number
  reduced: boolean
}) {
  const width = frame.columns * CELL
  const spring = { type: "spring", stiffness: 420, damping: 32 } as const

  return (
    <div
      className="relative mx-auto"
      style={{ width, height: CELL + RULER_GAP + RULER_H }}
      data-testid="ripple-strip"
    >
      {/* fixed address slots (dashed) + ruler */}
      <div className="absolute inset-x-0 top-0 flex" aria-hidden>
        {Array.from({ length: frame.columns }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "box-border border-y-2 border-l-2 border-dashed last:border-r-2 first:rounded-l-xl last:rounded-r-xl",
              i === opIndex ? "border-lilac-strong/50" : "border-border/50",
            )}
            style={{ width: CELL, height: CELL }}
          />
        ))}
      </div>
      <div
        className="absolute inset-x-0 flex"
        style={{ top: CELL + RULER_GAP, height: RULER_H }}
        aria-hidden
      >
        {Array.from({ length: frame.columns }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "flex items-center justify-center text-xs tabular-nums",
              i === opIndex ? "font-bold text-lilac-strong" : "text-faint",
            )}
            style={{ width: CELL }}
          >
            {i}
          </span>
        ))}
      </div>

      {/* the cells, absolutely placed at slot * CELL, sliding one slot at a time */}
      <AnimatePresence initial={false}>
        {frame.cells.map((c) => (
          <motion.div
            key={c.id}
            className="absolute left-0 top-0"
            initial={{ opacity: 0, scale: 0.6, x: c.slot * CELL }}
            animate={{ opacity: 1, scale: 1, x: c.slot * CELL }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={reduced ? { duration: 0 } : spring}
            data-cell={c.id}
          >
            <div
              className={cn(
                "box-border flex items-center justify-center rounded-xl border-2 text-lg font-bold text-foreground",
                c.moving ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
              )}
              style={{ width: CELL, height: CELL }}
            >
              {c.label}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* --------------------------------- place mode ------------------------------- */

/** A thin drop zone that sits in a gap of the row. Where the loose cell lands
 * decides how much ripples, so each gap is a real, distinct choice. */
function Gap({ id, selected }: { id: string; selected: boolean }) {
  return (
    <RewireTarget
      id={id}
      label={`the gap at ${id.replace("gap-", "index ")}`}
      className={cn(
        "box-border size-auto min-h-0 min-w-0 self-stretch rounded-md border-0 px-0 py-0",
        selected ? "w-7 bg-lilac-soft" : "w-2.5",
      )}
    >
      <span aria-hidden className="block size-full" style={{ minHeight: CELL }} />
    </RewireTarget>
  )
}

function PlaceStrip({
  cells,
  selectedGap,
  correctGap,
  looseLabel,
}: {
  cells: string[]
  selectedGap: string | null
  correctGap?: string
  looseLabel: string
}) {
  const n = cells.length
  // The row, with a gap drop target before every cell and one after the last.
  const slots: ReactElement[] = []
  for (let i = 0; i <= n; i++) {
    slots.push(<Gap key={`gap-${i}`} id={`gap-${i}`} selected={selectedGap === `gap-${i}`} />)
    if (i < n) {
      slots.push(
        <div
          key={`cell-${i}`}
          className="box-border flex items-center justify-center rounded-lg border-2 border-border bg-card text-lg font-bold text-foreground"
          style={{ width: CELL, height: CELL }}
        >
          {cells[i]}
        </div>,
      )
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-stretch">{slots}</div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Drag into a gap
        </span>
        <RewireSource id="X" label={`cell ${looseLabel}`} className="box-border size-auto rounded-xl px-0 py-0">
          {/* dev-only tracer hook: a single write whose correct target is the
              cheapest gap, so the e2e rewireInOrder helper drives this beat. */}
          {import.meta.env.DEV && correctGap && (
            <span className="sr-only" data-write-order={0} data-rewire-correct-target={correctGap} />
          )}
          <span
            style={{ width: CELL, height: CELL }}
            className="flex items-center justify-center text-lg font-bold"
          >
            {looseLabel}
          </span>
        </RewireSource>
      </div>
    </div>
  )
}
