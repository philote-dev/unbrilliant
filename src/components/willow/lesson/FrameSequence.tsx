import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * A reusable discrete-frame player for lesson replays, generalised from Heaps'
 * local StepReplay. It walks a precomputed `frames` list (the engine's pure,
 * deterministic per-step data) and renders the current frame through a render
 * child, so the same stepper drives any "watch it happen" beat. It is view-only:
 * the frame index is transient UI state and never feeds grading.
 *
 * Three independent capabilities, each opt-in:
 *  - `autoPlayMs`: paces the sequence forward on a timer (a constant gap, or a
 *    per-index function for a "hold the first beat, then move" cadence). It stops
 *    at the last frame and never loops.
 *  - `controls`: a Back / Next / Replay scrubber with a step counter. Any manual
 *    step halts autoplay; Replay restarts from the first frame.
 *  - `reduced`: the reduced-motion fallback. Snaps straight to the FINAL frame and
 *    schedules no timers (parity is a hard requirement on every animated path).
 *    Defaults to the user's `prefers-reduced-motion` when the prop is omitted.
 */
export function FrameSequence<T>({
  frames,
  children,
  autoPlayMs,
  controls = false,
  reduced: reducedProp,
  className,
  stepButtonClassName,
  replayButtonClassName,
  counterClassName,
}: {
  /** The precomputed frames to walk, in order. Frame 0 is shown first. */
  frames: T[]
  /** Renders one frame; `index` is its 0-based position in `frames`. */
  children: (frame: T, index: number) => ReactNode
  /**
   * When set, auto-advance through the frames. A number is a constant gap (ms); a
   * function returns the gap to wait BEFORE advancing away from `index`, so a beat
   * can dwell on the setup frame and then move quicker through the rest.
   */
  autoPlayMs?: number | ((index: number) => number)
  /** Show the Back / Next / Replay scrubber and a step counter. */
  controls?: boolean
  /** Reduced-motion: snap to the final frame, schedule no timers. */
  reduced?: boolean
  /** Extra classes on the container (merged with the default centered column). */
  className?: string
  /** Themes the Back / Next buttons (e.g. a dark skin). */
  stepButtonClassName?: string
  /** Themes the Replay button. */
  replayButtonClassName?: string
  /** Themes the step counter text. */
  counterClassName?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedProp ?? prefersReduced ?? false

  const lastIndex = Math.max(0, frames.length - 1)
  const [index, setIndex] = useState(reduced ? lastIndex : 0)
  const [auto, setAuto] = useState(() => autoPlayMs != null && !reduced && lastIndex > 0)

  // Read the latest pacing through a ref so an inline `autoPlayMs` function (a new
  // identity each parent render) never resets the running timer mid-beat.
  const autoPlayRef = useRef(autoPlayMs)
  autoPlayRef.current = autoPlayMs

  // Auto-play as a paced, one-shot-per-frame chain: schedule a single advance,
  // which re-runs the effect at the new index and schedules the next. It settles
  // at the last frame (the `index >= lastIndex` guard) and never loops. Reduced
  // motion schedules nothing.
  useEffect(() => {
    if (!auto || reduced || index >= lastIndex) return
    const pacing = autoPlayRef.current
    if (pacing == null) return
    const delay = typeof pacing === "function" ? pacing(index) : pacing
    const t = setTimeout(() => setIndex((i) => Math.min(lastIndex, i + 1)), delay)
    return () => clearTimeout(t)
  }, [auto, index, lastIndex, reduced])

  const safeIndex = Math.min(index, lastIndex)
  const frame = frames[safeIndex]

  return (
    <motion.div
      className={cn("flex flex-col items-center gap-3", className)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.3 }}
    >
      {frame !== undefined && children(frame, safeIndex)}

      {controls && lastIndex > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="default"
            className={stepButtonClassName}
            disabled={safeIndex === 0}
            onClick={() => {
              setAuto(false)
              setIndex((i) => Math.max(0, i - 1))
            }}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <span
            className={cn(
              "min-w-16 text-center text-xs tabular-nums text-muted-foreground",
              counterClassName,
            )}
          >
            Step {safeIndex} / {lastIndex}
          </span>
          <Button
            variant="secondary"
            size="default"
            className={stepButtonClassName}
            disabled={safeIndex === lastIndex}
            onClick={() => {
              setAuto(false)
              setIndex((i) => Math.min(lastIndex, i + 1))
            }}
          >
            Next <ArrowRight className="size-4" />
          </Button>
          <Button
            variant="soft"
            size="default"
            className={replayButtonClassName}
            onClick={() => {
              setIndex(0)
              setAuto(autoPlayRef.current != null && !reduced)
            }}
          >
            <RotateCcw className="size-4" /> Replay
          </Button>
        </div>
      )}
    </motion.div>
  )
}
