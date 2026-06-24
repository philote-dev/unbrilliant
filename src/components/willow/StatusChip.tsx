import { Check, Lightbulb, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type FeedbackStatus = "correct" | "hint" | "fail"

const CONFIG: Record<
  FeedbackStatus,
  { label: string; chip: string; badge: string; Icon: typeof Check }
> = {
  correct: {
    label: "Correct",
    chip: "bg-success-soft text-success-foreground border-success/40",
    badge: "bg-success text-white",
    Icon: Check,
  },
  hint: {
    label: "Hint",
    chip: "bg-warning-soft text-warning-foreground border-warning/50",
    badge: "bg-warning text-warning-foreground",
    Icon: Lightbulb,
  },
  fail: {
    label: "Try again",
    chip: "bg-danger-soft text-danger border-danger/40",
    badge: "bg-danger text-white",
    Icon: X,
  },
}

/** Pastel status pill: icon + label so feedback never relies on color alone. */
export function StatusChip({
  status,
  className,
}: {
  status: FeedbackStatus
  className?: string
}) {
  const { label, chip, badge, Icon } = CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm font-medium",
        chip,
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full",
          badge,
        )}
      >
        <Icon className="size-3" strokeWidth={3} />
      </span>
      {label}
    </span>
  )
}
