import { motion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * A horizontal row of indexed, contiguous cells (value on top, index beneath) —
 * the Arrays counterpart to StructureColumn. Cells can be tapped (the access
 * intro) and the touched index is highlighted; entrance is animated, but there
 * is no multi-frame step-scrubbing (that stays deferred — see ADR 0001).
 */
export function ArrayRow({
  cells,
  highlight = -1,
  onTap,
  className,
}: {
  cells: string[]
  highlight?: number
  onTap?: (index: number) => void
  className?: string
}) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {cells.map((c, i) => (
        <div key={`${i}-${c}`} className="flex flex-col items-center gap-1">
          <motion.button
            type="button"
            layout
            disabled={!onTap}
            onClick={() => onTap?.(i)}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            className={cn(
              "flex h-12 w-10 items-center justify-center rounded-lg border-2 font-bold text-foreground transition-colors",
              i === highlight
                ? "border-lilac-strong bg-lilac-soft"
                : "border-border bg-card",
              onTap ? "cursor-pointer" : "cursor-default",
            )}
          >
            {c}
          </motion.button>
          <span
            className={cn(
              "text-[10px]",
              i === highlight
                ? "font-semibold text-lilac-strong"
                : "text-faint",
            )}
          >
            {i}
          </span>
        </div>
      ))}
    </div>
  )
}
