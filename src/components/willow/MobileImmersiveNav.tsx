import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { NAV_ITEMS } from "@/lib/navItems"

/**
 * Mobile lesson-flow nav. One dock morphs between a bottom-right three-line icon
 * (condensed, for immersion) and the full navigation pill. Tapping the icon
 * expands it in place; tapping the scrim or navigating re-condenses it. The dock
 * itself carries the chrome (border, blur, shadow) so a single `layout` spring
 * grows it from the corner instead of cross-fading two separate shapes.
 */
export function MobileImmersiveNav() {
  const { screen, tab: active, navigate } = useNavigation()
  const reduce = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  // Re-condense when the route changes (advancing a beat, or leaving the lesson).
  useEffect(() => setExpanded(false), [screen])

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 460, damping: 40 }

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
        <motion.div
          layout
          transition={spring}
          className={cn(
            "pointer-events-auto flex items-center overflow-hidden border border-border bg-card/90 shadow-card backdrop-blur-md",
            expanded ? "h-16 w-full rounded-3xl px-2" : "size-14 justify-center rounded-2xl",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {expanded ? (
              <motion.nav
                key="tabs"
                aria-label="Primary"
                className="flex w-full items-center justify-around gap-1"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {NAV_ITEMS.map(({ tab, label, Icon, target }) => {
                  const isActive = tab === active
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => navigate(target)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors",
                        isActive
                          ? "text-lilac-strong"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon
                        className="size-5"
                        strokeWidth={isActive ? 2.4 : 2}
                        fill={isActive ? "var(--lilac)" : "none"}
                      />
                      {label}
                    </button>
                  )
                })}
              </motion.nav>
            ) : (
              <motion.button
                key="fab"
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Show navigation"
                className="flex size-full items-center justify-center text-foreground"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <Menu className="size-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
