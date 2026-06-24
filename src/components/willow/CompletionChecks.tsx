import { Check } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

/** Three pastel-green mastery checks on the completion screen. */
export function CompletionChecks({
  items,
  className,
}: {
  items: { label: string; done: boolean }[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={item.label} className="flex flex-col items-center gap-2">
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
              delay: 0.1 + i * 0.12,
            }}
            className={cn(
              "flex size-10 items-center justify-center rounded-full",
              item.done
                ? "bg-success text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Check className="size-5" strokeWidth={3} />
          </motion.span>
          <span className="text-sm font-medium text-muted-foreground">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
