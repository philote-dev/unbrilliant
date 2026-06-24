import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Flame, type FlameTier } from "@/components/willow/Flame"
import { SegmentedProgress } from "@/components/willow/Progress"

/** Lesson-player top bar: close · slim segmented progress · numberless flame. */
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

      <SegmentedProgress
        total={totalParts}
        filled={filledParts}
        className="flex-1"
      />

      <Flame tier={tier} size={28} className="shrink-0" />
    </div>
  )
}
