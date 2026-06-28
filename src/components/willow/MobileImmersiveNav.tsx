import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Menu } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { BottomNav } from "@/components/willow/BottomNav"

/**
 * Mobile lesson-flow nav. The bottom pill condenses to a bottom-right three-line
 * icon for immersion; tapping it expands the real BottomNav pill in place;
 * tapping anywhere else (the scrim) or navigating re-condenses.
 */
export function MobileImmersiveNav() {
  const { screen } = useNavigation()
  const reduce = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  // Re-condense when the route changes (advancing a beat, or leaving the lesson).
  useEffect(() => setExpanded(false), [screen])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <AnimatePresence>
        {expanded && (
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close navigation"
            onClick={() => setExpanded(false)}
            className="pointer-events-auto fixed inset-0 -z-10"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto flex max-w-md justify-end px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AnimatePresence initial={false} mode="popLayout">
          {expanded ? (
            <motion.div
              key="pill"
              className="pointer-events-auto w-full"
              initial={reduce ? false : { opacity: 0, scale: 0.92, x: 48 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, x: 48 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <BottomNav />
            </motion.div>
          ) : (
            <motion.button
              key="fab"
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Show navigation"
              className="pointer-events-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md"
              initial={reduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            >
              <Menu className="size-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
