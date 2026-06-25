import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Flame, type FlameTier } from "@/components/willow/Flame"
import { SegmentedProgress } from "@/components/willow/Progress"

/** A small flame tongue (point up), base near the bottom of the 24-box. */
const SMALL_FLAME = "M12 3 C 8 9 8 13 8 16 a4 4 0 0 0 8 0 C 16 13 16 9 12 3 Z"

/**
 * The combo-10 "inferno": a row of flames erupting along the progress bar so it
 * reads as consumed by fire. Pure CSS flicker (staggered) so it stays cheap, and
 * it sits as an overlay above the (dimmed) bar.
 */
function ConsumingFlames() {
  const tongues = 13
  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex items-end justify-between"
      style={{ bottom: "50%", height: 26 }}
      aria-hidden
    >
      {/* the burning fuel line, on the bar */}
      <span
        className="absolute inset-x-0 bottom-0 h-1 rounded-full"
        style={{ background: "var(--lilac-strong)", filter: "blur(2.5px)", opacity: 0.6 }}
      />
      {Array.from({ length: tongues }).map((_, i) => {
        const heightVar = 0.74 + ((i * 7) % 5) * 0.13
        return (
          <span
            key={i}
            className="relative block"
            style={{ width: 14, height: 22, transformOrigin: "50% 100%", transform: `scaleY(${heightVar})` }}
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={22}
              className="animate-flame-flicker text-lilac-strong"
              style={{ transformOrigin: "50% 100%", animationDelay: `${(i % 5) * 0.16}s` }}
            >
              <path d={SMALL_FLAME} fill="currentColor" opacity={0.95} />
              <path d={SMALL_FLAME} fill="#ffffff" opacity={0.3} transform="translate(6.6 9.6) scale(0.45)" />
            </svg>
          </span>
        )
      })}
    </div>
  )
}

/**
 * Lesson-player top bar: close · slim segmented progress · numberless flame.
 * At a 10-combo (tier 4) the flame grows and the progress bar is consumed by a
 * row of fire.
 */
export function LessonTopBar({
  totalParts,
  filledParts,
  tier,
  onClose,
  className,
}: {
  totalParts: number
  filledParts: number
  tier: FlameTier
  onClose: () => void
  className?: string
}) {
  const inferno = tier >= 4

  return (
    <div className={cn("flex items-center gap-4 px-1", className)}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close lesson"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-5" />
      </button>

      <div className="relative flex-1">
        <SegmentedProgress
          total={totalParts}
          filled={filledParts}
          className={cn("transition-opacity duration-300", inferno && "opacity-30")}
        />
        {inferno && <ConsumingFlames />}
      </div>

      <Flame tier={tier} size={inferno ? 36 : 28} className="shrink-0" />
    </div>
  )
}
