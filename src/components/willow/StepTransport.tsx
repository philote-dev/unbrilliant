import type { KeyboardEvent, ReactNode } from "react"
import {
  ChevronFirst,
  ChevronLast,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shared step transport for snapshot-driven operation animations (the eventual
 * shared step-engine surfaced as UI): play / step-back / step-forward / replay.
 * Reused across all future lessons.
 *
 * Everything beyond the original six controls is strictly OPT-IN and additive, so
 * existing callers (Stacks & Queues) render and behave exactly as before. Pass a
 * handler to light up that control:
 *  - `onFirst` / `onLast`: jump-to-start / jump-to-end buttons (plus Home/End keys).
 *  - `onScrub`: a timeline scrubber.
 *  - `onSpeedChange` (with `speed`, `speeds`): a 0.25x..4x speed control.
 *  - `keyboard`: Space (play/pause), arrows (step), Home/End (jump) on the group.
 *  - `liveLabel`: a screen-reader live region announcing the current frame.
 *
 * Stepping is VIEW-STATE only. For graded predicts, callers must mount the
 * transport POST-VERDICT (after the answer is locked) so scrubbing can never
 * reveal or skip a graded answer.
 */
const DEFAULT_SPEEDS = [0.25, 0.5, 1, 2, 4]

export function StepTransport({
  index,
  total,
  playing,
  onPlayToggle,
  onPrev,
  onNext,
  onReplay,
  className,
  onFirst,
  onLast,
  onScrub,
  speed,
  speeds = DEFAULT_SPEEDS,
  onSpeedChange,
  keyboard = false,
  liveLabel,
  label = "Playback controls",
}: {
  index: number
  total: number
  playing: boolean
  onPlayToggle: () => void
  onPrev: () => void
  onNext: () => void
  onReplay: () => void
  className?: string
  /** Jump to the first frame (renders a Home button + enables the Home key). */
  onFirst?: () => void
  /** Jump to the last frame (renders an End button + enables the End key). */
  onLast?: () => void
  /** Scrub to an absolute frame index (renders the timeline slider). */
  onScrub?: (index: number) => void
  /** Current speed multiplier (shown on the speed control). */
  speed?: number
  /** Selectable speed multipliers (defaults to 0.25x..4x). */
  speeds?: number[]
  /** Cycle to the next speed (renders the speed control). */
  onSpeedChange?: (speed: number) => void
  /** Enable Space / arrows / Home / End shortcuts on the group. */
  keyboard?: boolean
  /** Screen-reader live-region text (announced politely as it changes). */
  liveLabel?: string
  /** Accessible name for the control group (used when keyboard is enabled). */
  label?: string
}) {
  const hasScrubber = typeof onScrub === "function" && total > 1
  const showSpeed = typeof onSpeedChange === "function"
  const currentSpeed = speed ?? 1
  // "Enhanced" = any opt-in feature is in use. Existing callers pass none, so they
  // keep the original 36/40px controls and pill layout byte-for-byte; enhanced
  // callers get 44px targets to satisfy the touch-size bar.
  const enhanced = Boolean(
    keyboard || onScrub || onSpeedChange || onFirst || onLast || liveLabel !== undefined,
  )

  const cycleSpeed = () => {
    if (!onSpeedChange) return
    const i = speeds.indexOf(currentSpeed)
    const next = speeds[(i + 1) % speeds.length] ?? speeds[0]
    onSpeedChange(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!keyboard) return
    switch (event.key) {
      case " ":
      case "Spacebar":
      case "k":
        event.preventDefault()
        onPlayToggle()
        break
      case "ArrowLeft":
        event.preventDefault()
        onPrev()
        break
      case "ArrowRight":
        event.preventDefault()
        onNext()
        break
      case "Home":
        if (onFirst) {
          event.preventDefault()
          onFirst()
        }
        break
      case "End":
        if (onLast) {
          event.preventDefault()
          onLast()
        }
        break
    }
  }

  return (
    <div
      className={cn(
        "rounded-full border border-border bg-card p-1.5 shadow-soft",
        hasScrubber ? "flex flex-col gap-2 rounded-3xl p-2" : "flex items-center gap-2",
        keyboard &&
          "outline-none focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...(keyboard
        ? {
            role: "group",
            "aria-label": label,
            tabIndex: 0,
            onKeyDown: handleKeyDown,
            "aria-keyshortcuts": "Space ArrowLeft ArrowRight Home End",
          }
        : {})}
    >
      <div className="flex items-center gap-2">
        {onFirst && (
          <TransportButton label="Jump to start" onClick={onFirst} disabled={index <= 0} large>
            <ChevronFirst className="size-4" />
          </TransportButton>
        )}

        <TransportButton
          label="Step back"
          onClick={onPrev}
          disabled={index <= 0}
          large={enhanced}
        >
          <SkipBack className="size-4" />
        </TransportButton>

        <button
          type="button"
          onClick={onPlayToggle}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95",
            enhanced ? "size-11" : "size-10",
          )}
        >
          {playing ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="size-4" fill="currentColor" />
          )}
        </button>

        <TransportButton
          label="Step forward"
          onClick={onNext}
          disabled={index >= total - 1}
          large={enhanced}
        >
          <SkipForward className="size-4" />
        </TransportButton>

        {onLast && (
          <TransportButton
            label="Jump to end"
            onClick={onLast}
            disabled={index >= total - 1}
            large
          >
            <ChevronLast className="size-4" />
          </TransportButton>
        )}

        <span className="px-2 text-xs font-medium tabular-nums text-muted-foreground">
          {Math.min(index + 1, total)} / {total}
        </span>

        {showSpeed && (
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${formatSpeed(currentSpeed)}, tap to change`}
            className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-strong/60"
          >
            <Gauge className="size-3.5" />
            {formatSpeed(currentSpeed)}
          </button>
        )}

        <TransportButton label="Replay" onClick={onReplay} large={enhanced}>
          <RotateCcw className="size-4" />
        </TransportButton>
      </div>

      {hasScrubber && (
        <label className="flex min-h-11 items-center gap-2 px-1">
          <span className="sr-only">Timeline</span>
          <input
            type="range"
            min={0}
            max={total - 1}
            step={1}
            value={Math.min(index, total - 1)}
            onChange={(e) => onScrub?.(Number(e.currentTarget.value))}
            aria-label="Timeline scrubber"
            aria-valuetext={`Frame ${Math.min(index + 1, total)} of ${total}`}
            className="h-11 w-full cursor-pointer accent-lilac-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </label>
      )}

      {liveLabel !== undefined && (
        <span role="status" aria-live="polite" className="sr-only">
          {liveLabel}
        </span>
      )}
    </div>
  )
}

function formatSpeed(speed: number): string {
  const rounded = Math.round(speed * 100) / 100
  return `${rounded}x`
}

function TransportButton({
  children,
  label,
  onClick,
  disabled,
  large,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  /** 44px target for the opt-in jump buttons (the original step buttons stay 36px). */
  large?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-strong/60",
        large ? "size-11" : "size-9",
      )}
    >
      {children}
    </button>
  )
}
