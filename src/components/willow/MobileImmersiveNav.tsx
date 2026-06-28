import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { NAV_ITEMS } from "@/lib/navItems"

/**
 * Mobile lesson nav. A three-line dock floats in the bottom-right, clear above
 * the lesson's own bottom CTA. Tapping it reveals a compact nav pill that grows
 * out of the icon's corner; tapping the scrim or navigating compresses it back
 * in. The icon and the pill share one bottom-right origin and cross-fade with a
 * single scale, so there is no width-morph reflow to jitter.
 */
export function MobileImmersiveNav() {
  const { screen, tab: active, navigate } = useNavigation()
  const reduce = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  // Re-condense when the route changes (advancing a beat, or leaving the lesson).
  useEffect(() => setExpanded(false), [screen])

  // The dock belongs to the active lesson, where it floats above the lesson's own
  // bottom CTA. Other immersive routes (completion) keep their own navigation, so
  // the dock would only overlap their buttons.
  if (screen.name !== "lesson") return null

  const pop = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 30 }
  const corner = { transformOrigin: "bottom right" as const }

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

      <div className="mx-auto flex max-w-md justify-end px-4 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]">
        {/* Fixed-size anchor so the fab and the (larger) pill share one
            bottom-right corner without shifting the layout while they swap. */}
        <div className="pointer-events-auto relative size-14">
          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.nav
                key="pill"
                aria-label="Primary"
                style={corner}
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={pop}
                className="absolute bottom-0 right-0 flex items-center gap-1 rounded-3xl border border-border bg-card/95 p-1.5 shadow-card backdrop-blur-md"
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
                        "flex w-[3.75rem] flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-medium transition-colors",
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
                style={corner}
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={pop}
                className="absolute inset-0 flex items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md"
              >
                <Menu className="size-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
