import type { ReactNode } from "react"
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shared step transport for snapshot-driven operation animations (the eventual
 * shared step-engine surfaced as UI): play / step-back / step-forward / replay.
 * Reused across all future lessons.
 */
export function StepTransport({
  index,
  total,
  playing,
  onPlayToggle,
  onPrev,
  onNext,
  onReplay,
  className,
}: {
  index: number
  total: number
  playing: boolean
  onPlayToggle: () => void
  onPrev: () => void
  onNext: () => void
  onReplay: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-soft",
        className,
      )}
    >
      <TransportButton label="Step back" onClick={onPrev} disabled={index <= 0}>
        <SkipBack className="size-4" />
      </TransportButton>

      <button
        type="button"
        onClick={onPlayToggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
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
      >
        <SkipForward className="size-4" />
      </TransportButton>

      <span className="px-2 text-xs font-medium tabular-nums text-muted-foreground">
        {Math.min(index + 1, total)} / {total}
      </span>

      <TransportButton label="Replay" onClick={onReplay}>
        <RotateCcw className="size-4" />
      </TransportButton>
    </div>
  )
}

function TransportButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
