import { useLayoutEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { useNavChrome } from "@/components/willow/NavChromeProvider"
import { NAV_ITEMS } from "@/lib/navItems"

/** Width of the expanded tab pill (4 tabs); the closed cell is the square below. */
const OPEN_W = 280
const CELL = 56

/**
 * Mobile lesson nav: one dock that morphs between a centered tab pill (open) and a
 * three-line cell pinned to the bottom-right corner (closed). The morph animates
 * real width plus an x-offset, so closing reads as the pill *sliding to the right*
 * and shrinking into the cell (then the lesson's CTA settles in beside it), and
 * opening grows it back to centered. The icon and tabs are both always mounted and
 * crossfaded (no mount/unmount), which kills the flicker; animating real width
 * (not a layout/scale) keeps the shrink continuous, which kills the snap.
 */
export function MobileImmersiveNav() {
  const { screen, tab: active, navigate } = useNavigation()
  const { menuOpen, setMenuOpen } = useNavChrome()
  const reduce = useReducedMotion()

  const wrapRef = useRef<HTMLDivElement>(null)
  const [wrapW, setWrapW] = useState(0)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWrapW(el.clientWidth)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The dock belongs to the active lesson; other immersive routes keep their own
  // navigation, so the dock would only cover their buttons.
  if (screen.name !== "lesson") return null

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 440, damping: 38 }
  // Quick content crossfade, nudged so the layer that is leaving clears before the
  // box reaches its new size, and the arriving layer lands as it settles.
  const fadeIn = reduce ? { duration: 0 } : { duration: 0.16, delay: 0.08 }
  const fadeOut = reduce ? { duration: 0 } : { duration: 0.12 }

  // Open: shift the right-anchored dock left so the OPEN_W pill is centered.
  const openX = -Math.max(0, (wrapW - OPEN_W) / 2)

  return (
    <>
      <AnimatePresence>
        {menuOpen && (
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-foreground/5"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div ref={wrapRef} className="relative mx-auto h-14 max-w-md">
          <motion.div
            className="pointer-events-auto absolute bottom-0 right-0 h-14 overflow-hidden rounded-3xl border border-border bg-card/90 shadow-card backdrop-blur-md"
            initial={false}
            animate={{ width: menuOpen ? OPEN_W : CELL, x: menuOpen ? openX : 0 }}
            transition={spring}
          >
            {/* Tabs layer: fixed at the open width and right-anchored, so a shrink
                clips it into the corner. Crossfaded, never unmounted. */}
            <motion.nav
              aria-label="Primary"
              aria-hidden={!menuOpen}
              className="absolute inset-y-0 right-0 flex items-center gap-1 px-1.5"
              style={{ width: OPEN_W, pointerEvents: menuOpen ? "auto" : "none" }}
              initial={false}
              animate={{ opacity: menuOpen ? 1 : 0 }}
              transition={menuOpen ? fadeIn : fadeOut}
            >
              {NAV_ITEMS.map(({ tab, label, Icon, target }) => {
                const isActive = tab === active
                return (
                  <button
                    key={tab}
                    type="button"
                    tabIndex={menuOpen ? 0 : -1}
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

            {/* Icon layer: the corner cell. Crossfaded opposite the tabs. */}
            <motion.button
              type="button"
              aria-label="Show navigation"
              aria-hidden={menuOpen}
              tabIndex={menuOpen ? -1 : 0}
              onClick={() => setMenuOpen(true)}
              className="absolute inset-y-0 right-0 grid w-14 place-items-center text-foreground"
              style={{ pointerEvents: menuOpen ? "none" : "auto" }}
              initial={false}
              animate={{ opacity: menuOpen ? 0 : 1 }}
              transition={menuOpen ? fadeOut : fadeIn}
            >
              <Menu className="size-5" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </>
  )
}
