import { motion } from "motion/react"

import { cn } from "@/lib/utils"

/** Slim lilac progress on a faint track. Used on course detail. */
export function ProgressBar({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full bg-lilac-strong"
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ type: "spring", stiffness: 180, damping: 24 }}
      />
    </div>
  )
}

/** Segmented progress: one slim pill per part. Used in the lesson top bar. */
export function SegmentedProgress({
  total,
  filled,
  className,
}: {
  total: number
  filled: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <motion.div
            className="h-full rounded-full bg-lilac-strong"
            initial={false}
            animate={{ width: i < filled ? "100%" : "0%" }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
        </div>
      ))}
    </div>
  )
}
