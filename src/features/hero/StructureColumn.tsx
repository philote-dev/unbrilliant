import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: "h-12 w-20 text-xl",
  md: "h-16 w-24 text-2xl",
  lg: "h-20 w-28 text-3xl",
}

/**
 * A vertical column of A/B/C cards (top → bottom) with a grounded base.
 * Push/pop/enqueue/dequeue animate via Framer Motion `layout` + AnimatePresence.
 * Cards slide/lift smoothly so the learner *sees* the rule.
 */
export function StructureColumn({
  cards,
  tags,
  base = true,
  size = "md",
  className,
}: {
  cards: string[] // top → bottom
  tags?: Record<string, string>
  base?: boolean
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {cards.map((card) => (
            <motion.div
              key={card}
              layout
              initial={{ opacity: 0, y: -14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.82, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              className={cn(
                "relative flex items-center justify-center rounded-xl border border-border bg-card font-bold text-foreground shadow-soft",
                SIZES[size],
              )}
            >
              {card}
              {tags?.[card] && (
                <span className="absolute right-1.5 top-1.5 rounded bg-lilac px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-lilac-foreground">
                  {tags[card]}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {base && (
        <motion.div
          layout
          className="mt-2 h-2.5 rounded-full bg-lilac/70"
          style={{ width: size === "sm" ? 96 : size === "md" ? 112 : 128 }}
        />
      )}
    </div>
  )
}
